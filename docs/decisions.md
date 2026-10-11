# Decisions — Campus Wars

Choices made after reviewing `docs/web-audit.md`. Where these conflict with the PRD, **this file wins** (see precedence in AGENTS.md).

**For agents:**
- **Decided** entries are binding.
- **Open** entries are not decided. Each has a recommended default, but do not implement the default without the user confirming. Ask first, or leave a clearly marked TODO.
- When the user confirms an Open entry, move it to Decided and apply any listed PRD edit.
- IDs are permanent. Entries moved from Open keep a "formerly" note.

Last updated: 2026-10-10

---

## Decided

### D1. Visual direction: soft black and cream
- **Decision:** Scrap the old gold / blue / near-black esports palette. The new base is a softer black and a cream. Text colors and tertiary colors are built on top of those two.
- **Why:** Old palette was ~325 hardcoded hex usages with one-offs and no real theming; a fresh base lets tokens be designed properly.
- **Affects:** Tailwind/NativeWind config, `theme/tokens.ts`, every component (no hardcoded hex per AGENTS.md).
- **Not yet decided:** exact hex values and light/dark mapping (see O1).

### D2. Document roles and precedence
- **Decision:** `docs/web-audit.md` is a snapshot of the old app and is never edited to reflect new choices. Choices live here. Precedence if documents conflict: `decisions.md` > PRD > `web-audit.md`.
- **Affects:** AGENTS.md (precedence rule), PRD (edits applied per the checklist at the bottom).

### D3. School is locked after onboarding
- **Decision:** `profiles.university_id` can be set once (null to a school) during onboarding and cannot be changed by the client afterward. Exceptions (for example, a transfer student) are handled manually by an admin using the service role.
- **Why:** Otherwise players can move points between schools.
- **Implementation notes:** Enforce with a trigger that rejects changes once set (service-role changes allowed). There is no automatic points transfer in the MVP: a manual school change must also adjust `university_points` by hand, and that procedure is not designed yet. A school should be selected before any scored play.
- **Affects:** `profiles` trigger/migration, onboarding flow, PRD section 9.2. Resolves PRD open question 3.

### D4. School verification: self-select now, external API validation later
- **Decision:** Players pick their school and sign up with any email. At MVP nothing checks that the email belongs to the school. Later, validation will use an external API and run server-side behind the scenes (an Edge Function with the API credentials stored as a secret, never in the app). No onboarding UI change is planned for the MVP.
- **Why:** Faster to ship. The signup email is already collected and confirmed by code (D21), so it can be validated later without new UI. Keep `universities.email_domains` for a simple domain check if the API is delayed.
- **Trade-off:** Leaderboards are less credible until verification exists.
- **Future notes (not for now):** Verification status and any school email must live in a private table, not in the publicly readable `profiles`. Personal-email signups will need a later "verify with your school email" step. Whether unverified players count on leaderboards is undecided.
- **Affects:** Auth, onboarding (nothing at MVP), PRD sections 4.2 and 11. Resolves PRD open question 1.

### D5. Daily scored-play caps
- **Decision:** Wordle 1 scored play per day, Trivia 10, Speed Math 10. Stored in `games.daily_scored_limit` so they can be tuned without an app release. Plays beyond the cap are allowed but award 0 points, and the result screen says so.
- **Implementation note:** The "day" boundary follows the reset timezone in D6.
- **Affects:** `games` seed values, `submit-session`, result screen. Resolves PRD open question 4.

### D6. Reset timing: America/New_York
- **Decision:** Weekly points reset Monday 00:00 and monthly points reset on the 1st at 00:00, both in `America/New_York`.
- **Implementation note:** `pg_cron` schedules run in UTC, so the agent must propose a DST-safe approach (for example, computing period boundaries in SQL with `AT TIME ZONE 'America/New_York'`) and get approval before implementing.
- **Affects:** `pg_cron` jobs, daily cap boundary (D5), Wordle daily puzzle date (D7). Resolves PRD open question 5.

