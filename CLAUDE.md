# Mats Games — UDL Games Webapp

Bachelor party game event management system for one person ("Mats") — one-time-use, Norwegian-language UI throughout. Public leaderboard, public activity history, hidden full-screen rebus treasure-hunt view for the bachelor, and a password-protected admin panel.

## Deeper docs (read on demand)
Pull these in only when the task touches the area — they're not loaded by default to keep context lean.
- `docs/design-system.md` — glass/neon/beer CSS utilities, colors, animations
- `docs/data-flow.md` — fetching, mutations, hook contracts, auth token reactivity
- `docs/activity-formats.md` — format matrix, `num_rounds` semantics, team battle, ranking algorithms
- `docs/brackets.md` — double-elim schema, propagation, point auto-proposal
- `docs/supabase.md` — migrations, env vars, pgcrypto gotcha

## Tech Stack
- React 19 + TypeScript 5.9 (strict) + Vite 8
- Tailwind CSS 4 + OKLCH theme variables
- shadcn-inspired UI (Card/Button/Input/Badge) with `class-variance-authority`
- React Router DOM 7 (layout routes)
- Supabase (PostgreSQL + RPC) via `@supabase/supabase-js`
- Lucide React icons, Orbitron + Exo 2 fonts, Vercel deploy

## Routing — Layout Routes
`src/App.tsx` separates the hidden full-screen rebus from everything else:
- `/rebus/run` → `RebusPage` (no header, full-screen, hidden from nav)
- All other routes wrapped in `MainLayout` (`<Header />` + `container max-w-2xl` + `<Outlet />`)

## Public vs Admin
**Public**: `/` (Leaderboard), `/activities` (history + current), `/rebus/run` (hidden, link given directly to bachelor)
**Admin**: `/login`, `/admin/activities`, `/admin/contestants`, `/admin/rebus`. Admin header has a "Rebus-vis" button that opens `/rebus/run` in a new tab.

## Hard Rules (non-negotiable)
- **Norwegian UI, ASCII only** in source files — use `a/o/ae` instead of `å/ø/æ`.
- **Mutations live in domain hooks, not pages.** Pages call `useActivities().deleteActivity(id)`, not `supabase.rpc(...)` directly. Only intentional exception: bracket generation in `ActivityDetailPage`.
- **Mutation hooks throw on error**, then refetch. Never swallow errors. Pages wrap handlers in try/catch (`runAction` helper pattern in `ActivityDetailPage`) and show a banner.
- **Multi-step mutations short-circuit on failure.** E.g. `handleCompleteAndAward` must NOT mark an activity completed if `savePoints` threw.
- **Use `shuffle<T>()` from `src/lib/utils.ts`** for randomization. Do NOT use `arr.sort(() => Math.random() - 0.5)` — biased.
- **Never drop players when splitting a roster.** Odd counts → unequal split (4+3), not slice-off.
- **Don't read `sessionStorage` in render paths or hook deps.** Use `useAuth().sessionToken` (reactive React state).
- **`activities.num_rounds` is format-specific** — see `docs/activity-formats.md`. Do NOT treat it as a generic "rounds" field.

## Shared Utilities
- `TEAM_SIZES` (`src/lib/constants.ts`) — `Record<ActivityType, number>`. Don't redefine inline.
- `STATUS_LABELS` (`src/lib/constants.ts`) — Norwegian labels. Don't redefine per-page.
- `shuffle<T>(arr)` (`src/lib/utils.ts`) — Fisher-Yates, returns a new array.
- `countAllRoundRobinMatches(numPlayers, teamSize)` (`src/lib/algorithms/round-robin.ts`) — runs generator with dummy ids for "alle" totals.

## Project Structure
```
src/
  pages/        — LeaderboardPage, ActivityHistoryPage, RebusPage (hidden), LoginPage, ActivitiesPage, ActivityDetailPage, ContestantsPage, RebusAdminPage
  components/
    ui/         — Button, Card, Input, Badge
    layout/     — MainLayout, Header, AdminGuard
    AnimatedNumber.tsx
  hooks/        — one per domain (use-auth, use-activities, use-matches, use-points, use-leaderboard, use-rebus, use-activity-history, use-contestants)
  lib/
    algorithms/ — round-robin, double-elimination, points, ranking
    supabase, auth, types, constants, utils
  index.css     — Tailwind + theme + glass/neon utilities
supabase/migrations/ — 001-007
```

## Commands
```sh
npm run dev       # http://localhost:5173
npm run build     # type-check + production build
npm run lint
npm run preview
```

## Naming
Files kebab-case · Components/Types PascalCase · functions/vars camelCase · constants UPPER_SNAKE_CASE · path alias `@/*` → `./src/*`
