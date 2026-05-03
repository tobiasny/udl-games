# Player Profile Drink Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-player hourly drink chart to the player profile page, only visible when the player has drinks logged.

**Architecture:** Single-file change in `PlayerProfilePage.tsx` — add `useDrinks()`, filter logs to the current player, add inline `buildPlayerHourlyData` helper, and render a new `DrinkChartSection` local component after the H2H card.

**Tech Stack:** React 19 + TypeScript 5.9, Recharts (BarChart), Tailwind CSS 4, `useDrinks` hook.

---

## File Map

| File | Action |
|---|---|
| `src/pages/PlayerProfilePage.tsx` | Modify — add imports, helpers, `DrinkChartSection` component, and chart card |

---

## Task 1: Add drink chart to PlayerProfilePage

**Files:**
- Modify: `src/pages/PlayerProfilePage.tsx`

- [ ] **Step 1: Add new imports at the top of the file**

The current import block (lines 1–8) ends with `import { cn } from '@/lib/utils'`. Insert these lines after it:

```typescript
import { useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useDrinks } from '@/hooks/use-drinks'
import type { DrinkLogEntry } from '@/hooks/use-drinks'
```

Full import block after change:
```typescript
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Crown, Medal, Award, User, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useStats } from '@/hooks/use-stats'
import { useLeaderboard } from '@/hooks/use-leaderboard'
import { ACTIVITY_FORMAT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useDrinks } from '@/hooks/use-drinks'
import type { DrinkLogEntry } from '@/hooks/use-drinks'
```

- [ ] **Step 2: Add the `useDrinks` call and filter inside `PlayerProfilePage`**

`PlayerProfilePage` starts at line 14. It currently has two hook calls:
```typescript
const stats = useStats()
const { entries: leaderboard } = useLeaderboard()
```

Add a third call immediately after them, and compute `playerDrinks`:
```typescript
const { drinkLogs } = useDrinks()
const playerDrinks = drinkLogs.filter((l) => l.contestant_id === id)
```

- [ ] **Step 3: Insert the drink chart card after the H2H section**

The H2H section closes at line 235 (`</Card>`) followed by `</div>` at line 236 and `)` at line 237 (end of the component's return).

Insert this JSX between line 235 (`</Card>`) and line 236 (`</div>`):

```tsx
      {/* Drink chart */}
      {playerDrinks.length > 0 && (
        <DrinkChartSection logs={playerDrinks} />
      )}
```

- [ ] **Step 4: Add the helper functions and `DrinkChartSection` component**

After the closing brace of `StatCell` (currently the last thing in the file, ending at line 247), append:

```typescript
interface PlayerDrinkBucket {
  label: string
  drinks: number
}

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

function buildPlayerHourlyData(logs: DrinkLogEntry[]): PlayerDrinkBucket[] {
  if (logs.length === 0) return []
  const counts: Record<string, number> = {}
  for (const log of logs) {
    const key = toHourKey(new Date(log.created_at))
    counts[key] = (counts[key] ?? 0) + 1
  }
  const times = logs.map((l) => new Date(l.created_at).getTime())
  const start = new Date(Math.min(...times))
  start.setMinutes(0, 0, 0)
  const end = new Date(Math.max(...times))
  end.setMinutes(0, 0, 0)
  const result: PlayerDrinkBucket[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const key = toHourKey(cur)
    result.push({ label: keyToLabel(key), drinks: counts[key] ?? 0 })
    cur.setHours(cur.getHours() + 1)
  }
  return result
}

function DrinkChartSection({ logs }: { logs: DrinkLogEntry[] }) {
  const data = buildPlayerHourlyData(logs)
  const scrollRef = useRef<HTMLDivElement>(null)
  const width = Math.max(data.length * 44, 300)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [data])

  return (
    <Card className="animate-fade-up" style={{ animationDelay: '240ms' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display tracking-wider">Drikkeprofil 🍺</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <div className="overflow-x-auto" ref={scrollRef}>
          <div style={{ width }}>
            <BarChart width={width} height={180} data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="drinks" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors. If TypeScript complains about missing Recharts types, they're bundled — no extra install needed.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PlayerProfilePage.tsx
git commit -m "feat: add per-player drink chart to player profile page"
```

- [ ] **Step 7: Manual browser verification**

Start the dev server:
```bash
npm run dev
```

Navigate to `http://localhost:5173/players/<id>` for a player who has drinks logged.

Verify:
- A "Drikkeprofil 🍺" card appears at the bottom of the page
- The chart shows hourly bars, scrolled to the rightmost (latest) position
- Each bar height corresponds to the number of drinks in that hour
- For a player with zero drinks, the card does NOT appear

---

## Done

One task, one file, one commit. Chart appears on the player profile only when the player has drink history.