### D7. Wordle: one shared daily puzzle
- **Decision:** Everyone gets the same Wordle puzzle each day. The answer stays on the server and never reaches the client (`wordle-guess` validates guesses and returns feedback only).
- **Implementation note:** Either a table such as `wordle_daily(puzzle_date, answer)` with no client access under RLS, or an answer derived from the date plus a server secret. The agent proposes one and waits for approval. The puzzle date uses the D6 timezone.
- **Still open:** word lists (O11) and behavior after completing or abandoning the day's puzzle (O16).
- **Affects:** Migrations, `start-session`, `wordle-guess`, PRD sections 7 and 9. Resolves PRD open question 6.

### D8. University picker data and `short_name` (formerly O6)
- **Decision:** The picker shows name + state + `short_name`. Drop student count, rank badge, and logos. Use initials avatars (this also avoids using school logos or marks without permission). Add `short_name text` to `universities`.
- **Why:** Compact leaderboard rows and the header chip need a short name on small screens.
- **Affects:** `universities` schema and seed, onboarding, leaderboard rows. PRD edit pending (see checklist).

### D9. Literal points (formerly O7)
- **Decision:** Points are literal. No `points × 100` display inflation. If bigger numbers are ever wanted, scale the formulas in the PRD instead of multiplying at display time.
- **Why:** Mixing literal and ×100 values is a bug source.
- **Affects:** Formatting helpers, result screen, PRD section 7.

### D10. Trivia: 10 questions, max 150 points (formerly O8)
- **Decision:** 10 questions per round. 10 points per correct answer plus up to 5 time-bonus points per question. `games.max_points` for trivia is 150.
- **Why:** Matches the old game and the bite-size goal.
- **Affects:** `games` seed, `start-session` (10 questions), `submit-session` scoring. PRD edit pending (see checklist).

### D11. Display names: not unique (formerly O9)
- **Decision:** Display names are not required to be unique at MVP (no unique index). Add a profanity filter on write. Revisit a unique handle later if duplicates confuse leaderboards.
- **Affects:** Onboarding (no live availability check), `profiles` constraints.

### D12. Daily cap enforced inside finalize_game_session, keyed on started_at
- **Decision:** The daily cap is enforced inside `finalize_game_session` (service role), not in the Edge Function layer. Under a transaction-level advisory lock keyed on (user, game), it counts the user's OTHER `completed` sessions for the same game on the same `America/New_York` date — measured by `started_at`, not `submitted_at`. At/over `games.daily_scored_limit` the award is 0 and the session is flagged `daily_cap`. The count includes completed sessions that awarded 0 points, so this is stricter than PRD section 7's "scored sessions" wording (PRD updated to match).
- **Why:** one atomic point of enforcement — a future second write path cannot bypass the cap, and the started day is the intuitive day the player "used up" (a session started 23:55 NY and finalized after midnight still counts for the start day).
- **Affects:** `finalize_game_session` migration, `submit-session`, PRD sections 7, 9.3, 10.

### D13. Push tokens are global; registration via SECURITY DEFINER RPC
- **Decision:** `push_tokens.expo_token` is globally unique — a token belongs to a device, not a user. Clients register through `register_push_token(p_expo_token, p_platform)` (SECURITY DEFINER, `execute` granted to `authenticated` only), which validates the Expo token format (`ExponentPushToken[...]` / `ExpoPushToken[...]`) and platform (`ios`/`android`), and reassigns an existing token row to the caller. Direct insert/update is not granted; users read and delete only their own rows.
- **Why:** when a device changes hands the token follows it; per-user uniqueness could not express that without an RPC anyway.
- **Affects:** `push_tokens` schema/grants, push registration flow, PRD section 9.2.

### D14. Display-name length: 2–20 code points
- **Decision:** `display_name` must be 2–20 characters after trimming, enforced by a check constraint measured with `char_length` (Unicode code points). Multi-code-point graphemes — some emoji, flags, ZWJ sequences — count as several characters, so a short emoji string can be rejected. The onboarding UI must count the same way so client-side validation agrees with the server.
- **Affects:** `profiles` check constraint, onboarding name field.

