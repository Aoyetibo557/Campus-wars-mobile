-- finalize_game_session: one-shot award, caps, daily limits, flags.

create extension if not exists pgtap;

begin;
select plan(25);

-- fixtures ---------------------------------------------------------------
do $$
declare
  a uuid := '22222222-2222-2222-2222-222222222222';
  b uuid := '33333333-3333-3333-3333-333333333333';
  u uuid; w uuid; t uuid; m uuid; s uuid;
begin
  -- listed school first: handle_new_user re-validates university_id
  -- against the email domain at insert time
  insert into public.universities (name, short_name, country, state,
    email_domains) values ('Finalize U', 'FU', 'US', 'VA', '{dev.test}')
    returning id into u;

  insert into auth.users (id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'player@dev.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    format('{"university_id":"%s"}', u)::jsonb, now(), now());
  insert into auth.users (id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at)
  values (b, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'other@dev.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    format('{"university_id":"%s"}', u)::jsonb, now(), now());

  select id into w from public.games where slug = 'wordle';
  select id into t from public.games where slug = 'trivia';
  select id into m from public.games where slug = 'math_speed';

  insert into public.game_sessions (user_id, game_id, seed)
    values (a, w, 's1') returning id into s;

  perform set_config('test.a', a::text, true);
  perform set_config('test.b', b::text, true);
  perform set_config('test.u', u::text, true);
  perform set_config('test.w', w::text, true);
  perform set_config('test.t', t::text, true);
  perform set_config('test.m', m::text, true);
  perform set_config('test.s1', s::text, true);
end $$;

-- helper to create a session for (user, game) starting at a given time
create or replace function pg_temp.mk_session(p_user uuid, p_game uuid,
                                              p_started timestamptz default now())
returns uuid language sql as $$
  insert into public.game_sessions (user_id, game_id, seed, started_at)
  values (p_user, p_game, 'seed-' || gen_random_uuid()::text, p_started)
  returning id
$$;

-- 1. happy path: wordle (limit 1/day, max 100)
select lives_ok($$
  select public.finalize_game_session(
    (current_setting('test.s1'))::uuid, 80, 80, 45000, '{"g":4}'::jsonb)
$$, 'first finalize succeeds');

select is((select status from public.game_sessions
            where id = current_setting('test.s1')::uuid),
  'completed', 'session marked completed');
select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s1')::uuid),
  80, 'points_awarded recorded');
select is((select points from public.profiles
            where id = current_setting('test.a')::uuid),
  80::bigint, 'profile points updated');
select is((select total_points from public.university_points
            where university_id = current_setting('test.u')::uuid),
  80::bigint, 'university total updated');
select is((select weekly_points from public.university_points
            where university_id = current_setting('test.u')::uuid),
  80::bigint, 'university weekly updated');

-- 2. one-shot guard: second call on same session fails
select throws_ok($$
  select public.finalize_game_session(
    (current_setting('test.s1'))::uuid, 80, 80, 45000, '{}'::jsonb)
$$, null, 'second finalize on same session fails');
select is((select points from public.profiles
            where id = current_setting('test.a')::uuid),
  80::bigint, 'points unchanged after rejected second call');

-- 3. daily cap (wordle limit=1): second completed session today -> 0 + flag
do $$
declare s2 uuid;
begin
  s2 := pg_temp.mk_session(current_setting('test.a')::uuid,
                           current_setting('test.w')::uuid);
  perform public.finalize_game_session(s2, 90, 90, 30000, '{}'::jsonb);
  perform set_config('test.s2', s2::text, true);
end $$;

select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s2')::uuid),
  0, 'over-cap session awards 0');
select ok((select 'daily_cap' = any(flags) from public.game_sessions
            where id = current_setting('test.s2')::uuid),
  'over-cap session flagged daily_cap');
select is((select points from public.profiles
            where id = current_setting('test.a')::uuid),
  80::bigint, 'cap keeps profile total unchanged');

-- 4. cap is per-game: trivia (limit 10) still awards on same day
do $$
declare s3 uuid;
begin
  s3 := pg_temp.mk_session(current_setting('test.a')::uuid,
                           current_setting('test.t')::uuid);
  perform public.finalize_game_session(s3, 50, 50, 60000, '{}'::jsonb);
  perform set_config('test.s3', s3::text, true);
end $$;

select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s3')::uuid),
  50, 'different game same day still awards');
select is((select points from public.profiles
            where id = current_setting('test.a')::uuid),
  130::bigint, 'profile total is 80+50');

-- 5. cap is per-user: bob's first wordle still awards
do $$
declare s4 uuid;
begin
  s4 := pg_temp.mk_session(current_setting('test.b')::uuid,
                           current_setting('test.w')::uuid);
  perform public.finalize_game_session(s4, 70, 70, 40000, '{}'::jsonb);
  perform set_config('test.s4', s4::text, true);
end $$;

select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s4')::uuid),
  70, 'other user unaffected by alice''s cap');

