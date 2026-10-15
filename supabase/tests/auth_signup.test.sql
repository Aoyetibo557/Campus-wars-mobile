-- D23/D25: signup hook, domain matching, mailbox registry, email changes,
-- complete_onboarding. Runs as postgres; `set local role` simulates roles.

create extension if not exists pgtap;

begin;
select plan(53);

-- fixtures ---------------------------------------------------------------
-- dev.test = listed single-domain school; dual.test school has two domains;
-- unlisted.test school has none (hidden, not signuppable).
do $$
declare l uuid; d uuid; n uuid;
begin
  insert into public.universities (name, short_name, country, state, email_domains)
    values ('Listed U', 'LU', 'US', 'VA', '{dev.test}') returning id into l;
  insert into public.universities (name, short_name, country, state, email_domains)
    values ('Dual U', 'DU', 'US', 'NY', '{dual.test,eng.dual.test}')
    returning id into d;
  insert into public.universities (name, short_name, country, state, email_domains)
    values ('Unlisted U', 'UU', 'US', 'CA', '{}') returning id into n;
  perform set_config('test.listed', l::text, true);
  perform set_config('test.dual',   d::text, true);
  perform set_config('test.unlist', n::text, true);
end $$;

-- == hook ==
-- `set role supabase_auth_admin` isn't permitted in the pgTAP container,
-- so we (a) assert the EXECUTE grant directly and (b) run the function
-- here — it's SECURITY DEFINER, so the invoker only needs EXECUTE. The
-- real GoTrue invocation as supabase_auth_admin is covered by
-- scripts/mailpit-auth-e2e.mjs (rejected + accepted signups).
select ok(has_function_privilege('supabase_auth_admin',
  'public.before_user_created_hook(jsonb)', 'EXECUTE'),
  'supabase_auth_admin can execute the hook');

-- accepts
select is(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@dev.test',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.listed'))))),
  '{}'::jsonb, 'hook accepts exact domain');
select is(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@cs.dev.test',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.listed'))))),
  '{}'::jsonb, 'hook accepts subdomain');
select is(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','A@DEV.TEST',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.listed'))))),
  '{}'::jsonb, 'hook accepts uppercase email');
select is(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@dual.test',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.dual'))))),
  '{}'::jsonb, 'dual-domain school: first domain');
select is(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@eng.dual.test',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.dual'))))),
  '{}'::jsonb, 'dual-domain school: second domain');

-- rejects: every failure returns the error object (http_code 400)
select ok(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@other.test',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.listed')))))
  -> 'error' is not null, 'rejects another school''s domain');
select ok(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@evildev.test',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.listed')))))
  -> 'error' is not null, 'rejects lookalike evildev.test');
select ok(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@dev.test.evil.com',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.listed')))))
  -> 'error' is not null, 'rejects dev.test.evil.com');
select ok(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@gmail.com',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.listed')))))
  -> 'error' is not null, 'rejects gmail.com');
select ok(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@dev.test',
    'user_metadata', '{}'::jsonb)))
  -> 'error' is not null, 'rejects missing university_id');
select ok(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@dev.test',
    'user_metadata', jsonb_build_object('university_id','not-a-uuid'))))
  -> 'error' is not null, 'rejects malformed university_id');
select ok(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@unlisted.test',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.unlist')))))
  -> 'error' is not null, 'rejects unlisted school');
select ok(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@dev.test',
    'user_metadata', jsonb_build_object('university_id', gen_random_uuid()))))
  -> 'error' is not null, 'rejects nonexistent university_id');

-- rejection message is friendly and never reveals the reason
select is(public.before_user_created_hook(
  jsonb_build_object('user', jsonb_build_object('email','a@gmail.com',
    'user_metadata', jsonb_build_object('university_id', current_setting('test.listed')))))
  -> 'error' ->> 'message',
  'That email can''t be used to sign up for this school.',
  'generic rejection message (no enumeration)');

