# Decisions — Campus Wars

Choices made after reviewing `docs/web-audit.md`. Where these conflict with the PRD, **this file wins** (see precedence in AGENTS.md).

**For agents:**
- **Decided** entries are binding.
- **Open** entries are not decided. Each has a recommended default, but do not implement the default without the user confirming. Ask first, or leave a clearly marked TODO.
- When the user confirms an Open entry, move it to Decided and apply any listed PRD edit.
- IDs are permanent. Entries moved from Open keep a "formerly" note.

Last updated: 2026-10-14

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

### D3. School is set once at signup and locked
- **Decision:** `profiles.university_id` is set by the server at signup, from the school the user chose after the signup hook validated their email domain (D23). Clients have no UPDATE grant on it and cannot change it afterward. Exceptions (for example, a transfer student) are handled manually by an admin using the service role.
- **Why:** Otherwise players can move points between schools.
- **Implementation notes:** The `lock_university_id` trigger stays as defense in depth for client roles. There is no automatic points transfer in the MVP: a manual school change must also adjust `university_points` by hand, and that procedure is not designed yet.
- **Affects:** `handle_new_user`, `profiles` grants and triggers, PRD section 9.2. Resolves PRD open question 3.

### D4. School verification: self-select now, external API later (SUPERSEDED by D23)
- Superseded by D23: school email verification is now part of the MVP.

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
- **Resolved by:** word lists (D27) and behavior after completing or abandoning the day's puzzle (D26).
- **Affects:** Migrations, `start-session`, `wordle-guess`, PRD sections 7 and 9. Resolves PRD open question 6.

### D8. University picker data and `short_name` (formerly O6)
- **Decision:** The picker shows name + state + `short_name`. Drop student count, rank badge, and logos. Use initials avatars (this also avoids using school logos or marks without permission). Add `short_name text` to `universities`.
- **Why:** Compact leaderboard rows and the header chip need a short name on small screens.
- **Affects:** `universities` schema and seed, sign-up school picker, leaderboard rows. PRD edit pending (see checklist).

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
- **Decision:** `handle_new_user` always creates the profile with `display_name = 'Player'` and never reads a display name from `raw_user_meta_data`. The real name is set during onboarding (D25), which runs the profanity and length checks. The one metadata value it does read is `university_id`, and it re-validates that value (the school exists, and the email domain matches it) before using it. If validation fails, the signup is aborted.
- **Why:** a blocked or malicious metadata name must not fail signup or bypass the filter, and a school chosen by the client must never be trusted without a server check.
- **Affects:** `handle_new_user` trigger, onboarding.

### D16. Reset catch-up semantics via reset_state
- **Decision:** `reset_periodic_points()` is called by two daily pg_cron jobs (04:00 and 05:00 UTC — covering NY midnight in both EDT and EST) and no-ops unless the New York local hour is 0. `reset_state` records the last applied weekly/monthly period starts; each period resets exactly once, and a missed midnight run catches up at the next NY-midnight run because `last_*_reset` stayed behind. `p_now timestamptz default now()` exists for deterministic tests. pg_cron must be enabled on the hosted project before remote deploy.
- **Affects:** cron migration, `reset_state`, PRD section 9.4.

### D17. Clients read safe game_sessions columns only
- **Decision:** `authenticated` gets column-level SELECT on `game_sessions` for: `id, user_id, game_id, status, started_at, submitted_at, duration_ms, score, points_awarded`. `seed`, `raw_result`, `flags`, and `client_info` stay server-side. Consequence: `select('*')` errors for clients — queries must list columns.
- **Affects:** grants migration, client data layer (must name columns), PRD section 9.2.

