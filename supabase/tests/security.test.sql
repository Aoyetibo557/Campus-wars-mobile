-- Security matrix: RLS, grants, column-level restrictions, RPC access.
-- Runs as the postgres superuser; `set local role` simulates clients.

create extension if not exists pgtap;

begin;
select plan(54);

-- fixtures ---------------------------------------------------------------
do $$
declare
  a uuid; b uuid; u1 uuid; u2 uuid; g uuid; s1 uuid; s2 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'alice@dev.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now())
  returning id into a;

  insert into auth.users (id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'bob@dev.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now())
  returning id into b;

  insert into public.universities (name, short_name, country, state)
    values ('Test University', 'TU', 'US', 'VA') returning id into u1;
  insert into public.universities (name) values ('Other University')
    returning id into u2;

  update public.profiles set university_id = u1 where id = a;

  select id into g from public.games where slug = 'wordle';

  insert into public.game_sessions (user_id, game_id, seed)
    values (a, g, 'seed-a') returning id into s1;
  insert into public.game_sessions (user_id, game_id, seed)
    values (b, g, 'seed-b') returning id into s2;

  perform set_config('test.alice', a::text, true);
  perform set_config('test.bob',   b::text, true);
  perform set_config('test.uni1',  u1::text, true);
  perform set_config('test.uni2',  u2::text, true);
end $$;

-- == act as alice (authenticated) ==
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.alice'),
                    'role', 'authenticated')::text, true);
set local role authenticated;

-- allowed reads
select lives_ok('select id from public.universities limit 1', 'auth reads universities');
select lives_ok('select id from public.games limit 1', 'auth reads games');
select lives_ok('select university_id from public.university_points limit 1', 'auth reads university_points');
select lives_ok('select id from public.profiles limit 1', 'auth reads profiles');
select lives_ok(
  'select id, user_id, game_id, status, started_at, submitted_at, duration_ms, score, points_awarded from public.game_sessions limit 1',
  'auth reads safe session columns');

-- row isolation
select is((select count(*) from public.game_sessions), 1::bigint,
  'alice sees only her own session');
select is((select count(*) from public.game_sessions
            where user_id = current_setting('test.bob')::uuid), 0::bigint,
  'alice cannot see bob''s session');

-- hidden columns
select throws_ok('select seed from public.game_sessions limit 1', null,
  'seed column hidden');
select throws_ok('select raw_result from public.game_sessions limit 1', null,
  'raw_result column hidden');
select throws_ok('select flags from public.game_sessions limit 1', null,
  'flags column hidden');
select throws_ok('select client_info from public.game_sessions limit 1', null,
  'client_info column hidden');
select throws_ok('select * from public.game_sessions limit 1', null,
  'select(*) on game_sessions fails (column-grant)');

-- forbidden tables entirely
select throws_ok('select id from public.trivia_questions limit 1', null,
  'trivia_questions unreadable');
select throws_ok('select word from public.wordle_words limit 1', null,
  'wordle_words unreadable');
select throws_ok('select answer from public.wordle_daily limit 1', null,
  'wordle_daily unreadable');
select throws_ok('select term from public.profanity_blocklist limit 1', null,
  'profanity_blocklist unreadable');
select throws_ok('select id from public.reset_state limit 1', null,
  'reset_state unreadable');

