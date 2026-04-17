# Design System

**Aesthetic**: Futuristic / styrene / cyberpunk **with bachelor-party beer accents** — glass panels, neon cyan glow, deep blue-black void backgrounds, subtle grid pattern, ambient amber bubbles rising in the background. The cyber base is the primary look; beer elements (amber, foam, bubbles, beer-mug icons) layer on top — they should *complement* the cyan, not replace it.

**Key CSS utilities** (in `src/index.css`):
- `font-display` — Orbitron, uppercase, wide tracking. Use for headlines and section labels.
- `.glass-panel` / `.glass-panel-bright` — translucent blurred panel (replaces card background by default)
- `.neon-border`, `.neon-border-gold`, `.neon-border-silver`, `.neon-border-bronze` — glowing accent borders
- `.text-glow`, `.text-glow-gold` — cyan / gold text shadow glow
- `.bg-grid` — subtle grid background applied to the app shell
- `.animate-fade-up` — standard entrance (use with `animationDelay` for staggered reveals)
- `.animate-pulse-glow` — slow pulsating box-shadow for "live" elements

**Colors** (OKLCH theme variables):
- `--color-primary`: electric cyan — use for CTAs, live indicators, highlights
- `--color-gold / silver / bronze`: medal ranks
- `--color-neon`: purple/magenta secondary accent
- `--color-beer` / `--color-beer-deep`: warm amber, used for beer-themed accents
- `--color-foam`: cream-white, used by `.beer-foam-top`
- `--color-chart-1..8`: chart line colors (OKLCH). **Do not use these as SVG `stroke`/`fill` attributes** — CSS vars don't resolve inside SVG. Use the hardcoded `CHART_COLORS_RESOLVED` array in `RaceChart.tsx` instead.

**Beer-theme utilities**:
- `.beer-foam-top` — adds a creamy, slightly bubbly foam edge above the element.
- `.bg-bubbles` — ambient amber CO2 bubbles drifting up the viewport. Applied once on `MainLayout`'s root wrapper; do NOT stack it on inner containers.
- `.text-glow-beer` — amber text glow shadow.
- `.text-beer` — warm amber text.

**Card component** uses `glass-panel` by default — compose with neon-border utilities for emphasis.

## Live Animations
- `AnimatedNumber` component (`src/components/AnimatedNumber.tsx`) — eased cubic number count-up/down via `requestAnimationFrame`.
- `useLeaderboard` tracks `prevEntriesRef` to compute `pointsDelta` and `rankDelta`, which feed into flash animations and TrendingUp/TrendingDown indicators on the leaderboard.
- Confetti fires in `LeaderboardPage` when any entry gains points — uses a `firedRef` Set keyed on `id:total_points` to fire exactly once per award batch.

## Tab Navigation Pattern
Shared across `StatsPage` and `AdminPage` — icon-grid tabs instead of a scrollable strip:
```tsx
<div className="grid grid-cols-N gap-2">
  <button className={cn(
    'flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-xs font-medium transition-all',
    active
      ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
      : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary',
  )}>
    <Icon className="h-5 w-5 shrink-0" />
    <span className="text-center leading-tight">{label}</span>
  </button>
</div>
```
Use `grid-cols-4` for 8 tabs (2 rows), `grid-cols-5` for 5 tabs (1 row).

## Floating Admin Buttons
`FloatingAdminButtons` (`src/components/layout/FloatingAdminButtons.tsx`) renders fixed bottom-right round icon buttons (TV + QR) for admin users. Placed in `MainLayout` so it's automatically absent from `/rebus/run` and `/display`.

## TV Display Page (`/display`)
- Full-screen, no header, outside `MainLayout`.
- Cycles leaderboard ↔ race chart every 12s with a progress bar.
- `RaceChart` receives `height` as a measured pixel value (via `useRef` + `resize` listener on the content div). Never pass `height="100%"` to `ResponsiveContainer` — it cannot resolve from a flex-derived parent.
- `inlineLabels` mode on `RaceChart`: player names rendered at last data point via custom `dot` renderer. Uses `CHART_COLORS_RESOLVED` (hardcoded hex) for both line stroke and dot fill.
