# Heads-Up Betting (Veddemål) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 1v1 zero-sum wager feature where the admin records a bet between two players — the loser transfers a specified number of points to the winner — visible in the public activity history.

**Architecture:** A new `wager` activity type sits in the existing `activities` table with a `bet_amount` column; a single `create_wager` RPC handles the entire flow atomically. A new "Veddemål" tab in `AdminPage` renders `WagerAdminPage` for input. The public `/activities` feed gains a `WagerCard` component for `type === 'wager'` entries.

**Tech Stack:** PostgreSQL (Supabase RPC), React 19 + TypeScript 5.9, Tailwind CSS 4, Lucide React icons.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/021_wager.sql` | Create | CHECK constraint updates, `bet_amount` column, `create_wager` RPC |
| `src/lib/types.ts` | Modify | Add `'wager'` to `ActivityType`, `'heads_up'` to `ActivityFormat`, `bet_amount` to `Activity` |
| `src/lib/constants.ts` | Modify | Add `wager`/`heads_up` entries to all `Record<ActivityType/Format, …>` maps |
| `src/hooks/use-wagers.ts` | Create | Fetch wagers + point rows; expose `createWager()` mutation |
| `src/pages/WagerAdminPage.tsx` | Create | Creation form + past-wagers list |
| `src/pages/AdminPage.tsx` | Modify | Add 6th "Veddemål" tab, import `WagerAdminPage` |
| `src/pages/ActivityHistoryPage.tsx` | Modify | Add `WagerCard` component; branch completed list on `type === 'wager'` |

---

## Task 1: Migration 016 — wager schema & RPC

**Files:**
- Create: `supabase/migrations/021_wager.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 021_wager.sql
-- Extends the activities table to support zero-sum 1v1 wagers.

-- 1. Expand the type CHECK to allow 'wager'
ALTER TABLE activities DROP CONSTRAINT activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
  CHECK (type IN (
    'free_for_all', '1v1', '2v2', '3v3', '4v4', '2v2v2v2', 'event', 'wager'
  ));

-- 2. Expand the format CHECK to allow 'heads_up'
ALTER TABLE activities DROP CONSTRAINT activities_format_check;
ALTER TABLE activities ADD CONSTRAINT activities_format_check
  CHECK (format IN (
    'free_for_all', 'round_robin', 'double_elimination',
    'team_battle', 'multi_team_battle', 'event', 'heads_up'
  ));

-- 3. Store the bet amount on the activity row (nullable; only set for wagers)
ALTER TABLE activities ADD COLUMN bet_amount integer;

-- 4. Atomic wager creation RPC
CREATE OR REPLACE FUNCTION create_wager(
  token_input     text,
  player_a_id     uuid,
  player_b_id     uuid,
  bet_amount_input integer,
  winner_id       uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_activity_id uuid;
  new_match_id    uuid;
  loser_id        uuid;
  name_a          text;
  name_b          text;
  balance_a       bigint;
  balance_b       bigint;
BEGIN
  -- Auth
  PERFORM verify_admin(token_input);

  -- Basic validation
  IF player_a_id = player_b_id THEN
    RAISE EXCEPTION 'Spillerne må være forskjellige';
  END IF;

  IF bet_amount_input <= 0 THEN
    RAISE EXCEPTION 'Innsatsen må være minst 1 poeng';
  END IF;

  IF winner_id != player_a_id AND winner_id != player_b_id THEN
    RAISE EXCEPTION 'Vinneren må være en av de to spillerne';
  END IF;

  -- Resolve names (also validates both players exist)
  SELECT name INTO name_a FROM contestants WHERE id = player_a_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spiller ikke funnet'; END IF;

  SELECT name INTO name_b FROM contestants WHERE id = player_b_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spiller ikke funnet'; END IF;

  -- Balance check: both players must be able to afford the bet
  SELECT COALESCE(SUM(p.amount), 0) INTO balance_a
    FROM points p WHERE p.contestant_id = player_a_id;

  IF balance_a < bet_amount_input THEN
    RAISE EXCEPTION '% har ikke nok poeng (trenger %, har %)', name_a, bet_amount_input, balance_a;
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) INTO balance_b
    FROM points p WHERE p.contestant_id = player_b_id;

  IF balance_b < bet_amount_input THEN
    RAISE EXCEPTION '% har ikke nok poeng (trenger %, har %)', name_b, bet_amount_input, balance_b;
  END IF;

  -- Derive loser
  loser_id := CASE WHEN winner_id = player_a_id THEN player_b_id ELSE player_a_id END;

  -- Create activity
  INSERT INTO activities (name, type, format, status, sort_order, num_rounds, bet_amount)
  VALUES (
    'Veddemål: ' || name_a || ' vs ' || name_b,
    'wager', 'heads_up', 'completed',
    (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM activities),
    1,
    bet_amount_input
  )
  RETURNING id INTO new_activity_id;

  -- Link both players as activity contestants
  INSERT INTO activity_contestants (activity_id, contestant_id)
  VALUES (new_activity_id, player_a_id), (new_activity_id, player_b_id);

  -- Create the single match
  INSERT INTO matches (activity_id, round, status, winning_team)
  VALUES (new_activity_id, 1, 'completed', CASE WHEN winner_id = player_a_id THEN 1 ELSE 2 END)
  RETURNING id INTO new_match_id;

  INSERT INTO match_players (match_id, contestant_id, team)
  VALUES (new_match_id, player_a_id, 1), (new_match_id, player_b_id, 2);

  -- Award points: +bet to winner, -bet to loser
  INSERT INTO points (activity_id, contestant_id, amount)
  VALUES
    (new_activity_id, winner_id,  bet_amount_input),
    (new_activity_id, loser_id,  -bet_amount_input);

  RETURN new_activity_id;
