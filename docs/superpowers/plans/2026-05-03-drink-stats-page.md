# Drink Stats Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new public `/drikke-statistikk` page with hero stats, cumulative race chart, achievement records, and per-player sparklines — all computed from `useDrinks()`.

**Architecture:** Single new `DrinkStatsPage.tsx` page, wired into `App.tsx` and `Header.tsx`. All data helpers are inline functions in the page file. No new hooks or migrations needed.

**Tech Stack:** React 19 + TypeScript 5.9, Recharts (LineChart + BarChart), Tailwind CSS 4, `useDrinks` hook, Lucide React icons.

---

## File Map

| File | Action |
|---|---|
| `src/pages/DrinkStatsPage.tsx` | Create — full page with all sections |
| `src/App.tsx` | Modify — add `/drikke-statistikk` route |
| `src/components/layout/Header.tsx` | Modify — add 5th public nav item |

---

## Task 1: Create DrinkStatsPage

**Files:**
- Create: `src/pages/DrinkStatsPage.tsx`

- [ ] **Step 1: Write the complete DrinkStatsPage component**

Create `/Users/tobias/repos/udl-games/src/pages/DrinkStatsPage.tsx` with this full content:

```tsx
import { useRef, useEffect } from 'react'
import { User, Flame, Moon, Sunrise, Target } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDrinks } from '@/hooks/use-drinks'
import type { DrinkLogEntry } from '@/hooks/use-drinks'
import type { Contestant } from '@/lib/types'

// Must use hardcoded hex — CSS vars don't resolve on SVG attributes
const DRINK_COLORS = [
  '#c9a227',
  '#10b981',
  '#e34c26',
  '#a855f7',
  '#06b6d4',
  '#f472b6',
  '#f59e0b',
  '#3b82f6',
]

// ─── helpers ────────────────────────────────────────────────────────────────

function toHourKey(d: Date): string {
  return (
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}`
  )
}

function keyToLabel(key: string): string {
  const [datePart, hourPart] = key.split('T')
  const d = new Date(`${datePart}T${hourPart}:00:00`)
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) + ' ' + hourPart + ':00'
}

function allHourKeys(logs: DrinkLogEntry[]): string[] {
  if (logs.length === 0) return []
  const times = logs.map((l) => new Date(l.created_at).getTime())
  const start = new Date(Math.min(...times))
  start.setMinutes(0, 0, 0)
  const end = new Date(Math.max(...times))
  end.setMinutes(0, 0, 0)
  const keys: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    keys.push(toHourKey(cur))
    cur.setHours(cur.getHours() + 1)
  }
  return keys
}

function buildCumulativeData(
  logs: DrinkLogEntry[],
  contestantIds: string[],
  hourKeys: string[],
): Array<Record<string, number | string>> {
  // count drinks per contestant per hour
  const counts: Record<string, Record<string, number>> = {}
  for (const log of logs) {
    const key = toHourKey(new Date(log.created_at))
    if (!counts[key]) counts[key] = {}
    counts[key][log.contestant_id] = (counts[key][log.contestant_id] ?? 0) + 1
  }

  const running: Record<string, number> = {}
  contestantIds.forEach((id) => (running[id] = 0))

  return hourKeys.map((key) => {
    contestantIds.forEach((id) => {
      running[id] = (running[id] ?? 0) + (counts[key]?.[id] ?? 0)
    })
    return { label: keyToLabel(key), ...Object.fromEntries(contestantIds.map((id) => [id, running[id]])) }
  })
}

function hottestHour(logs: DrinkLogEntry[]): { contestantId: string; hourKey: string; count: number } | null {
  const counts: Record<string, Record<string, number>> = {}
  for (const log of logs) {
    const key = toHourKey(new Date(log.created_at))
    if (!counts[key]) counts[key] = {}
    counts[key][log.contestant_id] = (counts[key][log.contestant_id] ?? 0) + 1
  }
  let best: { contestantId: string; hourKey: string; count: number } | null = null
  for (const [hourKey, playerCounts] of Object.entries(counts)) {
    for (const [contestantId, count] of Object.entries(playerCounts)) {
      if (!best || count > best.count) {
        best = { contestantId, hourKey, count }
      }
    }
  }
  return best
}

