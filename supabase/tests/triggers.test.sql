-- Trigger behavior: handle_new_user, university lock, profanity check,
-- university_points bootstrap.

create extension if not exists pgtap;

begin;
select plan(8);

-- fixture school: listed (has email_domains) so signups against it validate
do $$
declare u uuid;
begin
  insert into public.universities (name, short_name, country, state,
    email_domains) values ('Signup School', 'SS', 'US', 'VA', '{dev.test}')
    returning id into u;
  perform set_config('test.uni', u::text, true);
end $$;

-- handle_new_user creates a profile even when metadata carries a blocked
-- display_name (metadata name is ignored; default 'Player' is used).
-- university_id metadata is required by handle_new_user (D15/D23) and must
-- match the email's school.
select lives_ok(
  format($$
    insert into auth.users (id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at, raw_app_meta_data,
      raw_user_meta_data, created_at, updated_at)
    values ('11111111-1111-1111-1111-111111111111',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'blocked@dev.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"fuck","university_id":"%s"}'::jsonb, now(), now())
  $$, current_setting('test.uni')),
  'signup succeeds even with blocked display_name in metadata');

select is(
  (select display_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'Player',
  'profile created with default ''Player'', ignoring metadata');

-- blocked display_name rejected on INSERT as well as update (the trigger
-- covers the insert path even though clients can't insert)
select throws_ok($$
  insert into public.profiles (id, display_name)
  values (gen_random_uuid(), 'fuck')
$$, null, 'blocked display_name rejected on insert');

-- a name that merely contains a blocked string inside a larger word passes
select lives_ok($$
  update public.profiles set display_name = 'peacock'
   where id = '11111111-1111-1111-1111-111111111111'
$$, 'substring-inside-word is not flagged (peacock vs cock)');

-- every new university gets a university_points row
do $$
declare u uuid;
begin
  insert into public.universities (name, short_name, country, state)
    values ('Trigger Test U', 'TTU', 'US', 'VA') returning id into u;
  perform set_config('test.uni', u::text, true);
end $$;

select is(
  (select count(*) from public.university_points
    where university_id = current_setting('test.uni')::uuid),
  1::bigint, 'university insert creates university_points row');

select is(
  (select total_points from public.university_points
    where university_id = current_setting('test.uni')::uuid),
  0::bigint, 'new university starts at 0 points (appears on leaderboard)');

-- reset_state is single-row and seeded
select is((select count(*) from public.reset_state), 1::bigint,
  'reset_state has its single row');

-- games seed exists with decided values (D5, D10)
select results_eq(
  $$ select slug::text, max_points::int, daily_scored_limit::int
       from public.games order by slug $$,
  $$ values
       ('math_speed', 150, 10),
       ('trivia',     150, 10),
       ('wordle',     100, 1) $$,
  'games seeded with D5/D10 values');

select * from finish();
rollback;