END;
$$;
```

- [ ] **Step 2: Apply the migration via Supabase MCP or CLI**

If using CLI:
```bash
supabase db push
```

If using the Supabase MCP `apply_migration` tool, pass the full SQL content above with migration name `021_wager`.

Verify: in the Supabase dashboard (or via `list_tables`), confirm that `activities` now has a `bet_amount` column.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/021_wager.sql
git commit -m "feat: migration 016 — wager activity type and create_wager RPC"
```

---

## Task 2: TypeScript types & constants

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Update `ActivityType` and `ActivityFormat` in `src/lib/types.ts`**

Find the two type lines at the top of the file and change them to:

```typescript
export type ActivityType = 'free_for_all' | '1v1' | '2v2' | '3v3' | '4v4' | '2v2v2v2' | 'event' | 'wager'
export type ActivityFormat =
  | 'free_for_all'
  | 'round_robin'
  | 'double_elimination'
  | 'team_battle'
  | 'multi_team_battle'
  | 'event'
  | 'heads_up'
```

- [ ] **Step 2: Add `bet_amount` to the `Activity` interface in `src/lib/types.ts`**

After the `completed_at` line in the `Activity` interface, add:

```typescript
  bet_amount: number | null
```

Full interface after change:
```typescript
export interface Activity {
  id: string
  name: string
  type: ActivityType
  format: ActivityFormat
  status: ActivityStatus
  sort_order: number
  num_rounds: number
  created_at: string
  completed_at: string | null
  bet_amount: number | null
}
```

- [ ] **Step 3: Update constants in `src/lib/constants.ts`**

Add `wager: 0` to `TEAM_SIZES`:
```typescript
export const TEAM_SIZES: Record<ActivityType, number> = {
  free_for_all: 0,
  '1v1': 1,
  '2v2': 2,
  '3v3': 3,
  '4v4': 4,
  '2v2v2v2': 2,
  event: 0,
  wager: 0,
}
```

Add `wager: 'Veddemål'` to `ACTIVITY_TYPE_LABELS`:
```typescript
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  free_for_all: 'Free for All',
  '1v1': '1v1',
  '2v2': '2v2',
  '3v3': '3v3',
  '4v4': '4v4',
  '2v2v2v2': '2v2v2v2',
  event: 'Event',
  wager: 'Veddemål',
}
```

Add `heads_up: 'Veddemål'` to `ACTIVITY_FORMAT_LABELS`:
```typescript
export const ACTIVITY_FORMAT_LABELS: Record<ActivityFormat, string> = {
  free_for_all: 'Free for All',
  round_robin: 'Round Robin',
  double_elimination: 'Double Elimination',
  team_battle: 'Lagkamp',
  multi_team_battle: '4-lags kamp',
  event: 'Event',
  heads_up: 'Veddemål',
}
```