-- == email_domain_matches unit checks (right()/length() boundary) ==
select ok(public.email_domain_matches('a@dev.test', '{dev.test}'), 'exact match');
select ok(public.email_domain_matches('a@x.dev.test', '{dev.test}'), 'subdomain match');
select ok(not public.email_domain_matches('a@evildev.test', '{dev.test}'),
  'no dot boundary = no match');
select ok(not public.email_domain_matches('a@dev.test.evil.com', '{dev.test}'),
  'suffix-attached lookalike rejected');
select ok(not public.email_domain_matches('not-an-email', '{dev.test}'),
  'missing @ rejected');

-- == email_domains format CHECK ==
select throws_ok($$
  insert into public.universities (name, email_domains) values ('Bad1','{DEV.TEST}')
$$, null, 'uppercase domain entry rejected');
select throws_ok($$
  insert into public.universities (name, email_domains) values ('Bad2','{a@b.edu}')
$$, null, '@ inside domain rejected');
select throws_ok($$
  insert into public.universities (name, email_domains) values ('Bad3','{bad domain.edu}')
$$, null, 'space inside domain rejected');
select throws_ok($$
  insert into public.universities (name, email_domains) values ('Bad4','{.edu}')
$$, null, 'leading dot rejected');
select throws_ok($$
  insert into public.universities (name, email_domains) values ('Bad5','{edu.}')
$$, null, 'trailing dot rejected');
select throws_ok($$
  insert into public.universities (name, email_domains) values ('Bad6','{""}')
$$, null, 'empty domain entry rejected');
select lives_ok($$
  insert into public.universities (name, email_domains) values ('Good','{a.edu,b.edu}')
$$, 'clean multi-domain array accepted');

