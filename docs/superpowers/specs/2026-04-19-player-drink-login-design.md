# Player Login + Self-Serve Drink Tracking

**Date:** 2026-04-19
**Status:** Approved

## Overview

Players can log in to the app using a per-player PIN set by the admin, then log their own drinks from a dedicated `/drikk` page. Admin auth is unchanged.

## Database (migration `017_player_auth`)

### Schema changes

```sql
-- Add nullable PIN hash to contestants
ALTER TABLE contestants ADD COLUMN pin_hash text;

-- Player sessions (separate from admin_sessions)
CREATE TABLE player_sessions (
  token      text PRIMARY KEY,
  contestant_id uuid NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;
-- No public read — sessions are private
```

### New RPCs

| RPC | Auth | Description |
|-----|------|-------------|
| `authenticate_player(contestant_id_input uuid, pin_input text) → text` | none | Verifies PIN against `contestants.pin_hash`, inserts into `player_sessions` with 48h expiry, returns token. Returns NULL on bad PIN. |
| `log_drink_self(player_token_input text) → void` | player session | Looks up `contestant_id` from `player_sessions`, inserts into `drink_log`. Player can only ever log for themselves — no contestant_id param. |
| `get_player_session(player_token_input text) → uuid` | none | Returns `contestant_id` for a valid, non-expired player token. Returns NULL if invalid/expired. Used to hydrate UI on reload. |
| `set_player_pin(token_input text, contestant_id_input uuid, pin_input text) → void` | admin | Hashes pin with bcrypt, stores in `contestants.pin_hash`. Gated behind `verify_admin`. |

### Security notes

- `log_drink_self` derives contestant_id from the token — a player cannot log a drink for anyone else.
- Player sessions expire after 48 hours.
- PINs are bcrypt-hashed via `extensions.crypt` (same pattern as admin password).
- `player_sessions` has no public read policy.

## Frontend

### New files

**`src/hooks/use-player-auth.ts`**
- Mirrors the `use-auth` pattern but for player sessions.
- Stores token in `localStorage` under `udl_player_session` (persists across tabs/reloads, survives 48h).
- On init, calls `get_player_session(token)` to validate and hydrate `contestantId`.
- Exposes: `contestantId: string | null`, `playerToken: string | null`, `loading: boolean`, `login(contestantId, pin) → Promise<boolean>`, `logout() → void`.
- Does NOT share context with admin auth — completely separate.

**`src/pages/DrinkPage.tsx`**
- Route: `/drikk`
- Always visible in nav (beer icon).
- **Unauthenticated state:** scrollable list of all contestants (name + avatar); tap to select. PIN numpad (0–9 + backspace) appears below, with 4 dot indicators. Auto-submits when 4 digits are entered. Shows error on bad PIN without revealing which field was wrong.
- **Authenticated state:**
  - Player name displayed at top.
  - Large counter showing own drink total (Orbitron font).
  - Big `🍺 +1` button (full-width, glowing purple).
  - Tap feedback: count increments immediately (optimistic), button + counter flash green for 2s, button disabled for 5s cooldown showing "Venter..." text inside the button. Prevents accidental double-tap.
  - Below button: drink-rank context — player directly above and below on the drink leaderboard (name + count), with the current player highlighted between them. Edge cases: if player is ranked first, only show the player below; if ranked last, only show the player above; if only one player exists, omit the neighbors section entirely.
  - Footer: party-wide total drink count.
- **Data:** reuses `useDrinks()` for counts/totals; calls new `logDrinkSelf(playerToken)` for mutations.

### Modified files

**`src/hooks/use-drinks.ts`**
- Add `logDrinkSelf(playerToken: string) → Promise<void>` calling `log_drink_self` RPC.
- Existing `logDrink` (admin) and `removeLastDrink` (admin) unchanged.

**`src/pages/ContestantsPage.tsx`**
- Each contestant row gets an inline PIN field: shows masked `••••` if PIN is set, `—` if not.
- "Endre" (if set) or "Sett" (if not set) button opens an inline edit mode on that row.
- In edit mode: text input (type=number, maxLength=4) + "Lagre" and "Avbryt" buttons.
- On save: calls `set_player_pin(adminToken, contestantId, pin)`. Shows error inline on failure.

**`src/components/layout/Header.tsx`**
- Add beer icon (`Beer` from lucide-react) nav link to `/drikk`.
- Visible to all users (not gated behind `isAdmin`).

**`src/App.tsx`**
- Add `<Route path="/drikk" element={<DrinkPage />} />` inside `MainLayout`.

## Admin auth

No changes. Admin password, sessions, `verify_admin`, `useAuth`, and all admin RPCs are untouched.

## UX flow summary

```
Player opens /drikk
  → sees contestant list
  → taps their name
  → enters 4-digit PIN on numpad
  → on success: persistent session stored, drink screen shown
  → taps 🍺 +1
    → count increments instantly
    → green flash for 2s
    → button locked for 5s
    → drink logged to DB in background
```

## Out of scope

- Players cannot undo/remove their own drinks (admin can via DrinkAdminPage).
- Players cannot see other players' individual counts on this page (only their own, neighbors, and party total).
- No player logout UI required (session expires naturally after 48h).