function playerSparkline(
  logs: DrinkLogEntry[],
  contestantId: string,
  hourKeys: string[],
): Array<{ count: number }> {
  const counts: Record<string, number> = {}
  for (const log of logs.filter((l) => l.contestant_id === contestantId)) {
    const key = toHourKey(new Date(log.created_at))
    counts[key] = (counts[key] ?? 0) + 1
  }
  return hourKeys.map((key) => ({ count: counts[key] ?? 0 }))
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
}

// ─── sub-components ─────────────────────────────────────────────────────────

function AvatarOrPlaceholder({ contestant, size = 8 }: { contestant: Contestant; size?: number }) {
  return contestant.avatar_url ? (
    <img
      src={contestant.avatar_url}
      alt={contestant.name}
      className={`w-${size} h-${size} rounded-full object-cover border border-border shrink-0`}
    />
  ) : (
    <div className={`w-${size} h-${size} rounded-full bg-secondary flex items-center justify-center shrink-0`}>
      <User className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}

function HeroCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-secondary/30">
      <div className="font-display text-2xl tracking-wider text-primary">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      <div className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">{label}</div>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export function DrinkStatsPage() {
  const { drinkLogs, drinkCounts, loading } = useDrinks()

  const scrollRef = useRef<HTMLDivElement>(null)

  const hourKeys = allHourKeys(drinkLogs)
  const contestants = drinkCounts.map((d) => d.contestant)
  const contestantMap = new Map(drinkCounts.map((d) => [d.contestant.id, d.contestant]))
  const sortedCounts = [...drinkCounts].sort((a, b) => b.total - a.total)

  const total = drinkCounts.reduce((s, d) => s + d.total, 0)
  const playersWhoTippled = drinkCounts.filter((d) => d.total > 0)
  const avg = playersWhoTippled.length > 0 ? (total / playersWhoTippled.length).toFixed(1) : '0'
  const leader = sortedCounts[0]

  // peak hour across all players
  const hourTotals: Record<string, number> = {}
  for (const log of drinkLogs) {
    const key = toHourKey(new Date(log.created_at))
    hourTotals[key] = (hourTotals[key] ?? 0) + 1
  }
  const peakHourKey = Object.entries(hourTotals).sort((a, b) => b[1] - a[1])[0]?.[0]
  const peakHourLabel = peakHourKey ? peakHourKey.split('T')[1] + ':00' : '–'

  // cumulative chart data
  const contestantIds = contestants.map((c) => c.id)
  const cumulativeData = buildCumulativeData(drinkLogs, contestantIds, hourKeys)

  // achievements
  const hottest = hottestHour(drinkLogs)
  const hottestPlayer = hottest ? contestantMap.get(hottest.contestantId) : null

  const latestByPlayer = new Map<string, number>()
  const earliestByPlayer = new Map<string, number>()
  for (const log of drinkLogs) {
    const t = new Date(log.created_at).getTime()
    if (!latestByPlayer.has(log.contestant_id) || t > latestByPlayer.get(log.contestant_id)!) {
      latestByPlayer.set(log.contestant_id, t)
    }
    if (!earliestByPlayer.has(log.contestant_id) || t < earliestByPlayer.get(log.contestant_id)!) {
      earliestByPlayer.set(log.contestant_id, t)
    }
  }

  const nightOwlEntry = [...latestByPlayer.entries()].sort((a, b) => b[1] - a[1])[0]
  const earlyBirdEntry = [...earliestByPlayer.entries()].sort((a, b) => a[1] - b[1])[0]
  const nightOwlPlayer = nightOwlEntry ? contestantMap.get(nightOwlEntry[0]) : null
  const earlyBirdPlayer = earlyBirdEntry ? contestantMap.get(earlyBirdEntry[0]) : null
  const nightOwlTime = nightOwlEntry
    ? new Date(nightOwlEntry[1]).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
    : null
  const earlyBirdTime = earlyBirdEntry
    ? new Date(earlyBirdEntry[1]).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
    : null

  // most consistent: lowest std dev across hourly counts, requires ≥3 drinking hours
  let consistentPlayer: Contestant | null = null
  let consistentHours = 0
  let bestStdDev = Infinity
  for (const { contestant } of drinkCounts) {
    const hourCounts = hourKeys.map((k) => {
      const ct = drinkLogs.filter((l) => l.contestant_id === contestant.id && toHourKey(new Date(l.created_at)) === k).length
      return ct
    }).filter((c) => c > 0)
    if (hourCounts.length >= 3) {
      const sd = stdDev(hourCounts)
      if (sd < bestStdDev) {
        bestStdDev = sd
        consistentPlayer = contestant
        consistentHours = hourCounts.length
      }
    }
  }

  // auto-scroll chart to right
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [cumulativeData])

  const chartWidth = Math.max(hourKeys.length * 60, 400)

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  if (drinkLogs.length === 0) {
    return (
      <div className="space-y-8 animate-fade-up">
        <div className="text-center pt-4 pb-2">
          <h1 className="font-display text-4xl text-primary tracking-wider text-glow">
            Drikkestatistikk
          </h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Ingen drinks logget ennå 🍺
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="text-center pt-4 pb-2">
        <h1 className="font-display text-4xl text-primary tracking-wider text-glow">
          Drikkestatistikk
        </h1>
        <p className="text-sm text-muted-foreground mt-1 italic">Kveldets drikkeprofil</p>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-3">
        <HeroCell label="Totalt" value={`${total} 🍺`} />
        <HeroCell label="Heteste time" value={peakHourLabel} sub={`${hourTotals[peakHourKey!]} 🍺`} />
        <HeroCell label="Snitt per person" value={`${avg} 🍺`} sub={`${playersWhoTippled.length} spillere`} />
        {leader && (
          <HeroCell
            label="Drikkemester"
            value={leader.contestant.name}
            sub={`${leader.total} 🍺`}
          />
        )}
      </div>

      {/* Cumulative race chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display tracking-wider">Kumulativt løp</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <div className="overflow-x-auto" ref={scrollRef}>
            <div style={{ width: chartWidth }}>
              <LineChart width={chartWidth} height={220} data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-40} textAnchor="end" height={55} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                {contestants.map((c, i) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.id}
                    name={c.name}
                    stroke={DRINK_COLORS[i % DRINK_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
                <Legend formatter={(value) => contestantMap.get(value as string)?.name ?? value} />
              </LineChart>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <div className="grid grid-cols-2 gap-3">
        {/* Raskeste time */}
        {hottest && hottestPlayer && (
          <Card>
            <CardContent className="pt-4 pb-3 px-4 space-y-2">
              <div className="flex items-center gap-1.5 text-orange-400">
                <Flame className="h-4 w-4 shrink-0" />
                <span className="text-xs font-display tracking-wider uppercase">Raskeste time</span>
              </div>
              <div className="flex items-center gap-2">
                <AvatarOrPlaceholder contestant={hottestPlayer} size={7} />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{hottestPlayer.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {hottest.count} 🍺 kl. {hottest.hourKey.split('T')[1]}:00
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Natteravn */}
        {nightOwlPlayer && (
          <Card>
            <CardContent className="pt-4 pb-3 px-4 space-y-2">
              <div className="flex items-center gap-1.5 text-blue-400">
                <Moon className="h-4 w-4 shrink-0" />
                <span className="text-xs font-display tracking-wider uppercase">Natteravn</span>
              </div>
              <div className="flex items-center gap-2">
                <AvatarOrPlaceholder contestant={nightOwlPlayer} size={7} />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{nightOwlPlayer.name}</div>
                  <div className="text-xs text-muted-foreground">Siste drink {nightOwlTime}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tidligfugl */}
        {earlyBirdPlayer && (
          <Card>
            <CardContent className="pt-4 pb-3 px-4 space-y-2">
              <div className="flex items-center gap-1.5 text-yellow-400">
                <Sunrise className="h-4 w-4 shrink-0" />
                <span className="text-xs font-display tracking-wider uppercase">Tidligfugl</span>
              </div>
              <div className="flex items-center gap-2">
                <AvatarOrPlaceholder contestant={earlyBirdPlayer} size={7} />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{earlyBirdPlayer.name}</div>
                  <div className="text-xs text-muted-foreground">Første drink {earlyBirdTime}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jernlever */}
        {consistentPlayer && (
          <Card>
            <CardContent className="pt-4 pb-3 px-4 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Target className="h-4 w-4 shrink-0" />
                <span className="text-xs font-display tracking-wider uppercase">Jernlever</span>
              </div>
              <div className="flex items-center gap-2">
                <AvatarOrPlaceholder contestant={consistentPlayer} size={7} />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{consistentPlayer.name}</div>
                  <div className="text-xs text-muted-foreground">Jevnt over {consistentHours} timer</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Player sparklines */}
      <div>
        <h2 className="font-display text-sm tracking-widest text-muted-foreground px-1 mb-3">
          Spillerprofiler
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {sortedCounts.map(({ contestant, total: playerTotal }, i) => {
            const sparkData = playerSparkline(drinkLogs, contestant.id, hourKeys)
            const color = DRINK_COLORS[i % DRINK_COLORS.length]
            return (
              <Card key={contestant.id}>
                <CardContent className="pt-3 pb-3 px-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AvatarOrPlaceholder contestant={contestant} size={6} />
                    <span className="font-medium text-sm truncate flex-1">{contestant.name}</span>
                    <span className="font-display text-lg shrink-0" style={{ color }}>
                      {playerTotal}
                    </span>
                  </div>
                  {playerTotal > 0 && (
                    <BarChart width={120} height={40} data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Bar dataKey="count" fill={color} isAnimationActive={false} />
                    </BarChart>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors. The `Sunrise` icon is available in `lucide-react`. If it's not found (older version), replace with `Sun`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/DrinkStatsPage.tsx
git commit -m "feat: add DrinkStatsPage with hero stats, cumulative chart, achievements, and sparklines"
```

---

## Task 2: Wire route and nav

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add the route to `src/App.tsx`**

Find the existing import block for pages. Add:
```typescript
import { DrinkStatsPage } from './pages/DrinkStatsPage'
```

Find the route for `/drikk`:
```tsx
<Route path="/drikk" element={<DrinkPage />} />
```

Add directly after it:
```tsx
<Route path="/drikke-statistikk" element={<DrinkStatsPage />} />
```

- [ ] **Step 2: Add the nav link to `src/components/layout/Header.tsx`**

Find the existing lucide-react import line:
```typescript
import { Trophy, Gamepad2, LogIn, LogOut, History, BarChart2, Beer } from 'lucide-react'
```

Add `TrendingUp` to it:
```typescript
import { Trophy, Gamepad2, LogIn, LogOut, History, BarChart2, Beer, TrendingUp } from 'lucide-react'
```

Find the `publicNav` array:
```typescript
const publicNav = [
  { to: '/', label: 'Resultater', icon: Trophy },
  { to: '/activities', label: 'Aktiviteter', icon: History },
  { to: '/stats', label: 'Statistikk', icon: BarChart2 },
  { to: '/drikk', label: 'Drikke', icon: Beer },
]
```

Add the new entry at the end:
```typescript
const publicNav = [
  { to: '/', label: 'Resultater', icon: Trophy },
  { to: '/activities', label: 'Aktiviteter', icon: History },
  { to: '/stats', label: 'Statistikk', icon: BarChart2 },
  { to: '/drikk', label: 'Drikke', icon: Beer },
  { to: '/drikke-statistikk', label: 'Drikkestats', icon: TrendingUp },
]
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/layout/Header.tsx
git commit -m "feat: wire /drikke-statistikk route and nav link"
```

---

## Done

Two tasks, three files, two commits. Navigate to `/drikke-statistikk` to see the full drink stats page.
