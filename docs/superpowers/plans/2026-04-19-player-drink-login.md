# Player Login + Self-Serve Drink Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-player PIN login so each contestant can log their own drinks from a dedicated `/drikk` page, without touching the existing admin auth system.

**Architecture:** New `player_sessions` DB table + 4 RPCs mirror the admin session pattern. A `usePlayerAuth` hook stores the 48h token in `localStorage`. `DrinkPage` handles both the PIN login flow and the authenticated drink-logging view with optimistic updates and a 5s tap cooldown.

**Tech Stack:** React 19, TypeScript 5.9, Supabase RPC, Tailwind CSS 4, Lucide React, `extensions.crypt` (bcrypt via pgcrypto already enabled)

**Spec:** `docs/superpowers/specs/2026-04-19-player-drink-login-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/017_player_auth.sql` | DB schema + all 4 RPCs |
| Modify | `src/lib/types.ts` | Add `pin_hash` to Contestant |
| Create | `src/hooks/use-player-auth.ts` | Player session management (localStorage, 48h) |
| Modify | `src/hooks/use-drinks.ts` | Add `logDrinkSelf(playerToken)` |
| Modify | `src/hooks/use-contestants.ts` | Add `setPlayerPin(contestantId, pin)` |
| Create | `src/pages/DrinkPage.tsx` | `/drikk` — login + authenticated drink view |
| Modify | `src/App.tsx` | Add `/drikk` route |
| Modify | `src/components/layout/Header.tsx` | Add beer icon nav link |
| Modify | `src/pages/ContestantsPage.tsx` | Inline PIN management per contestant row |

---

## Task 1: DB Migration `017_player_auth`

**Files:**
- Create: `supabase/migrations/017_player_auth.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/017_player_auth.sql
-- Player auth: per-player PIN + sessions for self-serve drink logging.
-- Admin auth (admin_sessions, verify_admin) is completely unchanged.

-- Add PIN hash to contestants (nullable — no PIN until admin sets one)
ALTER TABLE contestants ADD COLUMN pin_hash text;

-- Player sessions (separate from admin_sessions)
CREATE TABLE player_sessions (
  token         text PRIMARY KEY,
  contestant_id uuid NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL
);

ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;
-- No public read policy — sessions are private

-- Authenticate a player: verify bcrypt PIN, create 48h session, return token.
-- Returns NULL on bad PIN or missing PIN.
CREATE OR REPLACE FUNCTION authenticate_player(
  contestant_id_input uuid,
  pin_input           text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_hash text;
  new_token   text;
BEGIN
  SELECT pin_hash INTO stored_hash
    FROM contestants
    WHERE id = contestant_id_input;

  IF stored_hash IS NULL THEN
    RETURN NULL;
  END IF;

  IF stored_hash != extensions.crypt(pin_input, stored_hash) THEN
    RETURN NULL;
  END IF;

  new_token := encode(gen_random_bytes(32), 'hex');

  -- Clean up expired player sessions
  DELETE FROM player_sessions WHERE expires_at < now();

  INSERT INTO player_sessions (token, contestant_id, expires_at)
  VALUES (new_token, contestant_id_input, now() + interval '48 hours');

  RETURN new_token;
END;
$$;

-- Log a drink for the player identified by the session token.
-- Contestant id is derived from the token — player can only log for themselves.
CREATE OR REPLACE FUNCTION log_drink_self(
  player_token_input text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cid uuid;
BEGIN
  SELECT contestant_id INTO cid
    FROM player_sessions
    WHERE token = player_token_input AND expires_at > now();

  IF cid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO drink_log (contestant_id) VALUES (cid);
END;
$$;

-- Return contestant_id for a valid player token (used to hydrate UI on page reload).
-- Returns NULL if token is invalid or expired.
CREATE OR REPLACE FUNCTION get_player_session(
  player_token_input text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cid uuid;
BEGIN
  SELECT contestant_id INTO cid
    FROM player_sessions
    WHERE token = player_token_input AND expires_at > now();
  RETURN cid;
END;
$$;

-- Admin: set a contestant's PIN (bcrypt-hashed, same pattern as admin password).
CREATE OR REPLACE FUNCTION set_player_pin(
  token_input         text,
  contestant_id_input uuid,
  pin_input           text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE contestants
    SET pin_hash = extensions.crypt(pin_input, extensions.gen_salt('bf'))
    WHERE id = contestant_id_input;
END;
$$;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with:
- `name`: `017_player_auth`
- `query`: the full SQL above

- [ ] **Step 3: Verify RPCs exist**

Use `mcp__supabase__execute_sql` to run:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'authenticate_player',
    'log_drink_self',
    'get_player_session',
    'set_player_pin'
  );
```
Expected: 4 rows returned.