### D15. Signup ignores display-name metadata
- **Decision:** `handle_new_user` always creates the profile with `display_name = 'Player'` and never reads `raw_user_meta_data`. The real name is set through the client's column-granted update, which runs the profanity and length checks.
- **Why:** a blocked or malicious metadata name must not be able to fail signup or bypass the filter.
- **Affects:** `handle_new_user` trigger, onboarding (choosing a name is always a second step).

### D16. Reset catch-up semantics via reset_state
- **Decision:** `reset_periodic_points()` is called by two daily pg_cron jobs (04:00 and 05:00 UTC — covering NY midnight in both EDT and EST) and no-ops unless the New York local hour is 0. `reset_state` records the last applied weekly/monthly period starts; each period resets exactly once, and a missed midnight run catches up at the next NY-midnight run because `last_*_reset` stayed behind. `p_now timestamptz default now()` exists for deterministic tests. pg_cron must be enabled on the hosted project before remote deploy.
- **Affects:** cron migration, `reset_state`, PRD section 9.4.

### D17. Clients read safe game_sessions columns only
- **Decision:** `authenticated` gets column-level SELECT on `game_sessions` for: `id, user_id, game_id, status, started_at, submitted_at, duration_ms, score, points_awarded`. `seed`, `raw_result`, `flags`, and `client_info` stay server-side. Consequence: `select('*')` errors for clients — queries must list columns.
- **Affects:** grants migration, client data layer (must name columns), PRD section 9.2.

### D18. Wordle daily: lazy insert, 30-day exclusion, fallback
- **Decision:** `ensure_wordle_daily(p_date)` (service role) materializes the shared puzzle: insert `on conflict (puzzle_date) do nothing` then re-select, so concurrent first callers agree. Candidates exclude words used in the previous 30 days; if the exclusion eliminates every candidate, it falls back to the full `is_answer` list rather than erroring.
- **Note:** resume/forfeit behavior for an unfinished day's puzzle lives in `start-session` and is still undecided (O16) — D18 only covers answer selection.
- **Affects:** migrations, `start-session`, `wordle-guess`, PRD section 9.

### D19. Generated types path
- **Decision:** `supabase gen types typescript` output goes to `mobile/src/types/database.ts` (the scaffold keeps all app code under `mobile/src/`).
- **Affects:** AGENTS.md, PRD section 8.2.

### D20. Component foundation: React Native Reusables, copy-in and selective (formerly O13)
- **Decision:** Components are copied into the repo and owned by us. Only add what screens need. Theme with our semantic tokens. If setup would require migrating the styling engine or changing major versions of NativeWind or Tailwind, stop and ask; fall back to hand-built primitives (Button, Input, Text, Dialog) on NativeWind.
- **Affects:** Scaffold, all screens.

### D21. Email verification by 6-digit code entered in the app
- **Decision:** Email confirmation is on (anti-abuse), with no deep links: the user types the code from the email and never leaves the app. Forgot-password uses the same pattern (recovery code, then new password). Minimum password length is 8.
- **Affects:** `config.toml`, auth screens, email templates (also a hosted-project setup item).

### D22. Onboarding flow and completion rule
- **Decision:** Order: School, then Name, then a confirmation step. The profile is written once, atomically (`display_name` and `university_id` in one update), at the end of the confirmation step. Onboarding is complete if and only if `profiles.university_id` is not null. A quit mid-flow restarts at step 1. The confirmation step states that the school cannot be changed later (D3). Onboarding ends with a call to action to play the first game.
- **Affects:** Onboarding screens, route guard, profile queries.

---

## Open (recommended defaults, awaiting confirmation)

### O1. Theme mapping and token structure
- **Recommended:** Dark mode = soft black background with cream text. Light mode = cream background with soft black text. Define semantic tokens, not color names: `background`, `surface`, `surface-raised`, `border`, `text`, `text-muted`, `accent`, `success`, `danger`, `rank-1`, `rank-2`, `rank-3`. Check contrast of success/danger/accent on both backgrounds.
- **Affects:** PRD section 6 (light + dark from day one), all styling.

