# Web Audit — `_legacy-web/`

Audit of the old Campus Wars web app for the React Native (Expo) rebuild. Reference only — nothing here should be imported. `_legacy-web/` is read-only.

- Web frontend: `_legacy-web/campus-wars/` (Next.js 15, React 19, Tailwind v4, shadcn/ui, TanStack Query, axios)
- Backend: `_legacy-web/Campus-wars-BE/` (Express 5 on Vercel serverless + `@supabase/supabase-js`, Supabase project `dzdwpnmzstktddkxedlw`)

---

## 1. Design tokens

### 1.1 Effective color palette (what the app actually uses)

The app hardcodes a dark esports theme with arbitrary Tailwind values (`bg-[#...]`). These hex values appear across ~325 usages and are the real brand palette:

| Token | Hex | Usage |
|---|---|---|
| Gold (primary accent) | `#FFD700` | CTAs, trophy icons, active tabs, focus rings, rank numbers (93 uses) |
| Gold hover | `#e6c200` | Hover state of every gold button |
| Blue (secondary accent) | `#1E40AF` | Secondary buttons, links, "Global" leaderboard tab (23 uses) |
| Blue hover | `#2563eb` | Hover state for blue |
| Page background | `#0D0D0D` | Root body, all dashboard layouts |
| Card/surface | `#1E1E1E` | Cards, popovers, sidebar menus (sometimes `#1e1e1ec1` with ~76% alpha) |
| Raised surface | `#2A2A2A` | Inputs, icon wells, stat tiles, avatar fallback |
| Deepest surface | `#121212` | Game header/footer gradient start, loading screens |
| Border | `#404040` | Every card/input border (56 uses) |
| Muted text | Tailwind `gray-400` (`#9ca3af`) | Captions, subtitles — no hex, uses the Tailwind class |
| Dim text | `gray-500` (`#6b7280`), `gray-300` (`#d1d5db`) | Secondary text |
| Danger | `#DC2626` / `red-600`, `red-500` | Delete flows, error states |
| Success/correct | `green-600`/`green-500`, `#10b981`, `#059669` | Correct answers, green answer button |
| Wrong answer | `#DC2626`, `#EF4444`, `red-800` | Incorrect answer reveal |
| Odd one-off | `#B4F42A` | Global leaderboard points color (leaderboardWidget.tsx:117) — probably accidental |
| Misc one-offs | `#1A1A1A`, `#3A3A3A`, `#333`, `#666666`, `#D4AF00`, `#F87171`, `#34D399`, `#3B82F6`, `#1E3A8A` | Single-use shades |

`COLORS` constant in `_legacy-web/campus-wars/src/utils/const.ts` partially codifies this:

```ts
export const COLORS = {
  BACKGROUND: "bg-[#1e1e1e]",
  BORDER: "border-[#404040]",
  CAPTION: "text-gray-400",
};
```

### 1.2 `tailwind.config.js` (verbatim — the entire file)

Located at `_legacy-web/campus-wars/tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      fontSize: {
        "fluid-base": "clamp(1rem, 0.95rem + 0.25vw, 1.125rem)",
      },
      animation: {
        "fade-out": "fadeOut 0.9s ease-in-out",
        "fade-in": "fadeIn 0.9s ease-out forwards",
      },
      keyframes: {
        fadeOut: {
          "0%": { backgroundColor: "#fcd34d" }, // amber-300 hex
          "100%": { backgroundColor: "transparent" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
```

Note: `fluid-base` and `fade-out`/`fade-in` appear unused or barely used. `clamp()` has no NativeWind equivalent — pick fixed sizes per breakpoint.

### 1.3 shadcn CSS variable theme (`src/app/globals.css`)

Tailwind v4 `@theme` block maps shadcn semantic names to CSS vars, and `:root`/`.dark` define the values in **oklch** (default shadcn "neutral" palette — mostly decoupled from the hardcoded brand palette above):

