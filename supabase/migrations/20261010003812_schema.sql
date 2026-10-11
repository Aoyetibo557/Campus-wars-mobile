-- Schema: all tables, constraints, indexes, and real config rows.
-- RLS is enabled + granted in the following migration; nothing here grants access.

-- universities -------------------------------------------------------------
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,                     -- e.g. 'UVA'; leaderboard rows + header chip (D8)
  country text,
  state text,
  email_domains text[] default '{}',   -- reserved for post-MVP .edu verification (D4)
  created_at timestamptz default now()
);

-- profiles -----------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,          -- NOT unique (D11); profanity + length enforced by trigger/check
  university_id uuid references public.universities(id), -- set once, then locked (D3)
  points bigint not null default 0 check (points >= 0),
  created_at timestamptz default now(),
  check (char_length(btrim(display_name)) between 2 and 20)
);

-- games --------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- 'wordle', 'trivia', 'math_speed'
  name text not null,
  max_points int not null default 100 check (max_points > 0),
  daily_scored_limit int not null default 10 check (daily_scored_limit > 0),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- real config, not dev seed (D5, D10)
insert into public.games (slug, name, max_points, daily_scored_limit) values
  ('wordle',     'Wordle',      100, 1),
  ('trivia',     'Trivia',      150, 10),
  ('math_speed', 'Speed Math',  150, 10)
on conflict (slug) do nothing;

-- game_sessions -------------------------------------------------------------
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id),
  status text not null default 'started'
    check (status in ('started','completed','rejected')),
  seed text not null,                  -- server-generated; drives puzzle/problems
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_ms int,
  score int,
  points_awarded int,
  raw_result jsonb,                    -- answers/guesses/timings as submitted
  flags text[] default '{}',           -- anti-cheat flags
  client_info jsonb                    -- app version, platform, ip hash
);

create index on public.game_sessions (user_id, started_at desc);
create index on public.game_sessions (game_id, started_at desc);

-- trivia question bank (answers never leave the server before submission) ----
create table public.trivia_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  choices jsonb not null,              -- ["A","B","C","D"]
  correct_index int not null,
  category text,
  difficulty int default 1 check (difficulty between 1 and 5),
  check (correct_index >= 0 and correct_index < jsonb_array_length(choices))
);

-- school aggregates for fast leaderboards ------------------------------------
create table public.university_points (
  university_id uuid primary key references public.universities(id),
  total_points bigint not null default 0 check (total_points >= 0),
  weekly_points bigint not null default 0 check (weekly_points >= 0),
  monthly_points bigint not null default 0 check (monthly_points >= 0),
  updated_at timestamptz default now()
);

create index on public.university_points (total_points desc);
create index on public.university_points (weekly_points desc);
create index on public.university_points (monthly_points desc);

-- push tokens -----------------------------------------------------------------
-- expo_token is globally unique: a token belongs to a device, not a user.
-- Registration goes through register_push_token() which reassigns on conflict.
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_token text unique not null,
  platform text check (platform in ('ios','android')),
  created_at timestamptz default now()
);

-- wordle ----------------------------------------------------------------------
-- shared daily puzzle (D7). wordle_daily is materialized lazily per NY date by
-- ensure_wordle_daily(); wordle_words is the candidate/validation list (dev list
-- pending O11). Neither table is client-readable.
create table public.wordle_words (
  word text primary key,
  is_answer boolean not null default false
);

create table public.wordle_daily (
  puzzle_date date primary key,        -- date in America/New_York
  answer text not null
);

-- display-name blocklist (D11). Read only by the SECURITY DEFINER check trigger.
create table public.profanity_blocklist (
  term text primary key
);

insert into public.profanity_blocklist (term) values
  ('fuck'), ('shit'), ('bitch'), ('cunt'), ('nigger'), ('nigga'),
  ('faggot'), ('whore'), ('slut'), ('asshole'), ('dick'), ('pussy'),
  ('cock'), ('bastard'), ('retard')
on conflict (term) do nothing;

-- reset bookkeeping: each NY weekly/monthly period resets exactly once ---------
create table public.reset_state (
  id boolean primary key default true check (id),
  last_weekly_reset date not null default '1970-01-05',
  last_monthly_reset date not null default '1970-01-01'
);

insert into public.reset_state (id) values (true)
on conflict (id) do nothing;

-- leaderboard-supporting index
create index on public.profiles (university_id);
create index on public.profiles (points desc);
