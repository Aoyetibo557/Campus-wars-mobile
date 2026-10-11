-- Functions and triggers. All SECURITY DEFINER functions use
-- set search_path = '' with fully qualified names. Execute is revoked from
-- every client role; only the functions clients need get explicit grants.

-- 9.1 profile creation --------------------------------------------------------
-- Always inserts 'Player'. raw_user_meta_data is intentionally NOT read:
-- a blocked metadata name must not fail signup (review note 3). The real name
-- is set later by the client's column-granted update, which goes through the
-- profanity + length checks.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Player');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- D3: university_id set-once lock ----------------------------------------------
create or replace function public.lock_university_id()
returns trigger language plpgsql as $$
begin
  if old.university_id is not null
     and new.university_id is distinct from old.university_id
     and current_user in ('anon', 'authenticated') then
    raise exception 'university_id cannot be changed once set';
  end if;
  return new;
end $$;

create trigger profiles_lock_university_id
  before update of university_id on public.profiles
  for each row execute function public.lock_university_id();

-- D11: display_name profanity check --------------------------------------------
-- SECURITY DEFINER so it can read profanity_blocklist, which has no client
-- grants. Word-boundary matching (\m/\M — NOT \b, which is backspace in
-- Postgres regex) avoids most substring false positives (e.g. 'class').
create or replace function public.profiles_check_display_name()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text := lower(btrim(new.display_name));
begin
  if exists (
    select 1
      from public.profanity_blocklist b
     where v_name ~*
       ('\m' || regexp_replace(b.term, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M')
  ) then
    raise exception 'display_name is not allowed';
  end if;
  return new;
end $$;

create trigger profiles_check_display_name
  before insert or update of display_name on public.profiles
  for each row execute function public.profiles_check_display_name();

-- every university always has a university_points row --------------------------
create or replace function public.universities_insert_points_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.university_points (university_id)
  values (new.id)
  on conflict (university_id) do nothing;
  return new;
end $$;

create trigger universities_insert_points_row
  after insert on public.universities
  for each row execute function public.universities_insert_points_row();

-- backfill for any rows created before the trigger existed
insert into public.university_points (university_id)
select id from public.universities
on conflict (university_id) do nothing;

-- America/New_York boundary helper (D5 caps, D6 resets, D7 puzzle date) ---------
create or replace function public.ny_date(p_ts timestamptz default now())
returns date language sql stable set search_path = '' as $$
  select (p_ts at time zone 'America/New_York')::date
$$;

-- D7: shared daily Wordle answer, lazily materialized ---------------------------
create or replace function public.ensure_wordle_daily(p_date date)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_answer text;
begin
  select answer into v_answer
    from public.wordle_daily where puzzle_date = p_date;
  if found then return v_answer; end if;

  -- pick a random answer word not used in the last 30 days; on conflict keeps
  -- concurrent first calls consistent (loser falls through to the select below)
  insert into public.wordle_daily (puzzle_date, answer)
  select p_date, w.word
    from public.wordle_words w
   where w.is_answer
     and not exists (
       select 1 from public.wordle_daily d
        where d.answer = w.word and d.puzzle_date > p_date - 30
     )
   order by random()
   limit 1
  on conflict (puzzle_date) do nothing;

  select answer into v_answer
    from public.wordle_daily where puzzle_date = p_date;
  if found then return v_answer; end if;

  -- exclusion left no candidates (dev list is small): ignore it
  insert into public.wordle_daily (puzzle_date, answer)
  select p_date, w.word
    from public.wordle_words w
   where w.is_answer
   order by random()
   limit 1
  on conflict (puzzle_date) do nothing;

  select answer into v_answer
    from public.wordle_daily where puzzle_date = p_date;
  if not found then
    raise exception 'no wordle answer words available';
  end if;
  return v_answer;
end $$;

-- D6: weekly/monthly resets at 00:00 America/New_York, exactly once per period --
-- Called by daily pg_cron jobs at 04:00 and 05:00 UTC (covers EST and EDT).
-- reset_state makes each period reset exactly once; a missed run catches up at
-- the next 00:00 NY boundary because last_*_reset stays behind.
create or replace function public.reset_periodic_points(p_now timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_ny timestamp := p_now at time zone 'America/New_York';
  v_week date := date_trunc('week', v_ny)::date;
  v_month date := date_trunc('month', v_ny)::date;
  v_did boolean;
begin
  if extract(hour from v_ny) <> 0 then
    return; -- not at a New York midnight boundary
  end if;

  update public.reset_state
     set last_weekly_reset = v_week
   where id = true and last_weekly_reset < v_week
  returning true into v_did;
  if v_did then
    update public.university_points
       set weekly_points = 0, updated_at = now();
  end if;

  update public.reset_state
     set last_monthly_reset = v_month
   where id = true and last_monthly_reset < v_month
  returning true into v_did;
  if v_did then
    update public.university_points
       set monthly_points = 0, updated_at = now();
  end if;
end $$;

-- 9.3 atomic point award (service role only) ------------------------------------
-- Deviation from the PRD text (approved): the award is clamped to
-- greatest(least(p_points, games.max_points), 0), and the daily scored-play
-- cap (D5) is enforced here — if the user already has daily_scored_limit OTHER
-- completed sessions for this game on the same NY date as this session's
-- start, the award is 0 and the session gets the 'daily_cap' flag.
create or replace function public.finalize_game_session(
  p_session_id uuid,
  p_score int,
  p_points int,
  p_duration_ms int,
  p_result jsonb,
  p_flags text[] default '{}'
) returns table (user_points bigint, university_total bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_uni uuid;
  v_game uuid;
  v_started timestamptz;
  v_max int;
  v_limit int;
  v_completed int;
  v_award int;
  v_points bigint;
  v_total bigint := 0;
begin
  -- one-shot guard: flip started -> completed exactly once
  update public.game_sessions
     set status = 'completed', submitted_at = now(), score = p_score,
         duration_ms = p_duration_ms, raw_result = p_result, flags = p_flags
   where id = p_session_id and status = 'started'
  returning user_id, game_id, started_at into v_user, v_game, v_started;

  if v_user is null then
    raise exception 'session not found or already submitted';
  end if;

  -- serialize finalization per (user, game) so the cap check is race-safe
  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || v_game::text, 42));

  select g.max_points, g.daily_scored_limit into v_max, v_limit
    from public.games g where g.id = v_game;

  v_award := greatest(least(p_points, v_max), 0);

  select count(*) into v_completed
    from public.game_sessions s
   where s.user_id = v_user
     and s.game_id = v_game
     and s.id <> p_session_id
     and s.status = 'completed'
     and public.ny_date(s.started_at) = public.ny_date(v_started);

  if v_completed >= v_limit then
    v_award := 0;
    update public.game_sessions
       set flags = array_append(flags, 'daily_cap')
     where id = p_session_id;
  end if;

  update public.game_sessions
     set points_awarded = v_award
   where id = p_session_id;

  update public.profiles set points = points + v_award
   where id = v_user
  returning points, university_id into v_points, v_uni;

  if v_uni is not null then
    insert into public.university_points
      (university_id, total_points, weekly_points, monthly_points)
    values (v_uni, v_award, v_award, v_award)
    on conflict (university_id) do update
      set total_points   = university_points.total_points   + v_award,
          weekly_points  = university_points.weekly_points  + v_award,
          monthly_points = university_points.monthly_points + v_award,
          updated_at = now()
    returning total_points into v_total;
  end if;

  return query select v_points, v_total;
end $$;

-- push token registration (token follows the device, not the user) --------------
create or replace function public.register_push_token(
  p_expo_token text,
  p_platform text
) returns public.push_tokens
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.push_tokens;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_expo_token is null
     or p_expo_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'invalid Expo push token';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform';
  end if;

  insert into public.push_tokens (user_id, expo_token, platform)
  values (v_uid, p_expo_token, p_platform)
  on conflict (expo_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform
  returning * into v_row;
  return v_row;
end $$;

-- execute privileges: revoke everything, grant only what is needed --------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.lock_university_id() from public, anon, authenticated;
revoke execute on function public.profiles_check_display_name() from public, anon, authenticated;
revoke execute on function public.universities_insert_points_row() from public, anon, authenticated;
revoke execute on function public.ny_date(timestamptz) from public, anon, authenticated;
revoke execute on function public.ensure_wordle_daily(date) from public, anon, authenticated;
revoke execute on function public.reset_periodic_points(timestamptz) from public, anon, authenticated;
revoke execute on function public.finalize_game_session(uuid,int,int,int,jsonb,text[]) from public, anon, authenticated;
revoke execute on function public.register_push_token(text,text) from public, anon, authenticated;

grant execute on function public.finalize_game_session(uuid,int,int,int,jsonb,text[]) to service_role;
grant execute on function public.ensure_wordle_daily(date) to service_role;
grant execute on function public.reset_periodic_points(timestamptz) to service_role;
grant execute on function public.ny_date(timestamptz) to service_role;
grant execute on function public.register_push_token(text,text) to authenticated;
