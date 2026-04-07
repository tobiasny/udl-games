# Activity Formats

The `(type, format)` matrix is defined by `VALID_FORMATS` in `src/lib/constants.ts`. The format CHECK constraint on `activities.format` lives in migration `007_team_battle_format.sql`:

| type           | format(s)                       | matches table? | notes |
|----------------|---------------------------------|----------------|-------|
| `free_for_all` | `free_for_all`                  | no             | Player-by-player ranking with arrow controls. No matches generated. |
| `1v1/2v2/3v3`  | `round_robin`, `double_elim.`   | yes            | RR uses `create_round_robin_matches`; DE uses `create_bracket_matches` + propagation. |
| `4v4`          | `team_battle`                   | yes            | Single random split into two teams; N matches between the same two teams. |

## `activities.num_rounds` semantics
The field is otherwise dead — DON'T treat it as "number of rounds" generically:
- `round_robin`: max number of matches the generator should emit (cap). `0` / unset → "alle" (uncapped). The create-activity form resolves blank input to the computed `countAllRoundRobinMatches` value before persisting, so by the time `ActivityDetailPage` reads it, it's always an explicit positive integer.
- `team_battle`: number of matches between the two teams (defaults to 1).
- `free_for_all` / `double_elimination`: ignored.

**Round count is set BEFORE activity creation**, in the create form on `ActivitiesPage`. Do not re-introduce a post-creation max-matches input on `ActivityDetailPage` — generation reads `activity.num_rounds` directly.

## Team battle implementation
`team_battle` reuses the round-robin matches RPC (`create_round_robin_matches`) — it's structurally identical (matches table + match_players, no bracket pointers). `handleGenerateTeamBattle` shuffles `activityContestantIds`, slices in half, then submits N copies of the same `{team1, team2, round}` row. Re-clicking the generate button re-shuffles because the RPC deletes existing matches for the activity first. The team rosters are recovered from `match_players` of the first match — there's no separate "teams" table.

## Team battle points
`computeTeamBattlePoints` counts per-team wins, awards `suggestFreeForAllPoints(2)` = `[4, 2]` to winners/losers, or the rounded average (`3`) to both teams on a tie. It's wired into `proposedPoints` in `ActivityDetailPage` as a special case before the generic `rankingToPoints` path.

## Points section visibility
The points card on `ActivityDetailPage` only renders for match-bearing formats once `allMatchesComplete` is true. Don't show empty/zeroed point inputs while results are still pending — it's confusing and the auto-proposal logic only fires when results are final anyway.

## Key Algorithms
- `src/lib/algorithms/round-robin.ts` — generates all valid non-overlapping team combos, maximizes unique pairings. Also exports `countAllRoundRobinMatches(numPlayers, teamSize)` which runs the generator with dummy ids to compute the "alle" upper bound — used by the create-activity form to display `15 (alle)` style placeholders. The result depends only on counts, not on identity, so dummy ids are fine.
- `src/lib/algorithms/double-elimination.ts` — winners/losers/grand final brackets, pads to power of 2
- `src/lib/algorithms/points.ts` — point suggestion based on ranking
- `src/lib/algorithms/ranking.ts` — converts completed matches into a placement ranking (with tie groups) and that ranking into per-contestant point amounts. Used by `ActivityDetailPage` to auto-propose points. Also exports `computeTeamBattlePoints` which bypasses the generic ranking pipeline for `team_battle`.

## Team Roster Splitting
When splitting a roster into N teams (team_battle, double_elim seeding, etc.):
- **Never drop players.** If the count is odd, prefer an unequal split (e.g. 4+3) over slicing off the remainder. Every selected player must play.
- The canonical pattern lives in `handleGenerateTeamBattle` in `ActivityDetailPage`: `shuffle()` then split with `slice(0, half)` / `slice(half)` (note: not `slice(half, half*2)`).