-- 6. max_points clamp: p_points above game max is capped
do $$
declare s5 uuid;
begin
  s5 := pg_temp.mk_session(current_setting('test.b')::uuid,
                           current_setting('test.t')::uuid);
  perform public.finalize_game_session(s5, 200, 999, 60000, '{}'::jsonb);
  perform set_config('test.s5', s5::text, true);
end $$;

select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s5')::uuid),
  150, 'award clamped to trivia max_points (150)');

-- 7. negative points floor at 0
do $$
declare s6 uuid;
begin
  s6 := pg_temp.mk_session(current_setting('test.b')::uuid,
                           current_setting('test.m')::uuid);
  perform public.finalize_game_session(s6, 0, -50, 60000, '{}'::jsonb);
  perform set_config('test.s6', s6::text, true);
end $$;

select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s6')::uuid),
  0, 'negative p_points floored at 0');
select is((select points from public.profiles
            where id = current_setting('test.b')::uuid),
  220::bigint, 'bob total is 70+150+0 (no negative award)');

-- 8. trivia cap boundary: 9 more completions (10 total) score, 11th gets 0
do $$
declare i int; s uuid;
begin
  for i in 1..9 loop
    s := pg_temp.mk_session(current_setting('test.a')::uuid,
                            current_setting('test.t')::uuid);
    perform public.finalize_game_session(s, 10, 10, 30000, '{}'::jsonb);
  end loop;
end $$;

select is((select count(*) from public.game_sessions
            where user_id = current_setting('test.a')::uuid
              and game_id = current_setting('test.t')::uuid
              and status = 'completed'
              and points_awarded > 0),
  10::bigint, 'first 10 trivia sessions all scored');

do $$
declare s uuid;
begin
  s := pg_temp.mk_session(current_setting('test.a')::uuid,
                          current_setting('test.t')::uuid);
  perform public.finalize_game_session(s, 100, 100, 30000, '{}'::jsonb);
  perform set_config('test.s11', s::text, true);
end $$;

select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s11')::uuid),
  0, '11th trivia session scores 0 at the cap');
select ok((select 'daily_cap' = any(flags) from public.game_sessions
            where id = current_setting('test.s11')::uuid),
  'cap flag on the 11th session');

-- 9. a new NY day resets the count: session started "tomorrow" scores again
do $$
declare s uuid;
begin
  s := pg_temp.mk_session(current_setting('test.a')::uuid,
                          current_setting('test.w')::uuid,
                          now() + interval '2 days');
  perform public.finalize_game_session(s, 60, 60, 30000, '{}'::jsonb);
  perform set_config('test.s_next_day', s::text, true);
end $$;

select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s_next_day')::uuid),
  60, 'session on a new NY day scores despite today''s cap');

-- 10. cap day = started_at's NY date, not submitted_at's (D12).
-- EDT fixtures: 2031-06-10 03:55 UTC = Jun 9 23:55 NY; 04:05 UTC = Jun 10 00:05 NY.
do $$
declare s_prior uuid; s_late uuid; s_next uuid;
begin
  -- a completed session earlier on Jun 9 (NY) uses the day's wordle slot
  s_prior := pg_temp.mk_session(current_setting('test.a')::uuid,
    current_setting('test.w')::uuid, '2031-06-09 16:00:00+00'); -- Jun 9 12:00 NY
  perform public.finalize_game_session(s_prior, 40, 40, 30000, '{}'::jsonb);
  perform set_config('test.s_prior', s_prior::text, true);

  -- started 23:55 NY on Jun 9, finalized after midnight -> still Jun 9's cap
  s_late := pg_temp.mk_session(current_setting('test.a')::uuid,
    current_setting('test.w')::uuid, '2031-06-10 03:55:00+00'); -- Jun 9 23:55 NY
  perform public.finalize_game_session(s_late, 90, 90, 30000, '{}'::jsonb);
  perform set_config('test.s_late', s_late::text, true);

  -- started just after midnight on Jun 10 (NY): new day, cap untouched
  s_next := pg_temp.mk_session(current_setting('test.a')::uuid,
    current_setting('test.w')::uuid, '2031-06-10 04:05:00+00'); -- Jun 10 00:05 NY
  perform public.finalize_game_session(s_next, 55, 55, 30000, '{}'::jsonb);
  perform set_config('test.s_next', s_next::text, true);
end $$;

select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s_prior')::uuid),
  40, 'baseline Jun-9 session scored');
select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s_late')::uuid),
  0, 'session started 23:55 NY counts toward its START day (capped)');
select ok((select 'daily_cap' = any(flags) from public.game_sessions
            where id = current_setting('test.s_late')::uuid),
  'late-finalized session flagged daily_cap');
select is((select points_awarded from public.game_sessions
            where id = current_setting('test.s_next')::uuid),
  55, 'the capped session did not consume the next NY day''s cap');

select * from finish();
rollback;
