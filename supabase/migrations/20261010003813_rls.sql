-- RLS, grants, and fail-closed defaults.
-- Policy: revoke everything, grant only what the PRD allows.

alter table public.universities       enable row level security;
alter table public.profiles           enable row level security;
alter table public.games              enable row level security;
alter table public.game_sessions      enable row level security;
alter table public.trivia_questions   enable row level security;
alter table public.university_points  enable row level security;
alter table public.push_tokens        enable row level security;
alter table public.wordle_words       enable row level security;
alter table public.wordle_daily       enable row level security;
alter table public.profanity_blocklist enable row level security;
alter table public.reset_state        enable row level security;

-- strip the default broad grants ----------------------------------------------
revoke all on public.universities        from anon, authenticated;
revoke all on public.profiles            from anon, authenticated;
revoke all on public.games               from anon, authenticated;
revoke all on public.game_sessions       from anon, authenticated;
revoke all on public.trivia_questions    from anon, authenticated;
revoke all on public.university_points   from anon, authenticated;
revoke all on public.push_tokens         from anon, authenticated;
revoke all on public.wordle_words        from anon, authenticated;
revoke all on public.wordle_daily        from anon, authenticated;
revoke all on public.profanity_blocklist from anon, authenticated;
revoke all on public.reset_state         from anon, authenticated;

-- fail closed for FUTURE objects: whoever runs migrations must not expose new
-- tables/functions to clients by default.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
-- supabase_admin default privileges cannot be altered without elevated
-- privileges on some environments; rely on explicit per-object revokes
-- (above) plus the grant-allowlist test to keep future objects closed.

-- service_role (Edge Functions) needs full data access. On locally-migrated
-- tables the default ACL grants it only non-DML privileges (Dxtm), so grant
-- explicitly — and restore it in default privileges for future objects.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- minimal client grants --------------------------------------------------------
-- leaderboard + reference reads
grant select on public.universities      to authenticated;
grant select on public.games             to authenticated;
grant select on public.university_points to authenticated;
grant select on public.profiles          to authenticated;

-- profiles: edit display_name and university_id only, never points (D3, D11)
grant update (display_name, university_id) on public.profiles to authenticated;

-- game_sessions: read own rows, SAFE COLUMNS ONLY.
-- Hidden from clients: seed, raw_result, flags, client_info.
-- NOTE: column-level grants mean select('*') errors — clients must list columns.
grant select (id, user_id, game_id, status, started_at, submitted_at,
              duration_ms, score, points_awarded)
  on public.game_sessions to authenticated;

-- push_tokens: read/delete own rows. Registration goes through the
-- register_push_token() RPC, so no insert/update grant.
grant select, delete on public.push_tokens to authenticated;

-- policies ---------------------------------------------------------------------
create policy "read universities" on public.universities
  for select to authenticated using (true);
create policy "read games" on public.games
  for select to authenticated using (active);
create policy "read school points" on public.university_points
  for select to authenticated using (true);
create policy "read profiles" on public.profiles
  for select to authenticated using (true);

create policy "own sessions" on public.game_sessions
  for select to authenticated using (user_id = auth.uid());

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "read own tokens" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "delete own tokens" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

-- trivia_questions, wordle_words, wordle_daily, profanity_blocklist,
-- reset_state: no grants, no policies = no client access.
-- Edge Functions use the service role, which bypasses RLS.
