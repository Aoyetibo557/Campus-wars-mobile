-- School verification at signup (D23), set-once-at-signup school (D3),
-- onboarding = display name only with onboarded_at marker (D25), plus the
-- one-account-per-mailbox and email-change rules.
--
-- Defense in depth: the GoTrue Before User Created hook (config.toml) gives a
-- friendly rejection; handle_new_user re-validates and RAISES, so a missing or
-- disabled hook (e.g. a hosted project where it was never configured) still
-- cannot let an unverified signup through.
--
-- All rejection messages are deliberately generic and never confirm whether an
-- account exists.

-- ── 1. schema ────────────────────────────────────────────────────────────────

-- backfill before NOT NULL
update public.universities set email_domains = '{}' where email_domains is null;

alter table public.universities
  add column website text,
  add column scorecard_unit_id integer,
  alter column email_domains set not null,
  alter column email_domains set default '{}';

create unique index universities_scorecard_unit_id_key
  on public.universities (scorecard_unit_id);

alter table public.profiles
  add column onboarded_at timestamptz;   -- set once by complete_onboarding (D25)

-- ── 2. shared helpers ────────────────────────────────────────────────────────

-- A school email domain entry must be a bare lowercase hostname.
-- Rejects uppercase, whitespace, '@', empty strings, and leading/trailing dots.
create or replace function public.email_domains_valid(p_domains text[])
returns boolean language sql immutable set search_path = '' as $$
  select not exists (
    select 1
      from unnest(p_domains) as d
     where d = ''
        or d <> lower(btrim(d))
        or d ~ '[@\s]'
        or d ~ '^\.' or d ~ '\.$'
  )
$$;

alter table public.universities
  add constraint universities_email_domains_valid
  check (public.email_domains_valid(email_domains));

-- Normalize an email to its mailbox identity: lowercase + strip the +tag from
-- the local part (D23). 'A+B@UVA.edu' -> 'a@uva.edu'.
create or replace function public.normalize_mailbox(p_email text)
returns text language sql immutable set search_path = '' as $$
  select case
           when position('@' in p_email) = 0 then null
           else lower(
                  split_part(split_part(btrim(p_email), '@', 1), '+', 1)
                  || '@' || split_part(btrim(p_email), '@', -1))
         end
$$;

-- True when the email's domain equals a school domain or is a subdomain of it
-- (dot boundary — right()/length(), not LIKE, so 'evilvirginia.edu' and
-- 'virginia.edu.evil.com' both fail).
create or replace function public.email_domain_matches(
  p_email text, p_domains text[]
) returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v_domain text;
begin
  if p_email is null or position('@' in p_email) = 0 then
    return false;
  end if;
  v_domain := lower(btrim(split_part(btrim(p_email), '@', -1)));
  return exists (
    select 1
      from unnest(p_domains) as d
     where v_domain = lower(btrim(d))
        or (length(v_domain) > length(lower(btrim(d)))
            and right(v_domain, length(lower(btrim(d))) + 1)
                = '.' || lower(btrim(d)))
  );
end $$;

-- One shared validation + one shared message. NULL means "allowed"; any
-- non-null return is THE friendly rejection (never reveals why or whether the
-- mailbox already has an account).
create or replace function public.signup_school_error(
  p_email text, p_university_id text
) returns text language plpgsql stable security definer
  set search_path = '' as $$
declare
  c_msg  constant text :=
    'That email can''t be used to sign up for this school.';
  v_uid  uuid;
  v_uni  public.universities%rowtype;
begin
  if p_university_id is null
     or p_university_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return c_msg;
  end if;
  v_uid := p_university_id::uuid;

  select * into v_uni from public.universities where id = v_uid;
  if not found or cardinality(v_uni.email_domains) = 0 then
    return c_msg;              -- missing or unlisted school
  end if;
  if not public.email_domain_matches(p_email, v_uni.email_domains) then
    return c_msg;              -- email domain doesn't match the school
  end if;
  return null;
end $$;

revoke execute on function public.email_domains_valid(text[])
  from public, anon, authenticated;
revoke execute on function public.normalize_mailbox(text)
  from public, anon, authenticated;
revoke execute on function public.email_domain_matches(text, text[])
  from public, anon, authenticated;
revoke execute on function public.signup_school_error(text, text)
  from public, anon, authenticated;

