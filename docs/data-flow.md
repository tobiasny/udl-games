# Data Flow & CRUD Conventions

## State Management
- React Context API for auth (`AuthContext`)
- Custom hooks per domain: `use-auth`, `use-activities`, `use-activity-history`, `use-contestants`, `use-matches`, `use-points`, `use-leaderboard`, `use-rebus`, `use-stats`, `use-drinks`, `use-next-activity`, `use-events`
- Hook pattern: `useState` + `useCallback` fetchers + `useEffect` for initial load + optional polling interval
- All mutations go through Supabase RPC functions with `sessionToken`

## Fetching
- Public tables have RLS `SELECT` policies for all, so reads use `supabase.from('table').select()` directly — no RPC indirection.
- **Prefer embedded selects over multiple round trips.** When fetching a parent + children (e.g. matches + match_players), use Supabase's nested select syntax: `supabase.from('matches').select('*, match_players(*)')`. `useMatches` is the canonical example.
- Polling hooks follow the pattern:
  ```ts
  const fetchAll = useCallback(async () => { ... }, [])
  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const interval = setInterval(fetchAll, N)
    return () => clearInterval(interval)
  }, [fetchAll])
  ```

## Mutating
- Every mutation goes through `supabase.rpc('function_name', { token_input, ... })`. The RPC's first action is always `PERFORM verify_admin(token_input)`.
- **Mutations live in domain hooks, not in pages.** Pages call `useActivities().deleteActivity(id)` rather than `supabase.rpc('delete_activity', ...)` themselves. This keeps the auth-token wiring in one place per domain and makes future schema changes a single-file edit. The bracket-generation calls in `ActivityDetailPage` are the only intentional exception.
- Hooks follow a uniform contract: each mutation function `await`s the RPC, **throws on `error`**, then `await`s the relevant `fetch*` to refresh local state. Never swallow errors silently.
- After mutation, the hook refetches the list it owns. Keep this strict — UI state should never diverge from server state mid-flow.

## Calling mutations from pages
- Wrap every mutation handler in a try/catch (or a small `runAction` helper) and surface failures to the user. The `ActivityDetailPage.runAction(label, fn)` helper is the reference pattern: it clears any prior error, runs the action, and on throw sets a banner-displayed `actionError`.
- For multi-step mutations (e.g. "save points then mark completed"), order them so that a failure in step N short-circuits step N+1.

## Auth token reactivity
- `useAuthProvider` keeps `sessionToken` in React state (initialized lazily from `sessionStorage` via `useState(() => getSessionToken())`). It is updated explicitly in `login`, `logout`, and `checkAuth`. Do not read `sessionStorage` directly in render paths or in hook dependency arrays.

## Auth
- Single admin password, validated via Supabase RPC (`authenticate_admin`).
- Session token in `sessionStorage` (not persistent across browser close), exposed reactively via `useAuth().sessionToken`.
- `AdminGuard` component wraps the `/admin` and `/admin/activities/:id` routes.
- Default password from seed: `admin123` (change via SQL).

## Drink Tracking (`use-drinks`)
- `drink_log` table: one row per drink, `contestant_id + day ('friday'|'saturday')`.
- `useDrinks()` returns `DrinkCount[]` — per-contestant friday/saturday/total counts.
- Mutations: `logDrink(contestantId, day)` and `removeLastDrink(contestantId, day)` — both admin-gated RPCs.
- Polls every 10s.

## Activity Reordering (`use-activities`)
- `reorderActivities(orderedIds: string[])` calls `reorder_activities` RPC which sets `sort_order = index * 10` for each id in the array.
- `ActivitiesPage` keeps optimistic local ordering in `draftOrder` state (reset on next fetch).

## Voting tables (schema only — UI removed)
- `vote_sessions`, `vote_options`, `votes` tables exist in the DB (migration 015).
- Public voting UI (`/stemme`, `/admin/stemme`) was removed from the app. The tables remain in case the feature is re-enabled.