```css
@custom-variant dark (&:is(.dark *));
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  /* ...sidebar-*, chart-1..5, ring, input, border, destructive,
     accent(-foreground), muted(-foreground), secondary(-foreground),
     primary(-foreground), popover(-foreground), card(-foreground) */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;            /* 10px */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1..5: oklch(...);      /* see globals.css lines 64-68 */
  --sidebar-*: oklch(...);       /* see globals.css lines 69-76 */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  /* full block: globals.css lines 79-111 */
}
```

**Important:** the shadcn token system is essentially unused for brand identity. `body` is hardcoded `bg-[#0D0D0D]` in `src/app/layout.tsx:33` and the `.dark` class is never toggled anywhere — the app is effectively **dark-only**. The PRD requires light+dark from day one, so the mobile tokens must be designed properly rather than copied from these CSS vars.

### 1.4 Fonts

- Geist Sans (`--font-geist-sans`) and Geist Mono (`--font-geist-mono`) via `next/font/google`, `src/app/layout.tsx:10-18`.
- Type scale is stock Tailwind (`text-xs`…`text-6xl`). Headings use `font-black` + `tracking-tight`, always ALL CAPS for titles.
- No custom display font — the "CAMPUS WARS" wordmark is just Geist black weight (`src/app/page.tsx:23-26`).

### 1.5 Spacing / radii / shadows

- Spacing: stock Tailwind scale; `p-6` page padding, `p-4` dense, gaps `4`/`6`/`8`. Buttons `h-12`/`h-14`, answer buttons `h-16`, inputs `h-12`/`h-14`.
- Radii: `--radius: 0.625rem` (10px) → sm 6px / md 8px / lg 10px / xl 14px. Cards use `rounded-lg`, pill badges `rounded-full`, `rounded-xl`/`rounded-2xl` occasionally.
- Shadows: signature is a **colored glow** — `shadow-[0_0_20px_rgba(255,215,0,0.3)]` gold and `shadow-[0_0_20px_rgba(30,64,175,0.3)]` blue on cards/buttons (gameCard.tsx:43,50; answerButton.tsx). RN shadows don't support spread/glow the same way — needs a different approach (see §8).
- Gradients: `bg-gradient-to-br from-[#121212] via-[#1a1a1a] to-[#121212]` loading screens; header/footer `bg-gradient-to-r from-[#121212] to-[#1e1e1e]`; stat/question cards `from-[#1e1e1e] to-[#2a2a2a]`; per-game tint washes (`questionCard.tsx:14-23`: math = blue/20, word = gold/20).
- `::-webkit-scrollbar { display: none }` globally hides scrollbars (globals.css:122-124).

### 1.6 Dark mode approach

`.dark` variant exists via `@custom-variant` but **nothing toggles it** — no theme provider, no switcher. Treat the old app as a dark-only design; build a real two-theme token set for mobile (PRD §6).

---

## 2. Asset inventory

All under `_legacy-web/campus-wars/public/` — note the misspelled `assests/` directory (keep or fix the name when copying into `mobile/assets/`).

| Path | Format | Size | Used in |
|---|---|---|---|
| `public/assests/cw_logo_emblem.png` | PNG 1024×1024 RGBA, 711 KB | Logo emblem | `appSidebar.tsx:26` (sidebar header, rounded, 150px) |
| `public/assests/points-icon.png` | PNG 64×64 RGBA, 1.6 KB | Points chip icon | `header.tsx:18` (points pill) |
| `public/assests/nightcafe_assest_2.webp` | WebP 1024×1024, 104 KB | **Unused** (no references found) | — |
| `src/app/favicon.ico` | ICO | Web favicon | next app convention |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | SVG | create-next-app boilerplate | Unused — discard |

Icons are **lucide-react** (`^0.544.0`) everywhere — Trophy, Gamepad2, Medal, Award, Star, Crown, Joystick, Brain, ArrowLeft, Search, MapPin, Users, Mail, Lock, Upload, User, Check, LoaderCircle, AlertTriangle, Target, Clock, Zap, Edit2, Save, X, Shield, ShieldUser, University, Trash2, Sword, ChevronRight, RotateCcw, Settings, Home. `lucide-react-native` is the direct port target.

