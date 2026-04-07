# Data Flow & CRUD Conventions

## State Management
- React Context API for auth (`AuthContext`)
- Custom hooks per domain: `use-auth`, `use-activities`, `use-activity-history`, `use-contestants`, `use-matches`, `use-points`, `use-leaderboard`, `use-rebus`
- Hook pattern: `useState` + `useCallback` fetchers + `useEffect` for initial load + optional polling
- All mutations go through Supabase RPC functions with `sessionToken`

## Fetching
- Public tables (`contestants`, `activities`, `activity_contestants`, `matches`, `match_players`, `points`, `leaderboard`, `rebus_tasks`) have RLS `SELECT` policies for all, so reads use `supabase.from('table').select()` directly — no RPC indirection.
- **Prefer embedded selects over multiple round trips.** When fetching a parent + children (e.g. matches + match_players), use Supabase's nested select syntax: `supabase.from('matches').select('*, match_players(*)')`. `useMatches` is the canonical example — it fetches both in one query and splits the result into the two flat arrays the rest of the app consumes.

## Mutating
- Every mutation goes through `supabase.rpc('function_name', { token_input, ... })`. The RPC's first action is always `PERFORM verify_admin(token_input)`.
- **Mutations live in domain hooks, not in pages.** Pages call `useActivities().deleteActivity(id)` rather than `supabase.rpc('delete_activity', ...)` themselves. This keeps the auth-token wiring in one place per domain and makes future schema changes a single-file edit. The bracket-generation calls in `ActivityDetailPage` are the only intentional exception (they're page-specific glue between an algorithm and an RPC).
- Hooks follow a uniform contract: each mutation function `await`s the RPC, **throws on `error`**, then `await`s the relevant `fetch*` to refresh local state. Never swallow errors silently.
- After mutation, the hook refetches the list it owns. Keep this strict — UI state should never diverge from server state mid-flow.

## Calling mutations from pages
- Wrap every mutation handler in a try/catch (or a small `runAction` helper) and surface failures to the user. The `ActivityDetailPage.runAction(label, fn)` helper is the reference pattern: it clears any prior error, runs the action, and on throw sets a banner-displayed `actionError` plus a `console.error`. Never leave a `void`-thrown promise from a button handler.
- For multi-step mutations (e.g. "save points then mark completed"), order them so that a failure in step N short-circuits step N+1 — `handleCompleteAndAward` is the canonical example. The activity must NOT be marked completed if the points save throws.

## Auth token reactivity
- `useAuthProvider` keeps `sessionToken` in React state (initialized lazily from `sessionStorage` via `useState(() => getSessionToken())`). It is updated explicitly in `login`, `logout`, and `checkAuth`. Do not read `sessionStorage` directly in render paths or in hook dependency arrays.

## Auth
- Single admin password, validated via Supabase RPC (`authenticate_admin`).
- Session token in `sessionStorage` (not persistent across browser close), exposed reactively via `useAuth().sessionToken`.
- `AdminGuard` component wraps protected admin routes.
- Default password from seed: `admin123` (change via SQL).
