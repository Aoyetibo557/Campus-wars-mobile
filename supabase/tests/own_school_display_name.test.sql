-- D26: a user always reads their own university, even when unlisted.
-- D27: display names with zero-width / bidi / blank-looking chars reject.
-- Runs as postgres; `set local role` simulates clients.

create extension if not exists pgtap;

begin;
select plan(14);

-- fixtures ---------------------------------------------------------------
do $$
declare
  a uuid; u1 uuid; u2 uuid; u3 uuid;
begin
  -- u1 listed; u2 + u3 unlisted. alice will be moved to u2 by hand because
  -- handle_new_user can't assign an unlisted school (domain check) — the
  -- same state a data refresh would produce.
  insert into public.universities (name, short_name, country, state,
    email_domains) values ('Listed U', 'LU', 'US', 'VA', '{dev.test}')
    returning id into u1;
  insert into public.universities (name, email_domains)
    values ('My School', '{}') returning id into u2;
  insert into public.universities (name, email_domains)
    values ('Not Mine', '{}') returning id into u3;

  insert into auth.users (id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'alice@dev.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    format('{"university_id":"%s"}', u1)::jsonb,
    now(), now())
  returning id into a;

  -- alice's school becomes unlisted
  update public.profiles set university_id = u2 where id = a;

  perform set_config('test.alice', a::text, true);
  perform set_config('test.uni1',  u1::text, true);
  perform set_config('test.uni2',  u2::text, true);
  perform set_config('test.uni3',  u3::text, true);
end $$;

-- == own-university reads as authenticated (D26) ==
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.alice'),
                    'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*) from public.universities
            where id = current_setting('test.uni2')::uuid), 1::bigint,
  'user reads their own unlisted school');
select is((select count(*) from public.universities
            where id = current_setting('test.uni3')::uuid), 0::bigint,
  'other unlisted schools stay hidden');
select is((select count(*) from public.universities
            where id = current_setting('test.uni1')::uuid), 1::bigint,
  'listed schools still readable');

-- == anon unchanged ==
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from public.universities
            where id = current_setting('test.uni2')::uuid), 0::bigint,
  'anon cannot read unlisted schools');
select is((select count(*) from public.universities
            where id = current_setting('test.uni3')::uuid), 0::bigint,
  'anon cannot read any unlisted school');

-- == display-name hygiene (D27) — trigger fires under any role ==
reset role;

select throws_ok(
  format($$update public.profiles set display_name = 'a' || chr(8203) || 'b' where id = '%s'$$,
         current_setting('test.alice')),
  'display_name contains invalid characters',
  'zero-width space (U+200B) rejected');
select throws_ok(
  format($$update public.profiles set display_name = chr(8238) || 'name' where id = '%s'$$,
         current_setting('test.alice')),
  'display_name contains invalid characters',
  'bidi override (U+202E) rejected');
select throws_ok(
  format($$update public.profiles set display_name = 'na' || chr(160) || 'me' where id = '%s'$$,
         current_setting('test.alice')),
  'display_name contains invalid characters',
  'NBSP (U+00A0) rejected');
select throws_ok(
  format($$update public.profiles set display_name = 'x' || chr(12288) || 'y' where id = '%s'$$,
         current_setting('test.alice')),
  'display_name contains invalid characters',
  'ideographic space (U+3000) rejected');
select throws_ok(
  format($$update public.profiles set display_name = 'x' || chr(65279) || 'y' where id = '%s'$$,
         current_setting('test.alice')),
  'display_name contains invalid characters',
  'BOM / ZWNBSP (U+FEFF) rejected');
select throws_ok(
  format($$update public.profiles set display_name = chr(8205) || 'a' || chr(8205) || 'b' where id = '%s'$$,
         current_setting('test.alice')),
  'display_name contains invalid characters',
  'ZWJ (U+200D) rejected — ZWJ emoji names cannot pass');
select throws_ok(
  format($$update public.profiles set display_name = chr(8203) || chr(8195) where id = '%s'$$,
         current_setting('test.alice')),
  'display_name contains invalid characters',
  'a name made of only invisible characters rejects');

select lives_ok(
  format($$update public.profiles set display_name = 'Alex' where id = '%s'$$,
         current_setting('test.alice')),
  'normal name still passes');
select lives_ok(
  format($$update public.profiles set display_name = 'Champ' || chr(127891) where id = '%s'$$,
         current_setting('test.alice')),
  'plain emoji name (U+1F393, no ZWJ/VS) still passes');

select * from finish();
rollback;
