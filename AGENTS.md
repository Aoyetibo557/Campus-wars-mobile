# AGENTS.md — Campus Wars

Mobile app where students play mini-games for their university. Points go to the player and their school; schools compete on leaderboards.

## Source of truth

- Precedence if documents conflict: `docs/decisions.md` > `Campus_Wars_Mobile_PRD.md` > `docs/web-audit.md`.
- `docs/decisions.md` records choices made after the web audit. **Decided** entries are binding. **Open** entries are not: don't implement their recommended default without the user confirming. Ask first, or leave a marked TODO.
- `docs/web-audit.md` is a snapshot of the old app. Never edit it.
- The PRD is the source of truth for scope, data model, API, and scoring, except where `decisions.md` overrides it. Read the relevant section before starting any task.
- If code and these documents disagree, follow them and flag the conflict. Do not silently change the design.
- PRD section 19 lists open questions that are not decided yet. Do not assume answers.

## Stack

- **App (`mobile/`):** React Native, Expo (managed), Expo Router, TypeScript (strict), NativeWind, TanStack Query (server state), Zustand (light client state), `@supabase/supabase-js`
- **Backend (`supabase/`):** Supabase Postgres, Auth, Realtime, Edge Functions (Deno/TypeScript), SQL migrations, `pg_cron`
- **Tooling:** EAS (build/submit/update), GitHub Actions, Supabase CLI, Jest + React Native Testing Library, Maestro (E2E)
- There is **no** Express or Next.js server in the new app. Do not introduce one.

## Repo layout

```
mobile/              Expo app (screens in mobile/src/app/, shared UI in mobile/src/components/, helpers in mobile/src/lib/, tokens in mobile/src/theme/)
supabase/
  migrations/        All schema changes live here as SQL
  functions/         Edge Functions: start-session, wordle-guess, submit-session, send-push
  seed.sql
packages/shared/     Optional. Only create when real duplication exists
docs/                Audits, decisions, notes
```
./_legacy-web/         Old web app. READ-ONLY reference (outside of mobile repo. Here is the path: /Users/aoyetibo/Desktop/Personal Projects/Campus-Wars/_legacy-web)

## Hard rules (never break these)

1. **The client never sends points or a trusted score.** The client sends raw results (guesses, answers, timings). The server computes score and points.
2. **Every table has RLS enabled.** Add policies deliberately. No table ships without them. Clients must not be able to write `profiles.points`, `game_sessions`, or `university_points`.
3. **The Supabase service role key never goes in the app.** It exists only in Edge Function secrets. The app uses only the anon key.
4. **Puzzle answers never reach the client before submission.** Wordle answers stay on the server (use `wordle-guess`); trivia questions are sent without `correct_index`.
5. **Points are awarded only through `finalize_game_session`** (service role), called from `submit-session`. Do not write points with ad hoc updates.
6. **Never commit secrets.** No keys, tokens, or `.env` contents in code, logs, or commits. Use `.env.example` with placeholder values.
7. **`_legacy-web/` is read-only.** Never edit, move, or delete anything in it. Never import from it or add it to any build or workspace config.

## Database and backend rules

- All schema changes go in a new timestamped file in `supabase/migrations/`. Never edit an applied migration, and never change a database by hand outside migrations.
- After schema changes, regenerate types: `supabase gen types typescript` into `mobile/src/types/database.ts`. Do not hand-edit that file.
- `profiles` is publicly readable for leaderboards. Never store email or other private data in it.
- Edge Functions must verify the user's JWT, check session ownership and `status = 'started'`, and apply rate limits and plausibility checks as described in PRD sections 10 and 11.
- Game formulas and caps are tunable config (the `games` table or function config), not hardcoded in the app.

## Mobile app rules

- Use Expo-compatible libraries only. Before adding a native dependency, check that it works with Expo (managed) and ask before adding anything that needs a custom dev client or config plugin.
- Styling: NativeWind with design tokens from the Tailwind config. Never hardcode hex colors or magic spacing numbers in components.
- Support light and dark mode through tokens.
- Persist the Supabase session with a storage adapter appropriate for RN (not `localStorage`).
- Data fetching goes through TanStack Query hooks in `mobile/lib/`. Screens should not call Supabase directly inline.
- Components are function components with typed props. No `any` without a comment explaining why.
- Handle loading, empty, error, and offline states on every screen that fetches data.
- Test on both iOS and Android behavior. Avoid platform-specific assumptions.

## Design and theming

- Visual direction is soft black and cream (decisions D1). Do not reuse the old gold/blue palette or any hex values from `_legacy-web/`.
- All colors come from semantic tokens (`background`, `surface`, `text`, `text-muted`, `accent`, `success`, `danger`, etc.) defined in the Tailwind config and `theme/tokens.ts`. Never hardcode hex or color names in components.
- Never convey meaning with color alone (for example, correct/wrong answers need an icon or label too).
- Icons come from `lucide-react-native`. Pass color via the `color` prop from tokens.

## Legacy code (`_legacy-web/`)

- Use it for reference: design tokens, assets, copy, and pure TypeScript game logic (e.g. Wordle feedback, word lists, problem generation).
- Do not port JSX/DOM components, Next.js code, Express routes, the old auth flow, or client-trusted scoring.
- When porting something, copy it into the new codebase, adapt it, and add tests. Note the source path in the commit message.
- `docs/web-audit.md` lists what is worth porting. `docs/decisions.md` overrides it where they differ (for example, the audit's "keep" list for avatar upload and achievements is deferred or cut).

## Workflow

- **Plan before big changes.** For anything touching multiple files, the schema, or auth, state the plan first and wait for approval.
- Work in small steps that match PRD milestones (section 17). Don't jump ahead to later milestones.
- Don't add dependencies without saying what and why. Prefer fewer dependencies.
- Make small, focused commits with clear messages. Do not commit generated build artifacts.
- Before saying a task is done, run lint, typecheck, and the relevant tests, and report the results. If you couldn't run something, say so.
- If a requirement is ambiguous or conflicts with a hard rule, stop and ask. Don't guess.
- Don't refactor unrelated code while working on a task.
- Never delete files or data without asking.
- Before the first commit, confirm no `.env` files, keys, or secrets exist anywhere in the repo, including `_legacy-web/`. Never reuse the old Supabase project or its keys.
- When a task touches something listed as Open in `docs/decisions.md`, stop and ask instead of picking an answer.

## Commands

```
# mobile/  (npm)
npm install
npx expo start                 # Metro dev server
npm run lint                   # eslint (eslint-config-expo + prettier)
npm run typecheck              # tsc --noEmit
npm run format                 # prettier --write .
npm run format:check           # prettier --check .
npm test                       # NOT CONFIGURED YET — Jest setup is a later milestone
npx expo install <pkg>         # add packages (picks SDK-compatible versions)

# supabase/  (run from repo root)
supabase start                 # local Postgres + Auth + Edge Functions
supabase db reset              # re-applies migrations + seed locally
supabase gen types typescript --local > mobile/src/types/database.ts
supabase functions serve       # serve Edge Functions locally
```

## Definition of done

- Behavior matches the PRD section it implements.
- No hard rule violated. RLS checked for any new or changed table.
- Types, lint, and tests pass.
- New logic has tests. Scoring and anti-cheat logic always do.
- Docs updated if behavior, setup, or commands changed.