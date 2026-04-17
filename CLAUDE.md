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
- `canvas-confetti` — confetti on leaderboard point updates
- `qrcode` — QR code generation for share/rebus modals
- Recharts — line charts and scatter plots in `/stats` and `/display`

## Routing — Layout Routes
`src/App.tsx` separates full-screen views from the main app:
- `/rebus/run` → `RebusPage` (no header, full-screen, hidden from nav)
- `/display` → `DisplayPage` (no header, full-screen TV mode)
- All other routes wrapped in `MainLayout` (`<Header />` + `container max-w-2xl` + `<Outlet />` + `<FloatingAdminButtons />`)

## Public vs Admin
**Public**: `/` (Leaderboard), `/activities` (history + current), `/stats` (statistics tabs), `/players/:id` (player profile)

**Admin**: All admin features live at a single `/admin` route (`AdminPage`) with tabs — Aktiviteter, Events, Deltakere, Rebus, Drikke. After login, redirects to `/admin`. Activity detail drill-down lives at `/admin/activities/:id`.

**Floating admin overlay**: `FloatingAdminButtons` (rendered by `MainLayout`) shows TV and QR buttons fixed bottom-right on all non-fullscreen pages. Only visible when `isAdmin`.

## Hard Rules (non-negotiable)
- **Norwegian UI** — use proper diacritics (`å/ø/æ`) in user-facing strings. Source files are UTF-8.
- **Mutations live in domain hooks, not pages.** Pages call `useActivities().deleteActivity(id)`, not `supabase.rpc(...)` directly. Only intentional exception: bracket generation in `ActivityDetailPage`.
- **Mutation hooks throw on error**, then refetch. Never swallow errors. Pages wrap handlers in try/catch (`runAction` helper pattern in `ActivityDetailPage`) and show a banner.
- **Multi-step mutations short-circuit on failure.** E.g. `handleCompleteAndAward` must NOT mark an activity completed if `savePoints` threw.
- **Use `shuffle<T>()` from `src/lib/utils.ts`** for randomization. Do NOT use `arr.sort(() => Math.random() - 0.5)` — biased.
- **Never drop players when splitting a roster.** Odd counts → unequal split (4+3), not slice-off.
- **Don't read `sessionStorage` in render paths or hook deps.** Use `useAuth().sessionToken` (reactive React state).
- **`activities.num_rounds` is format-specific** — see `docs/activity-formats.md`. Do NOT treat it as a generic "rounds" field.
- **CSS custom properties (`var(--color-*)`) do not resolve as SVG `stroke`/`fill` attributes.** Use hardcoded hex values (from `CHART_COLORS_RESOLVED` in `RaceChart.tsx`) when coloring SVG elements directly.

## Shared Utilities
- `TEAM_SIZES` (`src/lib/constants.ts`) — `Record<ActivityType, number>`. Don't redefine inline.
- `STATUS_LABELS` (`src/lib/constants.ts`) — Norwegian labels. Don't redefine per-page.
- `shuffle<T>(arr)` (`src/lib/utils.ts`) — Fisher-Yates, returns a new array.
- `countAllRoundRobinMatches(numPlayers, teamSize)` (`src/lib/algorithms/round-robin.ts`) — runs generator with dummy ids for "alle" totals.

## Project Structure
```
src/
  pages/
    LeaderboardPage       — public home, confetti, active/next activity row
    ActivityHistoryPage   — public activity feed
    ActivityDetailPage    — admin drill-down from AdminPage
    AdminPage             — unified admin with 5 tabs (aktiviteter/events/deltakere/rebus/drikke)
    ActivitiesPage        — activities tab content (with ↑↓ draft reordering)
    ContestantsPage       — contestants tab content
    EventsPage            — events tab content
    RebusAdminPage        — rebus tab content (includes Vis + QR buttons)
    DrinkAdminPage        — drink tracking tab content
    StatsPage             — /stats with 8-tab icon grid
    PlayerProfilePage     — /players/:id
    RebusPage             — full-screen hidden rebus view
    DisplayPage           — full-screen TV display (/display)
    LoginPage             — redirects to /admin on success
  components/
    ui/               — Button, Card, Input, Badge
    layout/           — MainLayout, Header, AdminGuard, FloatingAdminButtons
    stats/            — RaceChart, MedalTable, H2HMatrix, ConsistencyChart,
                        PlayerStatCards, HighlightsTab, TimelineTab, DrinkTab
    AnimatedNumber.tsx
    RebusMap.tsx
  hooks/
    use-auth, use-activities, use-matches, use-points, use-leaderboard,
    use-rebus, use-activity-history, use-contestants, use-stats,
    use-drinks, use-next-activity, use-events
  lib/
    algorithms/   — round-robin, double-elimination, points, ranking
    geo.ts, supabase, auth, types, constants, utils
  index.css       — Tailwind + theme + glass/neon utilities
supabase/migrations/ — 001 through 015
```

## Tab Navigation Pattern
Both `StatsPage` and `AdminPage` use a **icon-grid tab bar** instead of a scrollable strip:
- `StatsPage`: 4-column × 2-row grid (8 tabs)
- `AdminPage`: 5-column × 1-row grid (5 tabs)
- Each button: icon on top, label below, `bg-primary/15 ring-1 ring-primary/30` when active
- `AdminPage` tab state lives in `?tab=` query param (deep-linkable); `StatsPage` uses local state.

## Charts (Recharts)
- `RaceChart` accepts `height`, `fontSize`, `strokeWidth`, `inlineLabels` props.
- `inlineLabels` mode (used by `DisplayPage`): hides the bottom `<Legend>`, draws player names at the last data point via the `dot` custom renderer. **Must use `CHART_COLORS_RESOLVED` (hardcoded hex) for both `stroke` and dot `fill`** — CSS vars do not work on SVG attributes.
- `DisplayPage` measures its content container height via `useRef` + `ResizeObserver` pattern and passes the pixel value to `RaceChart`. Never use `height="100%"` on `ResponsiveContainer` — it won't resolve from a flex-derived parent.

## Migrations Applied
```
001  initial_schema
002  auth_functions
003  mutation_functions
004  rebus_tasks
005  avatar_support
006  bracket_propagation
007  team_battle_format
008  multi_team_and_events
009  rebus_settings
010  rebus_reject
011  activity_completed_at
012  clear_match_result
013  reorder_activities      — reorder_activities(token, uuid[]) RPC
014  drink_log               — drink_log table + log_drink / remove_last_drink RPCs
015  voting                  — vote_sessions / vote_options / votes tables + RPCs
                               (voting UI removed from public nav; tables remain)
```

## Commands
```sh
npm run dev       # http://localhost:5173
npm run build     # type-check + production build
npm run lint
npm run preview
vercel deploy --prod   # deploy to production
```

## Naming
Files kebab-case · Components/Types PascalCase · functions/vars camelCase · constants UPPER_SNAKE_CASE · path alias `@/*` → `./src/*`
