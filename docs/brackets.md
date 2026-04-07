# Bracket Propagation Model

Double-elimination bracket matches need to advance winners/losers into downstream slots. The schema and propagation flow are non-obvious — read this before touching anything bracket-related.

## Schema (per match)
`team1_source_match` + `team1_source_from` (`'winner'|'loser'`) and `team2_source_match` + `team2_source_from`. Each team slot is either pre-filled (winners-bracket round 1) or sourced from another match's winner OR loser. The legacy `source_match_winner`/`source_match_loser` columns from migration 001 are no longer used by app code — leave them alone but don't reference them.

## Generation
`generateDoubleElimination` emits `BracketMatch[]` with explicit `team1Source` / `team2Source` per slot. The `temp_id` on each match is mapped to a real uuid by `create_bracket_matches` in two passes (insert all, then resolve sources).

## Propagation
`set_match_result` SQL: when a match completes, finds every match that references it via `team1_source_match` or `team2_source_match`, deletes any prior players in that slot, and inserts the matching winning/losing players. Re-running with a different result correctly replaces the propagated players, so corrections work. The grand-final reset row is auto-deleted when the winners-bracket champion (team1 of GF1) wins GF1, since no reset is needed.

## Point auto-proposal flow
In `ActivityDetailPage`: once `allMatchesComplete` is true, `proposedPoints` is computed from `computeRoundRobinRanking` / `computeBracketRanking` + `rankingToPoints`. The proposal is auto-pushed into the editable inputs only while the user hasn't manually edited or loaded saved points (`pointsTouched` flag). Points are NOT persisted to the leaderboard until the user clicks "Fullfor og tildel poeng", which calls `savePoints` then `updateActivityStatus('completed')` in that order — a failure in `savePoints` must short-circuit the status change.

## Bye limitation
The bracket generator currently assumes a power-of-2 number of teams. Non-power-of-2 inputs are padded with `null` and will leave bye matches that don't propagate. Fix this only when actually needed.