### D18. Wordle daily: lazy insert, 30-day exclusion, fallback
- **Decision:** `ensure_wordle_daily(p_date)` (service role) materializes the shared puzzle: insert `on conflict (puzzle_date) do nothing` then re-select, so concurrent first callers agree. Candidates exclude words used in the previous 30 days; if the exclusion eliminates every candidate, it falls back to the full `is_answer` list rather than erroring.
- **Note:** resume/forfeit behavior for an unfinished day's puzzle lives in `start-session` (decisions D26). D18 only covers answer selection.
- **Affects:** migrations, `start-session`, `wordle-guess`, PRD section 9.

### D19. Generated types path
- **Decision:** `supabase gen types typescript` output goes to `mobile/src/types/database.ts` (the scaffold keeps all app code under `mobile/src/`).
- **Affects:** AGENTS.md, PRD section 8.2.

### D20. Component foundation: hand-built primitives on NativeWind v4 (formerly O13)
- **Decision:** React Native Reusables was the preferred route, but its current setup appeared to require a styling-engine migration (Uniwind + Tailwind v4), which is this decision's stop condition. That was believed, not verified, because the docs were unreachable. Text, Label, Input, Button, AlertDialog, and Screen are hand-built on NativeWind v4 using our semantic tokens and the Reusables component shape (composable parts, `className` passthrough, variants), so a later swap stays cheap.
- **Follow-up:** Re-check Reusables against its current docs when the network allows, then decide deliberately whether to migrate. Do not migrate silently.
- **Affects:** `mobile/src/components/ui/`, all screens.

### D21. Email verification by 6-digit code entered in the app
- **Decision:** Email confirmation is on (anti-abuse), with no deep links: the user types the code from the email and never leaves the app. Forgot-password uses the same pattern (recovery code, then new password). Minimum password length is 8.
- **Affects:** `config.toml`, auth screens, email templates (also a hosted-project setup item).

### D22. Onboarding flow and completion rule (SUPERSEDED by D25)
- Superseded by D25: the school is now chosen at signup, and onboarding is the display name only.

### D23. School verification by school email at signup (supersedes D4)
- **Decision:** Players must sign up with an email at their school's domain. Flow: pick school, then school email + password, then 6-digit code (D21), then display name (D25), then Home. A school appears in the picker only if it has at least one confirmed email domain.
- **Enforcement (server-side, fails closed):** A Supabase Before User Created hook rejects signups whose email domain is not equal to, or a subdomain of (dot-boundary match), one of the chosen school's `email_domains`. The hook checks school and domain only. `handle_new_user` re-validates and aborts the signup if the check fails, so a missing or disabled hook (for example on the hosted project) cannot let unverified signups through. Rejection messages never confirm that an account exists.
- **One account per mailbox:** the normalized email (lowercase, `+tag` stripped) is recorded in `mailbox_registry` when the email is confirmed, not at signup, so an unverified signup cannot squat a classmate's mailbox. A colliding confirmation fails (the auth service reports a generic "Error confirming user", which the app maps to neutral copy). Different spellings of one mailbox (jsmith vs john.smith) cannot be detected and are accepted.
- **Public school data:** `anon` and `authenticated` can read `id, name, short_name, state, country, email_domains` of listed schools. `website` and `scorecard_unit_id` stay server-side. The domains are public data, and the server still enforces the rule.
- **Email changes:** the app does not expose email change. At the database level, any email change must still match the school's domains and the uniqueness rule.
- **Accepted:** faculty, staff, and alumni (domains cannot tell them apart).
- **Why:** Leaderboard credibility from day one. Retrofitting later would leave accounts with unverified schools locked in by D3.
- **Affects:** Auth hook and `config.toml`, `handle_new_user`, `mailbox_registry`, `universities` grants, sign-up screens, hosted-setup (enable the hook), PRD sections 4, 5, 6, 9, 11, 14. Resolves PRD open question 1.

