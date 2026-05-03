# Player Profile Drink Chart — Design Spec

**Date:** 2026-05-03  
**Status:** Approved

## Overview

Add a per-player hourly drink chart to `PlayerProfilePage`. Only shown when the player has at least one drink logged. No new files; all changes are inline in `PlayerProfilePage.tsx`.

---

## Changes — `src/pages/PlayerProfilePage.tsx`

### 1. New hook call

Add `useDrinks()` alongside the existing `useStats()` and `useLeaderboard()` calls:

```typescript
const { drinkLogs } = useDrinks()
const playerDrinks = drinkLogs.filter((l) => l.contestant_id === id)
```

### 2. Inline helper functions (copied & simplified from `DrinkTab`)

The stacked-chart helpers from `DrinkTab` are simplified to a single-series version:

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
```

### 3. Chart section (added after H2H card, before closing `</div>`)

Only rendered when `playerDrinks.length > 0`:

```tsx
{playerDrinks.length > 0 && (
  <DrinkChartSection logs={playerDrinks} />
)}
```

Where `DrinkChartSection` is a small local component (defined at the bottom of the file) that:
- Calls `buildPlayerHourlyData(logs)`
- Has a `scrollRef` (`useRef<HTMLDivElement>`) + `useEffect` that scrolls to `scrollRef.current.scrollWidth` on data change (same auto-scroll-to-right as `DrinkTab`)
- Renders a `Card` with title "Drikkeprofil 🍺" and a horizontally scrollable `BarChart` (Recharts):
  - Width: `Math.max(data.length * 44, 300)` — same formula as `DrinkTab` (44 px per bar, min 300 px)
  - Single `<Bar dataKey="drinks" fill="#10b981" radius={[3,3,0,0]} />`  
  - `<XAxis dataKey="label" />`, `<YAxis allowDecimals={false} />`, `<Tooltip />`, `<CartesianGrid strokeDasharray="3 3" />`
  - Bar fill: `'#10b981'` (hardcoded hex — CSS vars don't work on SVG attributes, per codebase rules)

### 4. Imports added

```typescript
import { useRef, useEffect } from 'react'   // not yet imported in PlayerProfilePage — add to existing React import
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useDrinks } from '@/hooks/use-drinks'
import type { DrinkLogEntry } from '@/hooks/use-drinks'
```

---

## Out of Scope

- Changes to `DrinkTab` or shared utilities
- Showing the player's drink count relative to other players
- Admin controls (log/remove) on the profile page