The "logo" used on the landing page and header is **not** the PNG — it's a composed Lucide Trophy (gold, 80px) + Gamepad2 (blue, overlaid top-right) motif (`page.tsx:13-20`, `header.tsx:42-55`). The PNG emblem only appears in the sidebar.

Background decoration: `components/background/backgroundPattern.tsx` — absolutely-positioned Lucide icons at 20% opacity scattered behind every screen (auth layout, dashboard layouts, landing). Cheap to recreate in RN as a decorative layer.

Avatar storage on the backend: Supabase Storage bucket **`user-avatars`**, path `avatars/{userId}/avatar_{id}_{ts}.{ext}` (BE `models/user.ts` ~line 138-186, multer in `controllers/user.ts:28-50`).

---

## 3. Screens and UX

Routes under `_legacy-web/campus-wars/src/app/` (App Router). Nav is a desktop sidebar (`components/navigation/appSidebar.tsx`, hidden below `lg`) + top header (`components/navigation/header.tsx` with logo, points pill, avatar dropdown, logout). On mobile web the sidebar disappears and the dropdown is the only nav — the app was never really mobile-shaped. Bottom tabs in the new app replace both.

| Screen | Path / file | Purpose + notable patterns |
|---|---|---|
| Welcome | `app/page.tsx` (`/`) | Centered hero: Trophy+Gamepad2 mark, "CAMPUS / WARS" wordmark, tagline, two stacked CTAs (`JOIN THE BATTLE` gold, `SIGN IN` blue→outlined). BackgroundPattern behind. Worth recreating nearly 1:1. |
| Login | `app/auth/login/page.tsx` | Card form, icon-inside-input (Mail/Lock left icons), gold focus ring, inline field errors, "WELCOME BACK", back ghost button, "or" divider, link to signup. |
| Signup | `app/auth/signup/page.tsx` | Same card pattern; email + password + confirm; "JOIN THE FIGHT"; on success → `/auth/university`. react-hook-form, client-side match check only. |
| University select | `app/auth/university/page.tsx` | "CHOOSE YOUR UNIVERSITY" — search input filtering by name/location, selectable cards (selected = gold bg + black text), each card: avatar-initial, name, `MapPin` location, `Users` student count, `#rank` trophy badge. Sticky continue button. Skeleton loading state. |
| Profile setup | `app/auth/profile/page.tsx` | "CREATE YOUR WARRIOR" — avatar upload with gold badge edit button, "Warrior Name" input with **debounced (700ms, lodash) live availability check** (`is available`/`is taken`, spinner), 20-char counter, "Pro Tips" box, `ENTER THE ARENA` CTA disabled until name is available. |
| Dashboard home | `app/dashboard/home/page.tsx` + `home/layout.tsx` | "WELCOME TO THE ARENA", grid of `GameCard`s + `LeaderboardWidget` side column. Full-screen spinner for loads, Alert for errors. |
| Games list | `app/dashboard/games/page.tsx` | "GAMES MANAGEMENT", card grid filtered to `is_active`. Search was stubbed/commented out. |
| Trivia play | `app/dashboard/play/trivia/[gameId]/page.tsx` + `components/TriviaGame.tsx`, `StartScreen.tsx`, `LoadingScreen.tsx` | The only implemented game ("QUIZ ARENA"). Flow: StartScreen (rules card, `START BATTLE`) → fetch 10 OpenTriviaDB questions → `GameHeader` (back, title, `M:SS` countdown from 180s) → `QuestionCard` + 2×2 `AnswerButton` grid (A–D colored blue/red/green/gold, Kahoot-style) → tap reveals correct/incorrect after 100ms → `GameFooter` Next/Finish gated on reveal → `GameProgress` bar "Question N of M" → `GameResults` (trophy, performance tier message, stat tiles, points, `Battle Again`/`Return to Arena`). Exit-confirmation dialog mid-game ("Exit Game?"), error dialog with retry. `?start=true` query param auto-starts. |
| Profile | `app/dashboard/profile/page.tsx` + `components/profile/*` | "WARRIOR PROFILE" with 3 tabs: **Overview** (profile card w/ rank badge, editable fields incl. university Select; stats grid — battles, win rate, streaks, favorite game; recent sessions list), **Achievements** (5 hardcoded achievements + progress bars + completion %), **Settings** (toggles mostly stubbed, danger zone with Reset Stats + Delete). |
| Delete account | `components/profile/deleteAccountModal.tsx` | Strong pattern to keep: checklist of consequences, two confirm checkboxes, must type `DELETE MY ACCOUNT`, final warning when armed. |