-- forbidden writes
select throws_ok(
  'update public.profiles set points = 999 where id = ''' || current_setting('test.alice') || '''',
  null, 'cannot update profiles.points');
select throws_ok(
  'insert into public.profiles (id, display_name) values (gen_random_uuid(), ''xx'')',
  null, 'cannot insert a profile');
select throws_ok('insert into public.game_sessions (user_id, game_id, seed) values (gen_random_uuid(), gen_random_uuid(), ''x'')',
  null, 'cannot insert game_sessions');
select throws_ok('update public.game_sessions set score = 1', null,
  'cannot update game_sessions');
select throws_ok('delete from public.game_sessions', null,
  'cannot delete game_sessions');
select throws_ok('insert into public.university_points (university_id) values (gen_random_uuid())',
  null, 'cannot insert university_points');
select throws_ok('update public.university_points set total_points = 1', null,
  'cannot update university_points');
select throws_ok('delete from public.university_points', null,
  'cannot delete university_points');

-- update someone else's profile: RLS filters silently, no error, no change
update public.profiles set display_name = 'Hacked'
  where id = current_setting('test.bob')::uuid;
select is((select display_name from public.profiles
            where id = current_setting('test.bob')::uuid), 'Player',
  'alice cannot modify bob''s profile (RLS filtered)');

-- forbidden function execution
select throws_ok(
  'select public.finalize_game_session(gen_random_uuid(), 0, 0, 0, ''{}''::jsonb)',
  null, 'authenticated cannot execute finalize_game_session');
select throws_ok(
  'select public.ensure_wordle_daily(current_date)', null,
  'authenticated cannot execute ensure_wordle_daily');
select throws_ok(
  'select public.reset_periodic_points()', null,
  'authenticated cannot execute reset_periodic_points');

-- university_id lock: alice already has a school
select throws_ok(
  'update public.profiles set university_id = ''' || current_setting('test.uni2') ||
    ''' where id = ''' || current_setting('test.alice') || '''',
  null, 'alice cannot change university once set');

-- push tokens: register + validation
select lives_ok(
  'select public.register_push_token(''ExponentPushToken[alice-device-1]'', ''ios'')',
  'alice registers a push token');
select is((select user_id from public.push_tokens
            where expo_token = 'ExponentPushToken[alice-device-1]'),
  current_setting('test.alice')::uuid, 'token belongs to alice');
select throws_ok(
  'select public.register_push_token(''not-a-token'', ''ios'')', null,
  'malformed expo token rejected');
select throws_ok(
  'select public.register_push_token(''ExponentPushToken[x]'', ''web'')', null,
  'invalid platform rejected');

-- == act as bob (authenticated) ==
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.bob'),
                    'role', 'authenticated')::text, true);
set local role authenticated;

-- university_id set-once: null -> value allowed
select lives_ok(
  'update public.profiles set university_id = ''' || current_setting('test.uni2') ||
    ''' where id = ''' || current_setting('test.bob') || '''',
  'bob sets university_id once');
select is((select university_id from public.profiles
            where id = current_setting('test.bob')::uuid),
  current_setting('test.uni2')::uuid, 'university_id was set');
select throws_ok(
  'update public.profiles set university_id = ''' || current_setting('test.uni1') ||
    ''' where id = ''' || current_setting('test.bob') || '''',
  null, 'bob cannot change it afterward');

-- token reassignment: token belongs to the device, follows it to bob
select is((select count(*) from public.push_tokens), 0::bigint,
  'bob sees no tokens yet (isolation)');
select lives_ok(
  'select public.register_push_token(''ExponentPushToken[alice-device-1]'', ''android'')',
  'bob registers same token (device changed hands)');
select is((select user_id from public.push_tokens
            where expo_token = 'ExponentPushToken[alice-device-1]'),
  current_setting('test.bob')::uuid, 'token reassigned to bob');
select is((select count(*) from public.push_tokens), 1::bigint,
  'still one token row (reassigned, not duplicated)');
select lives_ok('delete from public.push_tokens', 'bob deletes own token');
select is((select count(*) from public.push_tokens), 0::bigint,
  'token deleted');

-- display_name rules
select throws_ok('update public.profiles set display_name = ''fuck'' where id = ''' ||
  current_setting('test.bob') || '''', null, 'blocked word rejected on update');
select lives_ok('update public.profiles set display_name = ''peacock'' where id = ''' ||
  current_setting('test.bob') || '''', 'name containing a blocked substring passes');
select throws_ok('update public.profiles set display_name = ''x'' where id = ''' ||
  current_setting('test.bob') || '''', null, 'name under 2 chars rejected');
select throws_ok('update public.profiles set display_name = ''abcdefghijklmnopqrstu'' where id = ''' ||
  current_setting('test.bob') || '''', null, 'name over 20 chars rejected');

-- == service_role can do things clients cannot ==
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select lives_ok(
  'update public.profiles set university_id = ''' || current_setting('test.uni1') ||
    ''' where id = ''' || current_setting('test.bob') || '''',
  'service_role can change university_id');
select is((select university_id from public.profiles
            where id = current_setting('test.bob')::uuid),
  current_setting('test.uni1')::uuid, 'university_id updated by service_role');

-- == anon gets nothing ==
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok('select id from public.profiles limit 1', null,
  'anon cannot read profiles');
select throws_ok(
  'select public.register_push_token(''ExponentPushToken[y]'', ''ios'')', null,
  'anon cannot register push tokens');

-- == grants allowlist: any new object exposed by default fails this ==
set local role postgres;

select results_eq(
  $$
  select c.relname::text collate "C",
         acl.grantee::regrole::text collate "C",
         acl.privilege_type::text collate "C"
    from pg_class c
    cross join lateral aclexplode(c.relacl) acl
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r','v','m','p')
     and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_class'::regclass
                        and d.objid = c.oid
                        and d.refclassid = 'pg_extension'::regclass)
     and acl.grantee::regrole::text in ('anon','authenticated')
   order by 1, 2, 3
  $$,
  $$
  values
    ('games' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('profiles' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('push_tokens' collate "C",'authenticated' collate "C",'DELETE' collate "C"),
    ('push_tokens' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('universities' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('university_points' collate "C",'authenticated' collate "C",'SELECT' collate "C")
  $$,
  'table-level grants match allowlist exactly');

select results_eq(
  $$
  select (c.relname || '.' || a.attname)::text collate "C",
         acl.grantee::regrole::text collate "C",
         acl.privilege_type::text collate "C"
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    cross join lateral aclexplode(a.attacl) acl
   where c.relnamespace = 'public'::regnamespace
     and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_class'::regclass
                        and d.objid = c.oid
                        and d.refclassid = 'pg_extension'::regclass)
     and acl.grantee::regrole::text in ('anon','authenticated')
   order by 1, 2, 3
  $$,
  $$
  values
    ('game_sessions.duration_ms' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('game_sessions.game_id' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('game_sessions.id' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('game_sessions.points_awarded' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('game_sessions.score' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('game_sessions.started_at' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('game_sessions.status' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('game_sessions.submitted_at' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('game_sessions.user_id' collate "C",'authenticated' collate "C",'SELECT' collate "C"),
    ('profiles.display_name' collate "C",'authenticated' collate "C",'UPDATE' collate "C"),
    ('profiles.university_id' collate "C",'authenticated' collate "C",'UPDATE' collate "C")
  $$,
  'column-level grants match allowlist exactly');

-- functions: NULL proacl means implicit PUBLIC execute — flag those too
select results_eq(
  $$
  select p.proname::text collate "C",
         case when acl.grantee is null or acl.grantee = 0::oid then 'PUBLIC'::text
              else acl.grantee::regrole::text end collate "C" as grantee
    from pg_proc p
    left join lateral aclexplode(p.proacl) acl on true
   where p.pronamespace = 'public'::regnamespace
     and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_proc'::regclass
                        and d.objid = p.oid
                        and d.refclassid = 'pg_extension'::regclass)
     and (p.proacl is null
          or acl.grantee = 0::oid
          or acl.grantee::regrole::text in ('anon','authenticated'))
   order by 1, 2
  $$,
  $$
  values
    ('register_push_token' collate "C",'authenticated' collate "C")
  $$,
  'function execute grants match allowlist exactly');

select * from finish();
rollback;
