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
- `--color-beer` / `--color-beer-deep`: warm amber, used for beer-themed accents (icons, dividers, glow)
- `--color-foam`: cream-white, used by `.beer-foam-top`

**Beer-theme utilities**:
- `.beer-foam-top` — adds a creamy, slightly bubbly foam edge above the element. Use to "crown" hero sections that should feel like a freshly poured pint.
- `.bg-bubbles` — ambient amber CO2 bubbles drifting up the viewport. Applied once on `MainLayout`'s root wrapper; do NOT stack it on inner containers (the bubbles use `position: fixed` and would just duplicate).
- `.text-glow-beer` — amber text glow shadow.
- `.text-beer` / `text-beer` Tailwind class — warm amber text.
- Beer mug icon: `Beer` from `lucide-react`. Use sparingly as a decorative accent next to the "MM" unit and in hero sections.

**Card component** uses `glass-panel` by default — compose with neon-border utilities for emphasis.

## Live Animations
- `AnimatedNumber` component (`src/components/AnimatedNumber.tsx`) — eased cubic number count-up/down via `requestAnimationFrame`.
- `useLeaderboard` tracks `prevEntriesRef` to compute `pointsDelta` and `rankDelta`, which feed into flash animations and TrendingUp/TrendingDown indicators.
