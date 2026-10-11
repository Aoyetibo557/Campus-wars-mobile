-- Verify the pg_cron jobs themselves, not just reset_periodic_points (D6, D16).

create extension if not exists pgtap;

begin;
select plan(3);

select results_eq(
  $$
  select jobname::text collate "C", schedule::text collate "C"
    from cron.job
   where jobname like 'ny-point-resets-%'
   order by jobname
  $$,
  $$
  values
    ('ny-point-resets-0400' collate "C", '0 4 * * *' collate "C"),
    ('ny-point-resets-0500' collate "C", '0 5 * * *' collate "C")
  $$,
  'two daily reset jobs at 04:00 and 05:00 UTC');

select is(
  (select count(*) from cron.job
    where command = 'select public.reset_periodic_points()'),
  2::bigint, 'both jobs call reset_periodic_points');

select ok(
  (select bool_and(
      has_function_privilege(
        j.username, 'public.reset_periodic_points(timestamptz)', 'execute'))
    from cron.job j
   where j.jobname like 'ny-point-resets-%'),
  'cron job owner is allowed to execute reset_periodic_points');

select * from finish();
rollback;