### D24. School data pipeline: College Scorecard + Hipo, build-time only
- **Decision:** A build-time script combines College Scorecard (the spine for US schools: name, state, website, unit ID; needs a free api.data.gov key, kept in an environment variable and never committed) with the Hipo University Domains JSON (email domains; a pinned snapshot filtered to the US). Match by website domain first, then normalized name. Ambiguous and unmatched schools are reviewed by hand through an overrides file, largest schools first. The curated result is committed as data and loaded by a migration or import. External APIs are never called at runtime. Refresh annually. US schools only at launch; international later via Hipo.
- **Safeguards:** No free-email-provider domain (for example gmail.com) or bare public suffix may ever appear as a school domain, enforced by a test. Sources and snapshot dates are recorded in `docs/data-sources.md`.
- **Affects:** `scripts/universities/`, `data/universities/`, `universities` schema (`scorecard_unit_id`, `website`), seed data.

### D25. Onboarding is the display name only; completion marker is onboarded_at (supersedes D22)
- **Decision:** After email verification, one screen asks for the display name (2 to 20 code points, D14). Onboarding is complete if and only if `profiles.onboarded_at` is not null. It is set once by a `complete_onboarding(p_display_name)` SECURITY DEFINER function that runs the name checks. A quit before finishing returns the user to the name screen. It ends with a call to action to play the first game.
- **Affects:** `profiles` schema, route guard, onboarding screen.

### D26. Wordle daily lifecycle: one play per day, resume if unfinished (formerly O16)
- **Decision:** A player gets one Wordle session per puzzle date (New York date, D6). After completing it, the app shows the result and waits until the next puzzle; there is no replay. If a player starts but does not finish, they resume the same session: guesses are validated and stored on the server, so reopening the app restores the board. An unfinished session from a previous day is simply left behind; the new day starts a new session.
- **Why:** Matches the shared daily puzzle (D7) and the 1-scored-play cap (D5), and avoids replay exploits.
- **Implementation notes:** One session per user, game, and puzzle date should be enforced atomically in the database (for example a unique index on user, game and a deterministic seed for Wordle), so concurrent `start-session` calls cannot create two. Responses include `next_puzzle_at` so the client never needs its own timezone logic.
- **Affects:** `start-session`, `game_sessions` indexes, Home daily card, result screen. Resolves PRD Wordle behavior.

### D27. Wordle word lists: ENABLE for guesses, our own curated answers (formerly O11)
- **Decision:** Valid guesses come from the ENABLE word list alone (public domain; license verified and recorded), filtered to five-letter words. The answer list is hand-curated by us (drafted, then reviewed by the owner), with at least 600 entries at launch and more added over time. Every answer must be a valid guess. No frequency lists, SCOWL, or third-party offensive-word lists are used; a short hand-written exclusion list may remove slurs from the guess list. The original Wordle lists are not used or reproduced.
- **Why:** Fewer sources means fewer licenses to verify and a smaller review job. The 30-day no-repeat rule (D18) works fine with 600 answers.
- **Affects:** `wordle_words` data, loader script, `docs/data-sources.md`.

### D28. Wordle guesses are validated on the server only
- **Decision:** Every guess goes through the `wordle-guess` Edge Function, which checks it against the valid-guess list, computes per-letter feedback, and stores it. The valid-guess list and the answer never ship in the app. A guess that is not in the list returns "not a word" and does not consume one of the six guesses. The answer is revealed only when the game has finished.
- **Affects:** `wordle-guess`, Wordle screen, tests that scan responses for answer leaks.

### D29. Build order: Wordle first
- **Decision:** Wordle is built end to end first (functions, screen, result, Home). Trivia and Speed Math follow once Wordle works.
- **Affects:** `start-session` supports only `wordle` at first and returns a clear "not available yet" for other games.

### D30. Users always read their own school
- **Decision:** An authenticated user can select the university referenced by their own `profiles.university_id` even when it is unlisted (`email_domains` empty). The listed-only rule for every other access path is unchanged, and the readable columns stay the same safe set (`id, name, short_name, state, country, email_domains`).
- **Why:** A data refresh can empty a school's domains; its members must not lose their greeting or affiliation read.
- **Affects:** `universities` RLS policies.