### O2. Visual treatments to drop
- **Recommended:** Drop colored glow shadows, the three recurring gradients, per-game tint washes, and the Kahoot-style A–D answer colors. Use flat surfaces with subtle borders; neutral answer buttons with letter badges; show correct/wrong only with `success`/`danger` tokens. Limit ALL-CAPS black-weight headings to the wordmark and key moments. The faint background icon pattern is optional.
- **Why:** Glows don't translate to Android; gradients need extra wrappers; color-only answers hurt accessibility; heavy caps will feel harsh on cream.

### O3. Logo and icons
- **Recommended:** Create one real logo in the new palette (also the source for the app icon). Replace `points-icon.png` with a themed vector icon. Drop the composed Lucide trophy + gamepad mark, the 711 KB emblem PNG, and unused assets.
- **Affects:** `mobile/assets/`, app icon/splash, header points pill.

### O4. Avatars
- **Recommended:** Defer avatar upload. Use initials or preset avatars for the MVP.
- **Why:** PRD doesn't spec avatars; uploads add storage, plumbing, and image moderation requirements.

### O5. Features to cut from the MVP
- **Recommended:** Cut the Achievements tab, streaks, and "win rate" (these games have no win/loss); keep a simple stats view. Remove "Reset Statistics" (it would erase points already counted toward a school). Replace stub settings toggles with the real notification toggles from the PRD. Keep the delete-account flow but simplify it.

### O10. Trivia content source
- **Recommended:** Seed a server-side `trivia_questions` bank (never fetched by the client). If using Open Trivia DB, verify its license and attribution requirements before shipping (believed to be share-alike). Decode HTML entities once at seed time.
- **Affects:** `seed.sql`, `start-session`, PRD open question 7.

### O11. Wordle word lists
- **Recommended:** Choose and license two lists: possible answers and valid guesses. The legacy app has no Wordle code or word list, so this is net-new.
- **Affects:** `wordle-guess` function, seed data, and the answer-selection mechanism in D7.

### O12. Shared package
- **Recommended:** Create `packages/shared/` when the seeded PRNG is needed (Speed Math problems, question order). Not before.

### O14. Fresh Supabase project and secrets hygiene
- **Recommended:** Create a new Supabase project. Do not reuse the old project or its keys. Before the baseline commit, check `_legacy-web/` for `.env` files or committed keys and rotate anything found. Redact the old project ID from docs if the repo could become public.

### O15. Legacy code cleanup
- **Recommended:** After everything needed is ported, delete or gitignore `_legacy-web/`. The audit is the distilled record.

### O16. Wordle after completing or abandoning the day's puzzle
- **Recommended:** After completing today's puzzle, show the result and wait until the next day (no replay). If a player starts but doesn't finish, they resume the same session, since guesses are validated and stored server-side.
- **Alternative:** Allow unscored replays with a different puzzle, and treat an unfinished session as forfeited.
- **Note (D18):** this behavior lives in `start-session`, not in `wordle_daily` / `ensure_wordle_daily` (which only picks the answer). Still undecided.
- **Affects:** `start-session` behavior for Wordle, session status handling, Home screen daily card.

---

## PRD edits pending

The agent reported syncing PRD sections 7, 8.2, 9, 9.2, 9.3, 9.4 and 10 to the migrations (D12–D19). Spot-check the PRD, then tick the boxes below.

- [ ] D3: add the `university_id` lock trigger to section 9.2 and reword the "School changes" note
- [ ] D4: replace the `.edu` verification wording in sections 4.2 and 11 with "school verification (external API, post-MVP)"; note that `email_domains` is retained
- [ ] D5: confirm caps in section 7 and the `games` seed
- [ ] D6: update resets (section 9.4 and the `pg_cron` notes) to `America/New_York`
- [ ] D7: Wordle row in section 7 becomes a shared daily puzzle; add the daily-answer storage to section 9
- [ ] D8: add `short_name` to `universities` (section 9)
- [ ] D9: confirm points are literal
- [ ] D10: Trivia row in section 7 becomes 10 questions, max 150; update `games.max_points` seed
- [ ] D11: note that display names are not unique and a profanity filter applies
- [ ] Section 19: mark questions 1, 3, 4, 5, 6 resolved with pointers to D4, D3, D5, D6, D7
