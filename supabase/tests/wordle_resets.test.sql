-- ensure_wordle_daily and reset_periodic_points (D6, D7).

create extension if not exists pgtap;

begin;
select plan(15);

-- == wordle daily ==

select lives_ok(
  'select public.ensure_wordle_daily(''2026-10-09''::date)',
  'ensure_wordle_daily materializes an answer');
select ok(
  (select answer from public.wordle_daily where puzzle_date = '2026-10-09')
    in (select word from public.wordle_words where is_answer),
  'answer comes from the is_answer list');
select is(
  public.ensure_wordle_daily('2026-10-09'::date),
  (select answer from public.wordle_daily where puzzle_date = '2026-10-09'),
  'repeat call returns the same answer');

-- fallback: make every answer word appear in the last 30 days so the
-- exclusion leaves no candidates, then a new date still resolves
insert into public.wordle_daily (puzzle_date, answer)
select '2026-10-10'::date - (row_number() over ())::int, word
  from public.wordle_words
 where is_answer
on conflict (puzzle_date) do nothing;

select lives_ok(
  'select public.ensure_wordle_daily(''2026-10-10''::date)',
  'exclusion-exhausted date still resolves (fallback)');
select ok(
  (select answer from public.wordle_daily where puzzle_date = '2026-10-10')
    is not null,
  'fallback answer stored');

-- == weekly/monthly resets ==

-- fixture: a university with points
do $$
declare u uuid;
begin
  insert into public.universities (name, short_name) values ('Reset U', 'RU')
    returning id into u;
  update public.university_points
     set weekly_points = 50, monthly_points = 50, total_points = 50
   where university_id = u;
  perform set_config('test.ru', u::text, true);
  -- clean slate for the state machine. last_monthly_reset stays in October so
  -- the Oct 5 run only exercises the weekly reset.
  update public.reset_state
     set last_weekly_reset = '2026-09-28', last_monthly_reset = '2026-10-01';
end $$;

-- normal Monday boundary in EDT (UTC-4): 2026-10-05 04:00 UTC = Mon 00:00 NY
select public.reset_periodic_points('2026-10-05 04:00:00+00');
select is((select weekly_points from public.university_points
            where university_id = current_setting('test.ru')::uuid),
  0::bigint, 'weekly reset at Monday 00:00 NY (EDT)');
select is((select monthly_points from public.university_points
            where university_id = current_setting('test.ru')::uuid),
  50::bigint, 'monthly untouched on a non-1st day');
select is((select last_weekly_reset from public.reset_state),
  '2026-10-05'::date, 'reset_state records the week');

-- no double reset: put points back, run the same boundary again
update public.university_points set weekly_points = 50
  where university_id = current_setting('test.ru')::uuid;
select public.reset_periodic_points('2026-10-05 04:00:00+00');
select is((select weekly_points from public.university_points
            where university_id = current_setting('test.ru')::uuid),
  50::bigint, 'second run same week does not reset again');

-- missed Monday caught on Tuesday (catch-up): pretend last reset was last week
update public.reset_state set last_weekly_reset = '2026-09-28';
update public.university_points set weekly_points = 50
  where university_id = current_setting('test.ru')::uuid;
select public.reset_periodic_points('2026-10-06 04:00:00+00'); -- Tue 00:00 NY EDT
select is((select weekly_points from public.university_points
            where university_id = current_setting('test.ru')::uuid),
  0::bigint, 'missed Monday resets at the next midnight run');
select is((select last_weekly_reset from public.reset_state),
  '2026-10-05'::date, 'catch-up records the week start, not the run date');

-- non-midnight runs are no-ops
update public.reset_state set last_weekly_reset = '2026-09-28';
update public.university_points set weekly_points = 50
  where university_id = current_setting('test.ru')::uuid;
select public.reset_periodic_points('2026-10-05 06:00:00+00'); -- Mon 02:00 NY
select is((select weekly_points from public.university_points
            where university_id = current_setting('test.ru')::uuid),
  50::bigint, '02:00 NY run does nothing');

-- monthly reset in EST (UTC-5): 2026-12-01 05:00 UTC = Tue Dec 1, 00:00 NY.
-- Also catches the new week (Nov 30) — both resets fire.
update public.university_points set weekly_points = 50, monthly_points = 50
  where university_id = current_setting('test.ru')::uuid;
select public.reset_periodic_points('2026-12-01 05:00:00+00');
select is((select monthly_points from public.university_points
            where university_id = current_setting('test.ru')::uuid),
  0::bigint, 'monthly reset on the 1st at 00:00 NY (EST)');
select is((select weekly_points from public.university_points
            where university_id = current_setting('test.ru')::uuid),
  0::bigint, 'weekly also catches up at the same run (new week Nov 30)');
select is((select last_monthly_reset from public.reset_state),
  '2026-12-01'::date, 'monthly period recorded');

select * from finish();
rollback;
