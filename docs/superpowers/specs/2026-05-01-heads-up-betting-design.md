# Heads-Up Betting (Veddemål) — Design Spec

**Date:** 2026-05-01  
**Status:** Approved

## Overview

A new feature that lets the admin record a 1v1 zero-sum wager between two players. The loser transfers a specified number of points to the winner. The result is atomic and final — no editing after creation.

---

## Data Model

### Migration 016

1. **CHECK constraint updates** (existing pattern: drop + recreate):
   - `activities_type_check` — add `'wager'` to the allowed values
   - `activities_format_check` — add `'heads_up'` to the allowed values
   - (Both columns are `NOT NULL`; `wager` activities use `format = 'heads_up'`)

2. **New column** — `bet_amount integer` (nullable) on `activities`. Only populated for `type = 'wager'` rows.

3. **New RPC** — `create_wager(token text, player_a_id uuid, player_b_id uuid, bet_amount int, winner_id uuid)`

   The RPC is the single entry point and does everything atomically:
   - Validates admin token via existing `verify_admin_token()`.
   - Validates both players exist, are distinct, and `winner_id` is one of them.
   - Validates `bet_amount > 0`.
   - Checks **both** players currently have `≥ bet_amount` total points (prevents either from going negative regardless of outcome).
   - Inserts an `activities` row: `type='wager'`, `status='completed'`, `name='Veddemål: [A] vs [B]'`, `bet_amount=N`.
   - Inserts a single `matches` row with the two players in `match_players`.
   - Inserts two `points` rows: `+bet_amount` for `winner_id`, `-bet_amount` for the loser.
   - Returns the new activity `id`.

   Error cases (all raise `EXCEPTION`):
   - Invalid token → `'Ugyldig token'`
   - Unknown player → `'Spiller ikke funnet'`
   - Same player twice → `'Spillerne må være forskjellige'`
   - `bet_amount ≤ 0` → `'Innsatsen må være minst 1 poeng'`
   - `winner_id` not one of the two players → `'Vinneren må være en av de to spillerne'`
   - Insufficient balance (either player) → `'[Name] har ikke nok poeng (trenger [N], har [M])'`

### Existing tables used without change

| Table | Role |
|---|---|
| `activities` | Stores the wager as a completed activity with `bet_amount` |
| `matches` | One row per wager (the single head-to-head match) |
| `match_players` | Links the two players to the match |
| `points` | Stores `+N` / `−N` rows; leaderboard SUM handles negatives automatically |

---

## Admin UI

### Tab grid

`AdminPage` tab grid changes from `grid-cols-5` to `grid-cols-6`. New 6th tab: icon `Swords`, label `Veddemål`.

### WagerAdminPage (`src/pages/WagerAdminPage.tsx`)

**Creation form (top card):**

| Field | Control | Notes |
|---|---|---|
| Spiller A | Contestant dropdown | All active contestants |
| Spiller B | Contestant dropdown | Excludes A selection |
| Innsats | Integer input | Must be > 0 |
| Vinner | Two-button toggle | Shows selected player names; neither selected by default |

- Inline validation feedback: if either player's current balance < entered amount, show a per-player warning (e.g. "Ole har bare 3 poeng") and disable the submit button.
- Submit button label: **"Opprett veddemål"** — disabled until all fields valid.
- On success: clears form, refreshes wager list.
- On error: displays the RPC error message in a banner.

**Past wagers list (bottom):**
- Fetched from activities where `type = 'wager'`, ordered newest-first.
- Each row: "[A] vs [B] — [Winner] vant [N] poeng — [date]"
- Read-only; no edit or delete.

### Hook: `use-wagers.ts`

Follows existing hook pattern:
- `wagers` — fetched via two parallel queries: `activities` filtered to `type='wager'` (ordered newest-first) + all `points` rows for those activity IDs. The winner for each wager is the contestant whose points amount is positive.
- `createWager(playerAId, playerBId, betAmount, winnerId)` — calls `create_wager` RPC, throws on error, refetches on success

---

## Public History Feed (`/activities`)

`ActivityHistoryPage` adds a branch for `type === 'wager'`. Renders a wager card:

```
⚔️  Veddemål
    [Player A]  vs  [Player B]
    [Winner] vant [N] poeng fra [Loser]
```

- Winner is inferred from the sign of the `points` entries (positive = winner).
- `bet_amount` is read directly from the activity row.
- No new query — the existing history hook is extended to include `bet_amount`.

---

## Out of Scope

- Editing or deleting a wager after creation.
- Player-initiated wagers (admin-only).
- Asymmetric bets (both players always stake the same amount).
- Wager challenges / pending states — creation and resolution are one step.
- Any changes to `/leaderboard`, `/stats`, or `/players/:id` — point rows are indistinguishable from other awards.