- [ ] **Step 4: Verify `pin_hash` column and `player_sessions` table**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'contestants' AND column_name = 'pin_hash';

SELECT table_name FROM information_schema.tables
WHERE table_name = 'player_sessions';
```
Expected: both return 1 row each.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/017_player_auth.sql
git commit -m "feat: add player_sessions table and auth RPCs (migration 017)"
```

---

## Task 2: Types + `usePlayerAuth` hook

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/hooks/use-player-auth.ts`

- [ ] **Step 1: Add `pin_hash` to Contestant type in `src/lib/types.ts`**

Find the `Contestant` interface (currently lines 13–18) and add `pin_hash`:

```typescript
export interface Contestant {
  id: string
  name: string
  avatar_url: string | null
  pin_hash: string | null
  created_at: string
}
```

- [ ] **Step 2: Create `src/hooks/use-player-auth.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const PLAYER_SESSION_KEY = 'udl_player_session'

export function usePlayerAuth() {
  const [contestantId, setContestantId] = useState<string | null>(null)
  const [playerToken, setPlayerToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem(PLAYER_SESSION_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    const { data } = await supabase.rpc('get_player_session', {
      player_token_input: token,
    })
    if (data) {
      setContestantId(data as string)
      setPlayerToken(token)
    } else {
      localStorage.removeItem(PLAYER_SESSION_KEY)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = useCallback(async (
    contestantIdInput: string,
    pin: string,
  ): Promise<boolean> => {
    const { data } = await supabase.rpc('authenticate_player', {
      contestant_id_input: contestantIdInput,
      pin_input: pin,
    })
    if (!data) return false
    localStorage.setItem(PLAYER_SESSION_KEY, data as string)
    setPlayerToken(data as string)
    setContestantId(contestantIdInput)
    return true
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(PLAYER_SESSION_KEY)
    setPlayerToken(null)
    setContestantId(null)
  }, [])

  return { contestantId, playerToken, loading, login, logout }
}
```

- [ ] **Step 3: Type-check**

```bash
npm run build
```
Expected: exits 0 with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/hooks/use-player-auth.ts
git commit -m "feat: add Contestant.pin_hash type and usePlayerAuth hook"
```

---

## Task 3: Update `use-drinks.ts` and `use-contestants.ts`

**Files:**
- Modify: `src/hooks/use-drinks.ts`
- Modify: `src/hooks/use-contestants.ts`

- [ ] **Step 1: Add `logDrinkSelf` to `src/hooks/use-drinks.ts`**

After the existing `removeLastDrink` function (currently ending around line 67), add:

```typescript
  const logDrinkSelf = async (playerToken: string) => {
    const { error } = await supabase.rpc('log_drink_self', {
      player_token_input: playerToken,
    })
    if (error) throw error
    await fetchAll()
  }
```

Update the return statement to include `logDrinkSelf`:

```typescript
  return { drinkCounts, drinkLogs, loading, logDrink, removeLastDrink, logDrinkSelf, refetch: fetchAll }
```

- [ ] **Step 2: Add `setPlayerPin` to `src/hooks/use-contestants.ts`**

After the existing `deleteContestant` function, add:

```typescript
  const setPlayerPin = async (contestantId: string, pin: string) => {
    const { error } = await supabase.rpc('set_player_pin', {
      token_input: sessionToken,
      contestant_id_input: contestantId,
      pin_input: pin,
    })
    if (error) throw error
  }
```

Update the return statement:

```typescript
  return { contestants, loading, addContestant, updateContestant, updateAvatar, deleteContestant, setPlayerPin, refetch: fetchContestants }
```

- [ ] **Step 3: Type-check**

```bash
npm run build
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-drinks.ts src/hooks/use-contestants.ts
git commit -m "feat: add logDrinkSelf and setPlayerPin to hooks"
```

---

## Task 4: `DrinkPage.tsx`

**Files:**
- Create: `src/pages/DrinkPage.tsx`

- [ ] **Step 1: Create `src/pages/DrinkPage.tsx`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { Beer, User, X } from 'lucide-react'
import { usePlayerAuth } from '@/hooks/use-player-auth'
import { useDrinks } from '@/hooks/use-drinks'
import { useContestants } from '@/hooks/use-contestants'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Contestant } from '@/lib/types'

export function DrinkPage() {
  const { contestantId, playerToken, loading: authLoading, login, logout } = usePlayerAuth()
  const { contestants, loading: contestantsLoading } = useContestants()
  const { drinkCounts, loading: drinksLoading, logDrinkSelf } = useDrinks()

  // Login state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginPending, setLoginPending] = useState(false)

  // Drink tap state
  const [flashGreen, setFlashGreen] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [optimisticDelta, setOptimisticDelta] = useState(0)
  const [, forceUpdate] = useState(0)

  // Re-render when cooldown expires so the button re-enables automatically
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const ms = cooldownUntil - Date.now()
    const t = setTimeout(() => forceUpdate((n) => n + 1), ms)
    return () => clearTimeout(t)
  }, [cooldownUntil])

  const submitPin = useCallback(async (pinValue: string) => {
    if (!selectedId) return
    setLoginPending(true)
    setLoginError('')
    const success = await login(selectedId, pinValue)
    setLoginPending(false)
    if (!success) {
      setPin('')
      setLoginError('Feil PIN-kode')
    }
  }, [selectedId, login])

  function handlePinDigit(digit: string) {
    if (loginPending) return
    const next = pin.length < 4 ? pin + digit : pin
    setPin(next)
    if (next.length === 4 && selectedId) {
      void submitPin(next)
    }
  }

  function handleSelectContestant(id: string) {
    setSelectedId(id)
    setPin('')
    setLoginError('')
  }

  async function handleDrink() {
    if (!playerToken || Date.now() < cooldownUntil) return
    setOptimisticDelta((d) => d + 1)
    setFlashGreen(true)
    setCooldownUntil(Date.now() + 5000)
    setTimeout(() => setFlashGreen(false), 2000)
    try {
      await logDrinkSelf(playerToken)
      setOptimisticDelta(0)
    } catch {
      setOptimisticDelta((d) => d - 1)
    }
  }

  if (authLoading || contestantsLoading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  if (!contestantId || !playerToken) {
    return (
      <LoginView
        contestants={contestants}
        selectedId={selectedId}
        pin={pin}
        error={loginError}
        pending={loginPending}
        onSelectContestant={handleSelectContestant}
        onPinDigit={handlePinDigit}
        onBackspace={() => setPin((p) => p.slice(0, -1))}
      />
    )
  }

  // Authenticated view — sort by drinks desc, then name asc for stable ordering
  const sorted = [...drinkCounts].sort(
    (a, b) => b.total - a.total || a.contestant.name.localeCompare(b.contestant.name),
  )
  const myIdx = sorted.findIndex((d) => d.contestant.id === contestantId)
  const myData = sorted[myIdx]
  const myCount = (myData?.total ?? 0) + optimisticDelta
  const above = myIdx > 0 ? sorted[myIdx - 1] : null
  const below = myIdx < sorted.length - 1 ? sorted[myIdx + 1] : null
  const grandTotal = drinkCounts.reduce((s, d) => s + d.total, 0) + optimisticDelta
  const isCoolingDown = Date.now() < cooldownUntil
  const myContestant = myData?.contestant

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beer className="h-5 w-5" />
          <span className="font-display tracking-wider">{myContestant?.name}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground gap-1.5">
          <X className="h-3.5 w-3.5" />
          <span className="text-xs">Logg ut</span>
        </Button>
      </div>

      {/* Counter */}
      <div className="text-center">
        <div
          className={cn(
            'font-display text-8xl font-bold transition-colors duration-300',
            flashGreen ? 'text-green-400' : 'text-foreground',
          )}
        >
          {myCount}
        </div>
        <div className="text-sm text-muted-foreground mt-1">drinker</div>
      </div>

      {/* Big drink button */}
      <Button
        className={cn(
          'w-full h-20 text-2xl font-bold gap-3 transition-all duration-300',
          flashGreen
            ? 'bg-green-500 hover:bg-green-500 shadow-[0_0_32px_rgba(74,222,128,0.4)]'
            : 'shadow-[0_0_24px_rgba(99,102,241,0.3)]',
        )}
        onClick={handleDrink}
        disabled={isCoolingDown}
      >
        {isCoolingDown ? (
          <span className="text-sm tracking-widest opacity-60">Venter...</span>
        ) : (
          <>🍺 +1</>
        )}
      </Button>

      {/* Drink-rank context: show neighbors only when there are multiple players */}
      {sorted.length > 1 && (
        <div className="space-y-1 text-sm">
          {above && (
            <div className="flex justify-between text-muted-foreground px-2">
              <span>↑ {above.contestant.name}</span>
              <span>{above.total}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-primary px-2 py-1 rounded-lg bg-primary/10">
            <span>{myContestant?.name}</span>
            <span>{myCount}</span>
          </div>
          {below && (
            <div className="flex justify-between text-muted-foreground px-2">
              <span>↓ {below.contestant.name}</span>
              <span>{below.total}</span>
            </div>
          )}
        </div>
      )}

      {/* Party total */}
      <div className="text-center text-sm text-muted-foreground border-t border-border pt-4">
        Fest-total: 🍺 {grandTotal}
      </div>
    </div>
  )
}

// --- Login sub-view ---

interface LoginViewProps {
  contestants: Contestant[]
  selectedId: string | null
  pin: string
  error: string
  pending: boolean
  onSelectContestant: (id: string) => void
  onPinDigit: (digit: string) => void
  onBackspace: () => void
}

function LoginView({
  contestants,
  selectedId,
  pin,
  error,
  pending,
  onSelectContestant,
  onPinDigit,
  onBackspace,
}: LoginViewProps) {
  return (
    <div className="space-y-5 pt-2">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 text-center">
          Hvem er du?
        </p>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {contestants.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectContestant(c.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors text-left',
                selectedId === c.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:bg-accent/50 text-foreground',
              )}
            >
              {c.avatar_url ? (
                <img
                  src={c.avatar_url}
                  alt={c.name}
                  className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <span className="font-medium">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedId && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest text-center">
            PIN-kode
          </p>

          {/* 4-dot PIN indicator */}
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-10 h-12 rounded-xl border flex items-center justify-center text-xl transition-colors',
                  i < pin.length
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card',
                )}
              >
                {i < pin.length ? '●' : ''}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          {pending && (
            <p className="text-xs text-muted-foreground text-center animate-pulse">
              Sjekker...
            </p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                onClick={() => onPinDigit(d)}
                className="h-12 rounded-xl border border-border bg-card text-foreground text-lg font-medium hover:bg-accent/50 transition-colors active:scale-95"
              >
                {d}
              </button>
            ))}
            <div />
            <button
              onClick={() => onPinDigit('0')}
              className="h-12 rounded-xl border border-border bg-card text-foreground text-lg font-medium hover:bg-accent/50 transition-colors active:scale-95"
            >
              0
            </button>
            <button
              onClick={onBackspace}
              className="h-12 rounded-xl border border-border bg-card text-muted-foreground hover:bg-accent/50 transition-colors active:scale-95"
            >
              ⌫
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/pages/DrinkPage.tsx
git commit -m "feat: add DrinkPage with login flow and drink-logging view"
```

---

## Task 5: Wire up route and nav

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add `/drikk` route to `src/App.tsx`**

Add the `DrinkPage` import at the top with the other page imports:

```typescript
import { DrinkPage } from '@/pages/DrinkPage'
```

Inside the `<Route element={<MainLayout />}>` block, add the new route after the `/stats` route:

```typescript
<Route path="/drikk" element={<DrinkPage />} />
```

The full routes block should look like:

```typescript
<Route element={<MainLayout />}>
  <Route path="/" element={<LeaderboardPage />} />
  <Route path="/activities" element={<ActivityHistoryPage />} />
  <Route path="/stats" element={<StatsPage />} />
  <Route path="/drikk" element={<DrinkPage />} />
  <Route path="/players/:id" element={<PlayerProfilePage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route
    path="/admin"
    element={<AdminGuard><AdminPage /></AdminGuard>}
  />
  <Route
    path="/admin/activities/:id"
    element={<AdminGuard><ActivityDetailPage /></AdminGuard>}
  />
</Route>
```

- [ ] **Step 2: Add beer nav link to `src/components/layout/Header.tsx`**

Add `Beer` to the lucide-react import:

```typescript
import { Trophy, Gamepad2, LogIn, LogOut, History, BarChart2, Beer } from 'lucide-react'
```

Add `/drikk` to the `publicNav` array:

```typescript
const publicNav = [
  { to: '/', label: 'Resultater', icon: Trophy },
  { to: '/activities', label: 'Aktiviteter', icon: History },
  { to: '/stats', label: 'Statistikk', icon: BarChart2 },
  { to: '/drikk', label: 'Drikke', icon: Beer },
]
```

- [ ] **Step 3: Type-check and build**

```bash
npm run build
```
Expected: exits 0.

- [ ] **Step 4: Smoke-test manually**

```bash
npm run dev
```

Navigate to `http://localhost:5173/drikk`. Verify:
- Page loads showing the contestant list
- Beer icon appears in the header nav
- Selecting a contestant reveals the PIN numpad

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/Header.tsx
git commit -m "feat: add /drikk route and nav link"
```

---

## Task 6: Admin PIN management in `ContestantsPage`

**Files:**
- Modify: `src/pages/ContestantsPage.tsx`

- [ ] **Step 1: Add `Key` icon and PIN state to `ContestantsPage.tsx`**

Update the import line to add `Key`:

```typescript
import { Users, Plus, Trash2, Pencil, Check, X, ImagePlus, User, Key } from 'lucide-react'
```

Add `setPlayerPin` to the hook destructure:

```typescript
const { contestants, loading, addContestant, updateContestant, updateAvatar, deleteContestant, setPlayerPin } = useContestants()
```

Add two new state variables after the existing state declarations (after `const [error, setError] = useState('')`):

```typescript
const [pinEditId, setPinEditId] = useState<string | null>(null)
const [pinValue, setPinValue] = useState('')
```

- [ ] **Step 2: Add `handlePinSave` handler**

Add this function after `handleDelete`:

```typescript
async function handlePinSave(id: string) {
  if (!pinValue.trim()) return
  setError('')
  try {
    await setPlayerPin(id, pinValue.trim())
    setPinEditId(null)
    setPinValue('')
  } catch {
    setError('Kunne ikke sette PIN')
  }
}
```

- [ ] **Step 3: Add inline PIN section to each contestant card**

Inside the `<Card>` for each contestant (after the existing avatar URL editor block, around line 174), add:

```typescript
{/* PIN editor */}
{pinEditId === c.id ? (
  <div className="flex gap-2 items-center pl-12">
    <input
      type="password"
      inputMode="numeric"
      maxLength={4}
      placeholder="4-sifret PIN"
      value={pinValue}
      onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
      onKeyDown={(e) => e.key === 'Enter' && handlePinSave(c.id)}
      autoFocus
      className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm font-mono tracking-widest text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    />
    <Button size="sm" variant="ghost" onClick={() => handlePinSave(c.id)}>
      <Check className="h-4 w-4" />
    </Button>
    <Button size="sm" variant="ghost" onClick={() => { setPinEditId(null); setPinValue('') }}>
      <X className="h-4 w-4" />
    </Button>
  </div>
) : (
  <div className="flex items-center gap-2 pl-12">
    <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    <span className="text-xs text-muted-foreground flex-1">
      {c.pin_hash ? '••••' : 'Ingen PIN'}
    </span>
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-xs text-muted-foreground"
      onClick={() => { setPinEditId(c.id); setPinValue('') }}
    >
      {c.pin_hash ? 'Endre' : 'Sett'}
    </Button>
  </div>
)}
```

The PIN display row should sit between the avatar URL editor block and the closing `</CardContent>` tag. The final structure per card is:
1. Name / edit-name row
2. Avatar URL editor (conditional)
3. PIN display / edit (always visible)

- [ ] **Step 4: Type-check**

```bash
npm run build
```
Expected: exits 0.

- [ ] **Step 5: Smoke-test manually**

```bash
npm run dev
```

Log in as admin, go to Admin → Deltakere. Verify:
- Each contestant row shows key icon + "Ingen PIN" or "••••"
- Clicking "Sett" opens an inline PIN input
- Entering 4 digits and pressing Enter (or the check icon) calls `set_player_pin` and dismisses the editor
- After setting a PIN, the row shows "••••" and a "Endre" button

Then navigate to `/drikk`:
- Select the contestant whose PIN you just set
- Enter the correct PIN on the numpad
- Confirm you reach the authenticated drink view
- Tap "🍺 +1" — count increments, button flashes green, then greys out for ~5s
- After 5s the button re-enables

- [ ] **Step 6: Commit**

```bash
git add src/pages/ContestantsPage.tsx
git commit -m "feat: add inline PIN management to ContestantsPage"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: exits 0, no TypeScript errors.

- [ ] **Step 2: End-to-end manual walkthrough**

```bash
npm run dev
```

Run through the full flow:

1. Admin sets a PIN for a contestant (Admin → Deltakere → "Sett")
2. Open `/drikk` in a private/incognito tab
3. Select the contestant → enter PIN → land on drink view
4. Tap "🍺 +1": count increments, green flash, 5s lock
5. After 5s: button re-enables
6. Open the admin drink panel (Admin → Drikke) and confirm the drink appears there
7. Close and reopen the tab — verify you're still logged in (48h session in localStorage)
8. Confirm the Beer icon appears in the header nav on all pages

- [ ] **Step 3: Push branch**

```bash
git push origin claude/plan-activity-webapp-2mKJ6
```