-- ── 3. one account per mailbox, registered only at confirmation ──────────────
-- Unverified signups never claim a mailbox, so squatting on someone else's
-- normalized address is impossible and the signup hook can't leak which
-- mailboxes are taken (it doesn't check the registry at all).

create table public.mailbox_registry (
  normalized_email text primary key,
  user_id          uuid not null unique references auth.users(id)
                     on delete cascade,
  created_at       timestamptz default now()
);

alter table public.mailbox_registry enable row level security;
revoke all on public.mailbox_registry from anon, authenticated;

create or replace function public.mailbox_registry_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_norm  text;
  v_owner uuid;
begin
  -- nothing relevant changed
  if tg_op = 'UPDATE'
     and new.email is not distinct from old.email
     and new.email_confirmed_at is not distinct from old.email_confirmed_at then
    return new;
  end if;

  -- only confirmed emails occupy a mailbox
  if new.email_confirmed_at is null then
    return new;
  end if;

  v_norm := public.normalize_mailbox(new.email);
  if v_norm is null then
    return new;
  end if;

  select user_id into v_owner
    from public.mailbox_registry
   where normalized_email = v_norm;
  if v_owner is not null and v_owner <> new.id then
    raise exception
      'This school email is already linked to an account. Try logging in instead.';
  end if;

  insert into public.mailbox_registry (normalized_email, user_id)
  values (v_norm, new.id)
  on conflict (user_id) do update
    set normalized_email = excluded.normalized_email;
  return new;
end $$;

create trigger auth_users_mailbox_registry
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.mailbox_registry_sync();

revoke execute on function public.mailbox_registry_sync()
  from public, anon, authenticated;

-- ── 4. Before User Created hook (configured in config.toml) ──────────────────
-- SECURITY DEFINER so supabase_auth_admin needs only EXECUTE.
-- Payload: event.user.email + event.user.user_metadata.university_id.

create or replace function public.before_user_created_hook(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_err text;
begin
  v_err := public.signup_school_error(
    event -> 'user' ->> 'email',
    event -> 'user' -> 'user_metadata' ->> 'university_id'
  );
  if v_err is not null then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 400, 'message', v_err));
  end if;
  return '{}'::jsonb;
end $$;

revoke execute on function public.before_user_created_hook(jsonb)
  from public, anon, authenticated;
grant execute on function public.before_user_created_hook(jsonb)
  to supabase_auth_admin;

-- ── 5. handle_new_user: re-validate, then write school (D15 amended, D3) ─────
-- Still never reads a display name from metadata. Now reads university_id,
-- re-validates it against the email, and RAISES on failure — which aborts the
-- auth.users insert even if the hook was never configured (hosted) or is off.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid_meta text;
  v_err      text;
begin
  v_uid_meta := new.raw_user_meta_data ->> 'university_id';
  v_err := public.signup_school_error(new.email, v_uid_meta);
  if v_err is not null then
    raise exception '%', v_err;
  end if;
  insert into public.profiles (id, display_name, university_id)
  values (new.id, 'Player', v_uid_meta::uuid);
  return new;
end $$;

-- ── 6. email changes must still match the school + mailbox rule ──────────────

create or replace function public.enforce_school_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uni   uuid;
  v_err   text;
  v_norm  text;
  v_owner uuid;
begin
  if new.email is not distinct from old.email then
    return new;
  end if;

  select university_id into v_uni
    from public.profiles where id = new.id;

  -- a null university_id fails validation: fail closed
  v_err := public.signup_school_error(new.email, v_uni::text);
  if v_err is not null then
    raise exception '%', v_err;
  end if;

  v_norm := public.normalize_mailbox(new.email);
  select user_id into v_owner
    from public.mailbox_registry
   where normalized_email = v_norm;
  if v_owner is not null and v_owner <> new.id then
    raise exception
      'This school email is already linked to an account. Try logging in instead.';
  end if;
  return new;
end $$;

create trigger auth_users_enforce_school_email_change
  before update of email on auth.users
  for each row execute function public.enforce_school_email_change();

revoke execute on function public.enforce_school_email_change()
  from public, anon, authenticated;

-- ── 7. complete_onboarding (D25) ─────────────────────────────────────────────
-- Sets the display name (existing check constraint + profanity trigger run)
-- and stamps onboarded_at once. Repeat calls may update the name but never
-- move onboarded_at.

create or replace function public.complete_onboarding(p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles
     set display_name = btrim(p_display_name),
         onboarded_at = coalesce(onboarded_at, now())
   where id = v_uid;
  if not found then
    raise exception 'profile not found';
  end if;
end $$;

revoke execute on function public.complete_onboarding(text)
  from public, anon;
grant execute on function public.complete_onboarding(text) to authenticated;

-- ── 8. grants and policies ───────────────────────────────────────────────────

-- universities: the signup picker runs pre-auth, so anon reads the same safe
-- columns as authenticated — but only LISTED schools (>= 1 email domain).
-- email_domains is deliberately public (D23: the sign-up screen needs it for
-- the domain hint + inline check). Hidden from all clients: website,
-- scorecard_unit_id, created_at.
revoke select on public.universities from authenticated;
grant select (id, name, short_name, state, country, email_domains)
  on public.universities to anon, authenticated;

drop policy "read universities" on public.universities;
create policy "read listed universities" on public.universities
  for select to anon, authenticated
  using (cardinality(email_domains) > 0);

-- D3 (amended): school is set by handle_new_user at signup; clients can no
-- longer write it at all. The lock_university_id trigger stays as defense in
-- depth for client roles.
revoke update (university_id) on public.profiles from authenticated;