-- == fail closed without the hook: handle_new_user re-validates ==
select throws_ok($$
  insert into auth.users (id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'noschool@dev.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now())
$$, null, 'direct insert with no university_id aborts (fail closed)');

select throws_ok(
  format($$
    insert into auth.users (id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at, raw_app_meta_data,
      raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'wrong@other.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"university_id":"%s"}'::jsonb, now(), now())
  $$, current_setting('test.listed')),
  null, 'direct insert with mismatched school aborts (fail closed)');

select throws_ok(
  format($$
    insert into auth.users (id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at, raw_app_meta_data,
      raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'x@unlisted.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"university_id":"%s"}'::jsonb, now(), now())
  $$, current_setting('test.unlist')),
  null, 'direct insert for unlisted school aborts');

select lives_ok(
  format($$
    insert into auth.users (id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at, raw_app_meta_data,
      raw_user_meta_data, created_at, updated_at)
    values ('44444444-4444-4444-4444-444444444444',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'owner@dev.test', '', null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"university_id":"%s"}'::jsonb, now(), now())
  $$, current_setting('test.listed')),
  'valid signup inserts (unconfirmed)');

select is((select university_id from public.profiles
            where id = '44444444-4444-4444-4444-444444444444'),
  current_setting('test.listed')::uuid, 'profile carries university_id');

-- == mailbox registry: only confirmed emails occupy mailboxes ==

select is((select count(*) from public.mailbox_registry), 0::bigint,
  'unconfirmed signup does not claim a mailbox');

-- an unverified +tag alias does not block the real owner either
select lives_ok(
  format($$
    insert into auth.users (id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at, raw_app_meta_data,
      raw_user_meta_data, created_at, updated_at)
    values ('55555555-5555-5555-5555-555555555555',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'owner+alias@dev.test', '', null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"university_id":"%s"}'::jsonb, now(), now())
  $$, current_setting('test.listed')),
  'unverified alias signup is allowed (no mailbox squatting)');

-- real owner confirms -> claims mailbox
select lives_ok($$
  update auth.users set email_confirmed_at = now()
   where id = '44444444-4444-4444-4444-444444444444'
$$, 'owner confirmation succeeds');

select is((select user_id from public.mailbox_registry
            where normalized_email = 'owner@dev.test'),
  '44444444-4444-4444-4444-444444444444'::uuid,
  'mailbox registered to the confirmed owner');

-- alias tries to confirm -> collision -> friendly error
select throws_ok($$
  update auth.users set email_confirmed_at = now()
   where id = '55555555-5555-5555-5555-555555555555'
$$, 'This school email is already linked to an account. Try logging in instead.',
  'alias confirmation rejected with friendly message');

select is((select email_confirmed_at from auth.users
            where id = '55555555-5555-5555-5555-555555555555'),
  null::timestamptz, 'alias stays unconfirmed');

-- == email changes (BEFORE UPDATE trigger) ==

-- change to a free mailbox at the same school: allowed, registry follows
select lives_ok($$
  update auth.users set email = 'owner2@dev.test'
   where id = '44444444-4444-4444-4444-444444444444'
$$, 'same-school email change allowed');

select is((select normalized_email from public.mailbox_registry
            where user_id = '44444444-4444-4444-4444-444444444444'),
  'owner2@dev.test', 'registry follows the confirmed email change');

-- to another school's domain: rejected
select throws_ok($$
  update auth.users set email = 'owner2@other.test'
   where id = '44444444-4444-4444-4444-444444444444'
$$, null, 'email change to non-school domain rejected');

-- no-op update (email unchanged): early return, never raises
select lives_ok($$
  update auth.users set email_confirmed_at = now()
   where id = '44444444-4444-4444-4444-444444444444'
$$, 'no-op update early-returns');

-- deleting the user frees the mailbox (FK cascade)
select lives_ok($$
  delete from auth.users where id = '44444444-4444-4444-4444-444444444444'
$$, 'user delete succeeds');
select is((select count(*) from public.mailbox_registry
            where user_id = '44444444-4444-4444-4444-444444444444'),
  0::bigint, 'mailbox freed on user delete');

-- == complete_onboarding (D25) ==

do $$
begin
  insert into auth.users (id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at)
  values ('66666666-6666-6666-6666-666666666666',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'onboard@dev.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    format('{"university_id":"%s"}', current_setting('test.listed'))::jsonb,
    now(), now());
end $$;

-- unauthenticated caller is rejected before touching anything
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok('select public.complete_onboarding(''RiverOtter'')', null,
  'no auth.uid() -> not authenticated');

select set_config('request.jwt.claims',
  json_build_object('sub', '66666666-6666-6666-6666-666666666666',
                    'role', 'authenticated')::text, true);

select lives_ok('select public.complete_onboarding(''RiverOtter'')',
  'complete_onboarding sets the name');
select is((select display_name from public.profiles
            where id = '66666666-6666-6666-6666-666666666666'),
  'RiverOtter', 'display_name stored');
select isnt((select onboarded_at from public.profiles
              where id = '66666666-6666-6666-6666-666666666666'),
  null, 'onboarded_at stamped');

select throws_ok('select public.complete_onboarding(''fuck'')', null,
  'blocked name rejected via existing profanity trigger');
select throws_ok('select public.complete_onboarding(''x'')', null,
  'under-2 name rejected via check constraint');

set local role postgres;
select set_config('test.ob_at',
  (select onboarded_at::text from public.profiles
    where id = '66666666-6666-6666-6666-666666666666'), true);
set local role authenticated;
select lives_ok('select public.complete_onboarding(''BlueFox'')',
  'second call may update the name');
set local role postgres;
select is((select display_name from public.profiles
            where id = '66666666-6666-6666-6666-666666666666'),
  'BlueFox', 'name updated on second call');
select is((select onboarded_at::text from public.profiles
            where id = '66666666-6666-6666-6666-666666666666'),
  current_setting('test.ob_at'), 'onboarded_at does not move');

select * from finish();
rollback;