Add `wager: ['heads_up']` to `VALID_FORMATS`:
```typescript
export const VALID_FORMATS: Record<ActivityType, ActivityFormat[]> = {
  free_for_all: ['free_for_all'],
  '1v1': ['round_robin', 'double_elimination'],
  '2v2': ['round_robin', 'double_elimination'],
  '3v3': ['round_robin', 'team_battle'],
  '4v4': ['team_battle'],
  '2v2v2v2': ['multi_team_battle'],
  event: ['event'],
  wager: ['heads_up'],
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no type errors. If TypeScript complains about an exhaustive `Record` missing `'wager'` or `'heads_up'`, add the entry to the flagged map.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add wager ActivityType and heads_up ActivityFormat to types and constants"
```

---

## Task 3: `use-wagers` hook

**Files:**
- Create: `src/hooks/use-wagers.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Activity, Contestant, Points } from '@/lib/types'

export interface WagerEntry {
  activity: Activity
  winner: Contestant
  loser: Contestant
  betAmount: number
}

export function useWagers() {
  const [wagers, setWagers] = useState<WagerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchAll = useCallback(async () => {
    const [activitiesRes, contestantsRes] = await Promise.all([
      supabase
        .from('activities')
        .select('*')
        .eq('type', 'wager')
        .order('created_at', { ascending: false }),
      supabase.from('contestants').select('*'),
    ])

    const activities = (activitiesRes.data ?? []) as Activity[]
    const contestants = (contestantsRes.data ?? []) as Contestant[]
    const contestantMap = new Map(contestants.map((c) => [c.id, c]))

    if (activities.length === 0) {
      setWagers([])
      setLoading(false)
      return
    }

    const activityIds = activities.map((a) => a.id)
    const { data: pointsData } = await supabase
      .from('points')
      .select('*')
      .in('activity_id', activityIds)

    const points = (pointsData ?? []) as Points[]

    const entries: WagerEntry[] = activities.flatMap((activity) => {
      const activityPoints = points.filter((p) => p.activity_id === activity.id)
      const winnerPoints = activityPoints.find((p) => p.amount > 0)
      const loserPoints = activityPoints.find((p) => p.amount < 0)
      if (!winnerPoints || !loserPoints) return []
      const winner = contestantMap.get(winnerPoints.contestant_id)
      const loser = contestantMap.get(loserPoints.contestant_id)
      if (!winner || !loser) return []
      return [{ activity, winner, loser, betAmount: winnerPoints.amount }]
    })

    setWagers(entries)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const createWager = async (
    playerAId: string,
    playerBId: string,
    betAmount: number,
    winnerId: string,
  ) => {
    const { error } = await supabase.rpc('create_wager', {
      token_input: sessionToken,
      player_a_id: playerAId,
      player_b_id: playerBId,
      bet_amount_input: betAmount,
      winner_id: winnerId,
    })
    if (error) throw error
    await fetchAll()
  }

  return { wagers, loading, createWager }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-wagers.ts
git commit -m "feat: add use-wagers hook"
```

---

## Task 4: `WagerAdminPage` component

**Files:**
- Create: `src/pages/WagerAdminPage.tsx`

The component needs contestant balances for inline validation. It fetches them from the `leaderboard` view (which exposes `total_points`) since that's the same source the RPC uses.

- [ ] **Step 1: Write the component**