### D31. Display names reject invisible and blank-looking characters
- **Decision:** `profiles_check_display_name` rejects (does not silently normalize) names containing zero-width characters (U+200B–U+200D), bidirectional controls (U+200E–U+200F, U+202A–U+202E, U+2060–U+2069), blank-looking spaces (U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F, U+3000), blank glyphs (U+2800, U+115F–U+1160, U+3164, U+FFA0) and BOM (U+FEFF), raising `display_name contains invalid characters` before the blocklist check. Variation selectors (U+FE00–U+FE0F) are not rejected because they are legitimate parts of emoji sequences.
- **Known limitation (accepted, do not "fix"):** names that legitimately need ZWNJ or ZWJ — for example some Persian or Indic names, and ZWJ-based emoji sequences like 👨‍👩‍👧 — are rejected too. Users in that situation can pick a nickname.
- **Affects:** `profiles_check_display_name`, onboarding name screen error mapping.

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

### O17. Schools not listed / no school email
- **Recommended:** "My school isn't listed" opens a simple waitlist form (school name + contact email), stored through an RPC or Edge Function with rate limiting. No signup is possible without a listed school (D23), so this link would otherwise be a dead end.
- **Open:** where requests are stored and how you get notified. Resolves PRD open question 2.

### O18. Wordle finalization path
- **Recommended:** Finalize the game inside the final `wordle-guess` call (when the word is solved or the sixth guess is used), in the same server step that stores that guess, rather than relying on a separate client call to `submit-session`. This removes the failure mode where the app dies between the last guess and the submit. `submit-session` is then built with Trivia and Speed Math, which need it.
- **Alternative:** Follow the PRD literally: the client calls `submit-session` after the last guess.
- **Decide:** when reviewing the plan for Prompt b in `Wordle_Prompts.md`.
- **Affects:** `wordle-guess`, `submit-session` scope, PRD section 10.

### O19. Display-name combining marks and mixed scripts
- **Recommended (not built):** Limit runs of combining marks in display names (prevents stacked-mark / "zalgo" text that breaks layouts), and consider rejecting names that mix look-alike scripts (e.g. Latin + Cyrillic homoglyphs). Both would live in `profiles_check_display_name` alongside D31.
- **Affects:** `profiles_check_display_name`, name validation.
---

## PRD edits pending

The agent reported syncing PRD sections 7, 8.2, 9, 9.2, 9.3, 9.4 and 10 to the migrations (D12–D19). Spot-check the PRD, then tick the boxes below.

- [ ] D3: replace the "School changes" note in section 9.2 with the amended D3 (school set at signup, no client UPDATE grant, lock trigger kept as defense in depth)
- [ ] D5: confirm caps in section 7 and the `games` seed
- [ ] D6: update resets (section 9.4 and the `pg_cron` notes) to `America/New_York`
- [ ] D7: Wordle row in section 7 becomes a shared daily puzzle; add the daily-answer storage to section 9
- [ ] D8: add `short_name` to `universities` (section 9)
- [ ] D9: confirm points are literal
- [ ] D10: Trivia row in section 7 becomes 10 questions, max 150; update `games.max_points` seed
- [ ] D11: note that display names are not unique and a profanity filter applies
- [ ] D23/D24/D25: apply Part 2 of `School_Verification_Decisions_and_PRD.md` (sections 4.1, 4.2, 5.1, 6, 9, 9.2, 11, 14, 19); this replaces the old D4 edits
- [ ] Section 19: mark question 1 resolved by D23 and question 2 pointed to O17; questions 3, 4, 5, 6 resolved by D3, D5, D6, D7
- [ ] D26/D27/D28/D29: apply Part 2 of `Wordle_Decisions_and_PRD.md` (sections 7 and 10)
