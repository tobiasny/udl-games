# Drink Stats Page — Design Spec

**Date:** 2026-05-03  
**Status:** Approved (self-designed, user said "just implement")

## Overview

New public page `/drikke-statistikk` with rich drinking insights. Accessible via a new nav item "Drikkestats" (TrendingUp icon) in the Header. All data computed client-side from `useDrinks()` — no new DB queries.

---

## New Files

- `src/pages/DrinkStatsPage.tsx`

## Modified Files

- `src/App.tsx` — add `/drikke-statistikk` route
- `src/components/layout/Header.tsx` — add 5th public nav item

---

## Page Sections

### 1. Page header
Title "Drikkestatistikk 🍺", subtitle "Kveldets drikkeprofil".

### 2. Hero stat row (2×2 grid of stat cells)
| Stat | Computation |
|---|---|
| **Totalt** | `sum(drinkCounts[].total)` |
| **Heteste time** | Hour key with most total drinks → formatted `"HH:00"` |
| **Snitt per person** | `total / playersWhoAt least1Drink` — 1 decimal, e.g. `"4.2 🍺"` |
| **Drikkemester** | `drinkCounts.sort desc [0].contestant.name` + total |

### 3. Kumulativt løp (cumulative line chart)
- Recharts `LineChart`
- X axis: hour bucket labels (all hours first→last drink)
- Y axis: cumulative drinks (integer)
- One `<Line>` per player, colored with `DRINK_COLORS` (hardcoded hex — CSS vars don't work on SVG)
- Horizontally scrollable, auto-scrolls to right on mount
- Legend below chart (player name + color swatch)
- Data shape: `{ label: string; [contestantId]: number }[]` — each entry is cumulative count at that hour

### 4. Rekorder (2×2 grid of achievement cards)
Each card: icon, Norwegian title, winner name + avatar, descriptor line.

| Achievement | Icon | Computation |
|---|---|---|
| **Raskeste time** | 🔥 | Group logs by `contestantId + hourKey`, find max count. Shows player + hour + count. |
| **Natteravn** | 🦉 | Per player: `max(created_at)`. Find player with globally latest drink. Shows time. |
| **Tidligfugl** | 🐓 | Per player: `min(created_at)`. Find player with globally earliest drink. Shows time. |
| **Jernlever** | 🎯 | Per player with ≥ 3 drinking hours: compute std dev of hourly counts. Lowest std dev wins. Shows "jevnt over N timer". |

### 5. Spillerprofiler (player sparkline grid)
- 2-column grid, one card per player (sorted by total desc)
- Each card: avatar, name, total (large font), tiny inline BarChart (height 50px, no axes/labels/grid)
- Bar color: `DRINK_COLORS[i % 8]` per player
- X data: hourly buckets (same range as hero chart), Y: count that hour

---

## Empty State

If `drinkLogs.length === 0`: single card "Ingen drinks logget ennå 🍺".

---

## Data Helpers (all inline in DrinkStatsPage.tsx)

```typescript
// Reuse same toHourKey / keyToLabel as DrinkTab (duplicated inline — no shared util)
function toHourKey(d: Date): string
function keyToLabel(key: string): string  // Norwegian locale

// Returns all hour labels from first to last drink
function allHourLabels(logs: DrinkLogEntry[]): string[]  // returns keyToLabel(key) for each bucket

// Builds cumulative line data
function buildCumulativeData(
  logs: DrinkLogEntry[],
  contestantIds: string[],
  hourKeys: string[]  // sorted, from allHourKeys()
): Array<{ label: string; [id: string]: number }>

// Returns { contestantId, hourKey, count } for the single hottest hour
function hottestHour(logs: DrinkLogEntry[]): { contestantId: string; hourKey: string; count: number } | null

// Returns { label, count }[] for a single player (sparkline data)
function playerSparkline(
  logs: DrinkLogEntry[],
  contestantId: string,
  hourKeys: string[]
): Array<{ count: number }>
```

---

## Routing & Nav

- **Route:** `/drikke-statistikk` → `<DrinkStatsPage />`  
- **Header:** Add `{ to: '/drikke-statistikk', label: 'Drikkestats', icon: TrendingUp }` as 5th public nav item  
- **Active detection:** `location.pathname === '/drikke-statistikk'`