```typescript
import { useState, useEffect } from 'react'
import { Swords, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useContestants } from '@/hooks/use-contestants'
import { useWagers } from '@/hooks/use-wagers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { LeaderboardEntry } from '@/lib/types'

export function WagerAdminPage() {
  const { contestants } = useContestants()
  const { wagers, loading, createWager } = useWagers()

  const [playerAId, setPlayerAId] = useState('')
  const [playerBId, setPlayerBId] = useState('')
  const [betAmount, setBetAmount] = useState('')
  const [winnerId, setWinnerId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [balances, setBalances] = useState<Map<string, number>>(new Map())

  // Fetch current leaderboard balances for validation
  useEffect(() => {
    supabase
      .from('leaderboard')
      .select('id, total_points')
      .then(({ data }) => {
        if (data) {
          setBalances(new Map((data as LeaderboardEntry[]).map((e) => [e.id, e.total_points])))
        }
      })
  }, [wagers]) // refresh after each wager is created

  const bet = parseInt(betAmount, 10)
  const validBet = !isNaN(bet) && bet > 0
  const balanceA = playerAId ? (balances.get(playerAId) ?? 0) : null
  const balanceB = playerBId ? (balances.get(playerBId) ?? 0) : null
  const aCanAfford = balanceA === null || !validBet || balanceA >= bet
  const bCanAfford = balanceB === null || !validBet || balanceB >= bet

  const canSubmit =
    playerAId &&
    playerBId &&
    playerAId !== playerBId &&
    validBet &&
    winnerId &&
    aCanAfford &&
    bCanAfford &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      await createWager(playerAId, playerBId, bet, winnerId)
      setPlayerAId('')
      setPlayerBId('')
      setBetAmount('')
      setWinnerId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setSubmitting(false)
    }
  }

  const playerA = contestants.find((c) => c.id === playerAId)
  const playerB = contestants.find((c) => c.id === playerBId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5" />
        <h1 className="text-xl font-display tracking-wider">Veddemål</h1>
      </div>

      {/* Creation form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display tracking-wider">Nytt veddemål</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Player selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Spiller A</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={playerAId}
                  onChange={(e) => {
                    setPlayerAId(e.target.value)
                    if (winnerId && winnerId !== playerBId) setWinnerId('')
                  }}
                >
                  <option value="">Velg spiller…</option>
                  {contestants.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.id === playerBId}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {playerAId && validBet && !aCanAfford && (
                  <p className="text-xs text-destructive">
                    {playerA?.name} har bare {balanceA} poeng
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Spiller B</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={playerBId}
                  onChange={(e) => {
                    setPlayerBId(e.target.value)
                    if (winnerId && winnerId !== playerAId) setWinnerId('')
                  }}
                >
                  <option value="">Velg spiller…</option>
                  {contestants.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.id === playerAId}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {playerBId && validBet && !bCanAfford && (
                  <p className="text-xs text-destructive">
                    {playerB?.name} har bare {balanceB} poeng
                  </p>
                )}
              </div>
            </div>

            {/* Bet amount */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Innsats (poeng)</label>
              <Input
                type="number"
                min={1}
                placeholder="0"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-32"
              />
            </div>

            {/* Winner toggle — only shown when both players are selected */}
            {playerA && playerB && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Vinner</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={winnerId === playerA.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWinnerId(playerA.id)}
                  >
                    {playerA.name}
                  </Button>
                  <Button
                    type="button"
                    variant={winnerId === playerB.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWinnerId(playerB.id)}
                  >
                    {playerB.name}
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={!canSubmit}>
              {submitting ? 'Oppretter…' : 'Opprett veddemål'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Past wagers */}
      {!loading && wagers.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display text-sm tracking-widest text-muted-foreground px-1">
            Historikk
          </h2>
          {wagers.map((w) => (
            <Card key={w.activity.id}>
              <CardContent className="flex items-center gap-3 py-3 px-4 text-sm">
                <Swords className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1">
                  <span className="font-medium text-primary">{w.winner.name}</span>
                  {' vant '}
                  <span className="font-display text-primary">{w.betAmount}</span>
                  {' poeng fra '}
                  <span className="font-medium">{w.loser.name}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(w.activity.created_at).toLocaleDateString('nb-NO', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors. The `useContestants` hook must already expose `contestants`; if not, check `src/hooks/use-contestants.ts` for the correct export name.

- [ ] **Step 3: Commit**

```bash
git add src/pages/WagerAdminPage.tsx
git commit -m "feat: add WagerAdminPage component"
```

---

## Task 5: Add "Veddemål" tab to `AdminPage`

**Files:**
- Modify: `src/pages/AdminPage.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/pages/AdminPage.tsx`, add the import:

```typescript
import { WagerAdminPage } from './WagerAdminPage'
```

Also update the icon import line to include `Swords`:

```typescript
import { Gamepad2, Sparkles, Users, Settings, Beer, Swords } from 'lucide-react'
```

- [ ] **Step 2: Add the tab definition**

Find the `TABS` array and add the Veddemål entry:

```typescript
const TABS = [
  { key: 'aktiviteter', label: 'Aktiviteter', icon: Gamepad2 },
  { key: 'events',      label: 'Events',      icon: Sparkles },
  { key: 'deltakere',   label: 'Deltakere',   icon: Users },
  { key: 'rebus',       label: 'Rebus',       icon: Settings },
  { key: 'drikke',      label: 'Drikke',      icon: Beer },
  { key: 'veddemaal',   label: 'Veddemål',    icon: Swords },
] as const
```

- [ ] **Step 3: Change the grid from 5 to 6 columns**

Find the class `grid grid-cols-5` and change it to:

```
grid grid-cols-6
```

- [ ] **Step 4: Add the tab content branch**

In the tab content section, add after the `drikke` branch:

```tsx
{activeTab === 'veddemaal' && <WagerAdminPage />}
```

- [ ] **Step 5: Verify TypeScript compiles and start dev server**

```bash
npm run build && npm run dev
```

Open `http://localhost:5173/admin` (after logging in). Confirm:
- Six tabs are visible in the grid
- "Veddemål" tab shows the form with player selectors, bet amount, and winner toggle
- No console errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "feat: add Veddemål tab to AdminPage"
```

---

## Task 6: Wager card in public activity history

**Files:**
- Modify: `src/pages/ActivityHistoryPage.tsx`

- [ ] **Step 1: Add `Swords` to the lucide import**

Find the existing lucide import line in `ActivityHistoryPage.tsx` and add `Swords`:

```typescript
import { Radio, Trophy, History, User, Hourglass, ChevronDown, Sparkles, Swords } from 'lucide-react'
```

- [ ] **Step 2: Branch the completed list on `type === 'wager'`**

Find the `completed.map(...)` block (around line 63) and update it:

```tsx
{completed.map((item, i) =>
  item.activity.type === 'wager' ? (
    <WagerCard key={item.activity.id} data={item} index={i} />
  ) : item.activity.format === 'event' ? (
    <EventCard key={item.activity.id} data={item} index={i} />
  ) : (
    <CompletedActivityCard key={item.activity.id} data={item} index={i} />
  ),
)}
```

- [ ] **Step 3: Add the `WagerCard` component**

Add this function at the bottom of `ActivityHistoryPage.tsx` (after `EventCard`):

```typescript
function WagerCard({ data, index }: { data: ActivityWithStandings; index: number }) {
  const { activity, standings } = data
  const winner = standings.find((s) => s.points > 0)
  const loser = standings.find((s) => s.points < 0)

  return (
    <Card style={{ animationDelay: `${index * 60}ms` }}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary shrink-0" />
          <CardTitle className="font-display text-lg tracking-wider">Veddemål</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {winner && loser ? (
          <div className="flex items-center gap-3 px-2 py-1">
            {winner.contestant.avatar_url ? (
              <img
                src={winner.contestant.avatar_url}
                alt={winner.contestant.name}
                className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <span className="text-sm">
              <span className="font-medium text-primary">{winner.contestant.name}</span>
              {' vant '}
              <span className="font-display text-primary">{activity.bet_amount}</span>
              {' poeng fra '}
              <span className="font-medium">{loser.contestant.name}</span>
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground px-2">Veddemål</p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: End-to-end browser test**

With the dev server running (`npm run dev`):

1. Log in to admin (`/admin`)
2. Go to the "Veddemål" tab
3. Create a wager: pick two players with sufficient points, enter a bet amount, pick a winner, submit
4. Confirm: the wager appears in the "Historikk" list on the Veddemål tab
5. Navigate to `/activities` (public)
6. Confirm: the wager appears as a card with "⚔️ Veddemål — [Winner] vant [N] poeng fra [Loser]"
7. Navigate to `/` (Leaderboard)
8. Confirm: winner's total increased by N, loser's total decreased by N

Also verify error cases:
- Enter a bet amount larger than a player's balance → warning appears, submit button disabled
- Select the same player twice → submit button stays disabled

- [ ] **Step 6: Commit**

```bash
git add src/pages/ActivityHistoryPage.tsx
git commit -m "feat: add WagerCard to public activity history feed"
```

---

## Done

All six tasks complete. The feature is live: admin records wagers in the Veddemål tab, results appear in the public `/activities` history, and the leaderboard updates automatically via the existing `points` SUM.