Cross-cutting UX worth keeping:
- Persistent header shows points pill (`points-icon.png` + formatted count) and avatar dropdown.
- Leaderboard widget: "My University" (players, gold tab) / "Global" (universities, blue tab) toggle, rank icons — Trophy gold for #1, Medal silver #2, Award bronze/amber #3, `#N` otherwise — plus "View Full Leaderboard →" link to a `/dashboard/leaderboard` page that **was never built**.
- All-caps black-weight titles + muted subtitle is the consistent page-header pattern.
- Skeleton loaders on university list; spinner-elsewhere inconsistency.

Dead ends in the web app: no leaderboard page, no university detail page, no Wordle or Speed Math (gameCard routes to `/dashboard/play/math-battle/[gameId]` which doesn't exist), admin nav links in sidebar point to unbuilt `/admin/*` routes.

---

## 4. Reusable pure logic

| What | File | Portability notes |
|---|---|---|
| **Streak calculator** | `_legacy-web/Campus-wars-BE/utils/streaks.ts` | Fully pure TS, zero deps, 70 lines. `calculateStreaks(sessions)` → `{current, best}` using UTC day-granularity. Directly portable; belongs server-side or in shared logic. Note: relies on `created_at` which the old endpoint let the client forge. |
| Points formatting | `_legacy-web/campus-wars/src/utils/formatter.ts` | `convertPointsFormatted(points)` = `points * 100` then `toLocaleString()`. **The ×100 is a legacy inflation quirk** — decide whether mobile points are literal (PRD implies yes; formulas award 0–300) before porting. |
| Date formatting | `src/lib/utils.ts` | `formatDate(date, "MMM D, YYYY")` via dayjs; `cn()` = clsx+tailwind-merge (both work under NativeWind). |
| Error copy map | `src/utils/errorHandler.ts` + `STATUS_CODES` in `src/utils/const.ts` | `ERROR_MESSAGES` per HTTP status. Text is reusable; the axios-shape detection is not (supabase-js errors look different). |
| OpenTriviaDB client | `src/services/openTriviaApi.ts` | Types (`OpenTriviaQuestion`), 1s throttle, 60s in-memory cache, `response_code` switch, `shuffleArray`, `normalizeTriviaQuestion`. Logic is portable (swap axios→fetch or move server-side) but **see discard notes — answers must not reach the client in the new design**. |
| Question processing | `TriviaGame.tsx:96-136` | `decodeHtmlEntities` (DOM textarea — needs a JS decoder like `entities`/`he`, or decode server-side when seeding `trivia_questions`), `processQuestions` (merge + shuffle + letter-assign options A–D). |
| Achievement definitions | `components/profile/profileAchievements.tsx:25-56` | `achievementDefinitions` array (id/title/description/icon) + merge-with-progress helper — portable shape if achievements ship post-MVP. |
| Domain types | `src/types/database.ts` | Hand-written TS types: `Profile`, `University`, `Game`, `GameSession`, `SessionQuestion`, `UserStats` (battleStatistics/performanceMetrics/achievements), `LeaderboardData`, `TopUniversitiesEntry`, `TopPlayersEntry`, `SubmittedAnswer`. Useful as reference for UI shapes — but will be superseded by generated Supabase types (do **not** hand-port field-by-field; see §7 diffs). |
| Trivia game constants | `TriviaGame.tsx` | 10 questions, 180s total timer, 100ms reveal delay, `answerColors = ["blue","red","green","gold"]`, results-tier thresholds (90/80/70/60% → messages). |
| React Query key factories | `hooks/useGame.ts`, `useUniversity.ts`, `useUser.ts`, `useLeaderboard.ts` | `gameKeys`, `universityKeys`, `userKeys`, `leaderboardKeys` patterns — same TanStack Query on mobile, worth replicating as a convention. |
| Stale-time defaults | `app/providers.tsx` | `staleTime: 5min`, `retry: 1` global; 2min for stats; 30s for username checks. Reasonable starting defaults. |
| Debounced username check | `app/auth/profile/page.tsx` | lodash `debounce(700ms)` + `useCheckUsernameAvailability` — interaction pattern worth keeping (in RN, `use-debounce` or lodash works). |

**There is no Wordle logic, word list, or Speed Math generator anywhere** in `_legacy-web/` (verified by search). Those games must be built fresh per PRD §7 — including a word list source and a **seeded RNG** for math problems (see §8).

---

## 5. Copy / microcopy worth keeping

Battle/arena voice is consistent and on-brand:

- `Where Universities Battle for Glory` (tagline, `app/page.tsx`; also `description` metadata "Battle for Glory")
- `CAMPUS / WARS` stacked wordmark; `Battle Arena` eyebrow under page titles (`gameHeader.tsx`)
- `JOIN THE BATTLE` / `SIGN IN` / `WELCOME BACK` — `Sign in to continue your battle`
- `JOIN THE FIGHT` — `Create your Campus Wars account`
- `CHOOSE YOUR UNIVERSITY` — `Represent your school in Campus Wars`, `Search universities...`
- `CREATE YOUR WARRIOR` — `Set up your profile to dominate the battlefield`, `Warrior Name`, `Choose your battle name`, `Upload your battle avatar (Optional but recommended)`, Pro Tips list, `ENTER THE ARENA`
- `WELCOME TO THE ARENA` — `Choose your battleground and dominate the competition`, `BATTLE GAMES`
- Trivia: `QUIZ ARENA` — `Test your knowledge in this fast-paced trivia battle!`, rules list (`{n} questions`, `3 minutes total time limit`), `START BATTLE`, `Back to Lobby`, `Ready to Battle?` confirm dialog (`Let's Go!` / `Cancel`), `Preparing your battle...`, `Submitting your results...`, `Exit Game?` dialog
- Results: `BATTLE COMPLETE!` + tiers `LEGENDARY WARRIOR!` (≥90%), `EXCELLENT BATTLE!` (≥80%), `GREAT PERFORMANCE!` (≥70%), `GOOD EFFORT!` (≥60%), `KEEP TRAINING!` (<60%); stat labels `Correct / Accuracy / Time / Points`; `You earned {n} points for your university!`; `Battle Again` / `Return to Arena`
- Leaderboard: `LEADERBOARD`, `My University` / `Global` tabs, `Campus Warrior` subtitle, `points`, `View Full Leaderboard →`
- Profile: `WARRIOR PROFILE`, `PROFILE INFO`, `ACHIEVEMENTS & BADGES`, `University Rank #N`, `Member Since`; achievement names `First Game`, `Streak Master`, `Knowledge Seeker`, `Campus Champion`, `Battle Tested`
- Settings/danger: `GAME & PRIVACY SETTINGS`, `DANGER ZONE`, `Irreversible actions for your account`, `These actions cannot be undone`, `Reset Statistics`, `Delete Account`, `Type "DELETE MY ACCOUNT" to confirm:`, `Delete Account Forever`
- Errors (`errorHandler.ts`): `You must log in to continue.`, `This email is already registered.`, `Something went wrong. Please try again later.`
- Rank icons: gold Trophy #1, silver Medal #2, bronze Award #3, `#N` after.
- Toasts: `Account Created Successfully`, `Profile Updated`, `Game over! You scored {n} points.`, `Passwords do not match`

Drop or rework: `GAMES MANAGEMENT`, `Search and filter to find playable games` (admin-ish phrasing), `FAQ's` dead menu item, cookie-consent copy (web-only).

---

## 6. Discard list

Do **not** port:

- **All of `_legacy-web/Campus-wars-BE/`** — Express is replaced by Supabase Edge Functions + RLS. Specifically drop `app.ts`, `server.ts`, `api/index.ts`, `routes/*`, `controllers/*`, `middleware/middleware.ts`, `config/*`, `vercel.json`, multer upload plumbing. Keep only the pure logic called out in §4.
- **Client-trusted scoring** (`services/triviaValidator.ts`, `POST /api/trivia/end`): the client submits `userId`, `createdAt`, and per-answer `correct_answer`/`is_correct`; the server just counts matches and writes points with race-prone read-modify-write. This is exactly what PRD hard rules #1/#5 forbid. The `SubmittedAnswer` type shape must shrink to raw answers + timings; never send `correct_answer`, `is_correct`, `score`, or points from the client.
- **Client-side trivia fetching** (`src/services/openTriviaApi.ts` usage in `TriviaGame.tsx`): fetching OpenTriviaDB in the app puts `correct_answer` in the JS bundle's memory — violates hard rule #4. Move to `start-session`/`submit-session` + a seeded `trivia_questions` bank.
- **Custom auth layer**: `lib/authApi.ts`, `lib/clients.ts` (axios + manual Bearer + refresh queue — note its "refresh" interceptor is mistakenly a *request* interceptor so it never ran), `lib/tokenManager.ts` (localStorage + js-cookie), `context/AuthContext.tsx` (useReducer session state), `components/auth/ProtectedRoute.tsx`, `middleware.ts` (route guard). Replaced by `supabase.auth.*` + persisted session + Expo Router guards.
- **`profiles.password` bcrypt column** (`models/auth.ts`, bcryptjs dep): hashed but never verified — dead weight and a data-hygiene problem. PRD `profiles` has no password and no email.
- **All `components/ui/*` (shadcn/Radix)** — DOM-based; replace with RN equivalents (see §8). `use-mobile.ts`, `components/common/cookieConsentBanner.tsx`, `context/CookieContext.tsx`, `hooks/useCookie.ts`, `react-cookie-consent` are web-only.
- **Cookie/localStorage session storage** — use AsyncStorage/SecureStore adapter per PRD.
- **Next.js boilerplate SVGs** in `public/` and `nightcafe_assest_2.webp` (unused).
- **Admin surface**: sidebar `/admin/*` links, `createGameAPI`/`updateGameAPI`/`deleteGameAPI`, university CRUD in `universityApi.ts`, `controllers/game.ts`, `controllers/university.ts` — admin is Supabase Studio at MVP; also these routes had no authorization (any authed user could mutate `games`/`universities` and even other users' `profiles` via `PUT /api/users/update/:id`).
- **`points × 100` inflation** (`formatter.ts`, `gameResults.tsx` `score * 100`) unless deliberately kept as a design decision — it conflicts with literal PRD point values.
- `get_leaderboards` RPC dependency (`models/leaderboard.ts`) — SQL not in the repo; leaderboard queries should be rebuilt as plain RLS reads per PRD §9.4.
- Dead/duplicated code: `services/trivia.ts` + `models/trivia.ts` (the *secure* server-side trivia flow — unreferenced by any route; worth reading as a design sketch but don't copy verbatim), second `UserQuestionHistory` declaration (BE `types/database.ts` ~lines 80-100), commented retry logic, `JWT_SECRET`/`jsonwebtoken`, `ROLES`, `COOKIE_OPTIONS`, Next `middleware.ts` auth-route logic (has a latent bug — `authRoutes` includes `"auth/profile"` without leading slash and `/auth` is in `protectedRoutes` too, so guards conflict).

---

## 7. Old schema vs PRD schema (§9)

Old schema reconstructed from generated types (`Campus-wars-BE/types/supabase.ts`, stale — noted below) + `types/database.ts` + model code. Actual DB may have columns the generated file misses (`profiles.total_points`, `game_sessions.created_at`, `game_sessions.university_id`, RPC `get_leaderboards`).

### Renamed / restructured

- **`users` ↔ `profiles`:** Old auth user in `auth.users` + `profiles` table carrying `email`, `password` (bcrypt, unused), `username`, `name`, `avatar_url`, `is_active`, `deactivated_at`, `reactivated_at`, `total_points`, `university_id`. PRD `profiles`: `id → auth.users`, `display_name`, `university_id`, `points bigint`. → email and password leave the table entirely; `username`+`name` collapse to `display_name`; `total_points`→`points`; `is_active`/deactivate lifecycle gone (delete = cascade on auth.users); `avatar_url`/`bio`/`location` not in PRD schema (avatar storage may still be wanted — not specced).
- **`universities`:** Old had `name`, `short_name`, `location` (free text), `logo_url`, `website`, `rank` (**stored as text**, and `getAllUniversities` sorted by it — broken ordering). PRD: `name`, `country`, `state`, `email_domains[]`. → rank moves out of the table entirely (computed from `university_points`); `location` splits to `country`/`state`; `short_name`/`logo_url`/`website`/`description`/`student_population`/`established_year` dropped (logo may be missed for the picker UI).
- **`games`:** Old: `name`, `slug`, `description`, `is_active`. PRD: `slug`, `name`, `max_points`, `daily_scored_limit`, `active`. → adds tunable scoring config columns; `description`/`is_active`→`active` rename (UI used `game.description` on cards — keep a description column or source it client-side).
- **`game_sessions`:** Old: `user_id`, `game_id`, `university_id`, `score`, `started_at`, `ended_at`, `status: active|completed|abandoned`. PRD: drops `university_id` (derive via `profiles.university_id`), renames `ended_at`→`submitted_at`, adds `seed`, `duration_ms`, `points_awarded`, `raw_result jsonb`, `flags text[]`, `client_info jsonb`; status becomes `started|completed|rejected`. → the seed + raw_result + flags model is the core anti-cheat change; `abandoned` state gone.
- **`session_questions` + `user_question_history`:** dropped. Per-question state now lives in `game_sessions.raw_result`; the question bank is the new `trivia_questions` table (`question`, `choices jsonb`, `correct_index`, `category`, `difficulty int`) which is **RLS-locked — no client read**.
- **`university_points`:** Old: one row per (`university_id`, `game_id`) with `total_points`. PRD: single row per university with `total_points`, `weekly_points`, `monthly_points`, `updated_at` (PK = `university_id`). → per-game breakdown lost; adds period aggregates maintained by `finalize_game_session` + `pg_cron` resets.
- **New tables:** `push_tokens` (`user_id`, `expo_token`, `platform`); no equivalent existed.
- **New functions/triggers:** `handle_new_user` profile trigger (replaces `POST /api/users/register` profile insert), `finalize_game_session` atomic award (replaces read-modify-write; old `increment_*` RPCs existed but were never called), `pg_cron` resets.
- **RLS:** old backend used one client with a key that calls `supabase.auth.admin` — i.e. service-role, bypassing RLS entirely; authorization was hand-rolled (and incomplete) in controllers. PRD: RLS on every table, clients get anon key + policies; writes only via service-role Edge Functions.
- **Typegen:** old repo generated types into `Campus-wars-BE/types/supabase.ts` and kept hand-written `types/database.ts` that drifted (e.g. `GameSession.university_id`, duplicated `UserQuestionHistory`). New flow generates into `mobile/types/database.ts` — don't maintain a second hand-written copy.

---

## 8. Porting risks / gotchas (React Native + NativeWind)

1. **Hardcoded hex everywhere.** ~325 arbitrary-value usages (`bg-[#FFD700]`). NativeWind supports arbitrary values, but AGENTS.md forbids hex literals in components — the palette in §1.1 must become named tokens in the NativeWind config first. The PRD needs light+dark themes, and the old app only ever shipped dark.
2. **oklch not usable.** The shadcn CSS vars are `oklch()` — RN/NativeWind color input should be hex/rgb. Convert (the oklch set is stock shadcn-neutral anyway; the real brand colors are the §1.1 hexes).
3. **Glow shadows.** `shadow-[0_0_20px_rgba(255,215,0,0.3)]` doesn't map to RN `shadow*` props (no blur-spread colors on Android; elevation is crude). Options: `shadowColor`+`shadowRadius` on iOS, or reanimated/Skia-based glows. Expect visual compromise on Android.
4. **Gradients need `expo-linear-gradient`.** `bg-gradient-to-*` isn't NativeWind — the three recurring gradients (loading bg, header/footer, card surfaces) need a wrapper component.
5. **No DOM APIs.** `decodeHtmlEntities` (`document.createElement('textarea')`) breaks — use the `entities`/`he` package, or better: decode once when seeding `trivia_questions` server-side so clients never see entities.
6. **Icons:** `lucide-react` → `lucide-react-native`; props differ (`size` prop still fine, but color via `color` prop not `className`). All iconography maps 1:1.
7. **Unseeded randomness.** `Math.random()` shuffles (trivia options) can't reproduce server-seeded sessions. PRD requires deterministic generation from `game_sessions.seed` (Speed Math problems, question order) — need a seeded PRNG (e.g. mulberry32) shared client/server.
8. **Hover/focus semantics.** `hover:*`, `focus:*`, `cursor-*`, `group-hover` are meaningless on touch — map to `active:`/`pressed` states (`Pressable`), `opacity` feedback, and add haptics per PRD.
9. **Web layout patterns that don't translate:** CSS grid 2×2 answer buttons → flex-wrap or two rows; `sticky bottom-0` continue button → absolute positioning/safe-area footer; `max-h-96 overflow-y-auto` → `FlatList`; hidden scrollbars are free on RN; `position: fixed` → absolute + `zIndex` nuances; `min-h-screen` → flex on a full-height container; safe-area insets required everywhere the web used `min-h-screen`.
10. **Text inputs:** icon-inside-input pattern needs a wrapping `View` + absolute icon (no `pl-10` equivalent per se — padding works, but icons aren't inline). Password visibility toggle is a native expectation — add it.
11. **`Image` behavior:** no `next/image` blur placeholder or `fill`; use `expo-image` (also gives WebP + caching). The 711KB logo PNG should be resized/compressed (and is the app-icon source candidate).
12. **Toasts/modals:** `sonner` → RN equivalent (`react-native-toast-message`, Burnt, or custom); Radix AlertDialog/Dialog/Tabs/Select/Avatar/Switch/Progress/Checkbox/Skeleton → build on primitives or use a NativeWind-compatible kit (e.g. rnr/React Native Reusables) — budget time for this; it's the largest mechanical port.
13. **`use-mobile`/`matchMedia`** gone; use `useWindowDimensions`/`useSafeAreaInsets` if breakpoints are needed.
14. **Session storage:** `localStorage`/`Cookies` don't exist; use the Supabase AsyncStorage or SecureStore adapter (PRD notes the SecureStore size caveat).
15. **Timers:** the trivia countdown is a `setInterval` in state — fine in RN but must handle app backgrounding (`AppState`) or derive from `started_at` timestamps; background time also matters for duration-plausibility anti-cheat (a legit pause could look like `too_fast`/gap anomalies — record client timing honestly in `raw_result`).
16. **Stale-type risk:** the old generated types drifted from the actual DB. When porting anything typed (`SubmittedAnswer`, `UserStats`), validate against the PRD schema, not the old files.
17. **Points semantics:** decide whether to keep the `×100` display inflation (§4). If dropped, old formatted values and new `points` differ by 100× — don't mix the two representations.
18. **`assests` typo:** fix the path on copy (`mobile/assets/`) so every import path changes — nothing in the new app should reference `public/assests/`.
19. **University `rank` was text in the old DB** and ordered lexicographically — new schema derives rank from `university_points`; don't copy any ordering assumptions.
20. **Web-only UX:** cookie consent banner is unnecessary (no cookies; store privacy manifests/ATT are the mobile equivalents); `?start=true` auto-start param → replace with route params or a start-screen default in Expo Router.
