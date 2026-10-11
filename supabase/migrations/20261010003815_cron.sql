-- Weekly/monthly reset scheduling (D6).
-- pg_cron schedules run in UTC; New York is UTC-4 (EDT) or UTC-5 (EST).
-- Two daily jobs at 04:00 and 05:00 UTC guarantee a run lands on 00:00 NY in
-- both offsets; reset_periodic_points() no-ops unless it is NY midnight.
-- Named schedules are idempotent across `supabase db reset`.

create extension if not exists pg_cron;

select cron.schedule('ny-point-resets-0400', '0 4 * * *',
  $$select public.reset_periodic_points()$$);
select cron.schedule('ny-point-resets-0500', '0 5 * * *',
  $$select public.reset_periodic_points()$$);
