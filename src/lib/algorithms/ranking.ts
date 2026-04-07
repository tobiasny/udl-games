import type { Match, MatchPlayer } from '@/lib/types'
import { suggestFreeForAllPoints } from './points'

// Each entry is a tied group of contestant ids at that placement.
// ranks[0] = 1st place, ranks[1] = 2nd place, etc.
export type Ranking = string[][]

function playersOf(matchPlayers: MatchPlayer[], matchId: string, team: number): string[] {
  return matchPlayers
    .filter((mp) => mp.match_id === matchId && mp.team === team)
    .map((mp) => mp.contestant_id)
}

// Round-robin placement: rank by wins. Contestants with the same number of
// wins share a rank.
export function computeRoundRobinRanking(
  contestantIds: string[],
  matches: Match[],
  matchPlayers: MatchPlayer[]
): Ranking {
  const wins: Record<string, number> = {}
  contestantIds.forEach((id) => {
    wins[id] = 0
  })
  matches
    .filter((m) => m.status === 'completed' && m.winning_team)
    .forEach((m) => {
      playersOf(matchPlayers, m.id, m.winning_team!).forEach((cid) => {
        wins[cid] = (wins[cid] ?? 0) + 1
      })
    })

  const sorted = [...contestantIds].sort((a, b) => (wins[b] ?? 0) - (wins[a] ?? 0))
  const ranks: Ranking = []
  let curWins: number | null = null
  let group: string[] = []
  for (const id of sorted) {
    if (wins[id] !== curWins) {
      if (group.length) ranks.push(group)
      group = []
      curWins = wins[id]
    }
    group.push(id)
  }
  if (group.length) ranks.push(group)
  return ranks
}

// Double-elimination placement: 1st = champion of the deciding grand-final
// match, 2nd = the other team in that match, then losers of each losers-bracket
// round in reverse order (deeper round = better rank). Players who lost in the
// same losers-bracket round share a placement.
export function computeBracketRanking(matches: Match[], matchPlayers: MatchPlayer[]): Ranking {
  const completedGf = matches.filter(
    (m) => m.bracket === 'grand_final' && m.status === 'completed' && m.winning_team != null
  )
  const gf1 = completedGf.find((m) => m.bracket_round === 1)
  const gfReset = completedGf.find((m) => m.bracket_round === 2)
  const decidingGf = gfReset ?? gf1
  if (!decidingGf || decidingGf.winning_team == null) return []

  const championTeam = decidingGf.winning_team
  const champion = playersOf(matchPlayers, decidingGf.id, championTeam)
  const runnerUp = playersOf(matchPlayers, decidingGf.id, championTeam === 1 ? 2 : 1)

  const ranks: Ranking = [champion, runnerUp]

  const lrMatches = matches
    .filter((m) => m.bracket === 'losers' && m.status === 'completed' && m.winning_team != null)
    .sort((a, b) => (b.bracket_round ?? 0) - (a.bracket_round ?? 0))

  let curRound: number | null = null
  let group: string[] = []
  for (const m of lrMatches) {
    if (m.bracket_round !== curRound) {
      if (group.length) ranks.push(group)
      group = []
      curRound = m.bracket_round
    }
    const losingTeam = m.winning_team === 1 ? 2 : 1
    group.push(...playersOf(matchPlayers, m.id, losingTeam))
  }
  if (group.length) ranks.push(group)

  return ranks
}

// Team battle: two fixed teams play N matches against each other. Points are
// based on which team won more matches; on a tie both teams get the average.
// The team rosters are read from the first match's match_players, since every
// match in a team_battle activity shares the same split.
export function computeTeamBattlePoints(
  matches: Match[],
  matchPlayers: MatchPlayer[]
): Record<string, number> {
  if (matches.length === 0) return {}
  const refMatch = matches[0]
  const team1 = playersOf(matchPlayers, refMatch.id, 1)
  const team2 = playersOf(matchPlayers, refMatch.id, 2)
  if (team1.length === 0 || team2.length === 0) return {}

  let wins1 = 0
  let wins2 = 0
  matches
    .filter((m) => m.status === 'completed' && m.winning_team != null)
    .forEach((m) => {
      if (m.winning_team === 1) wins1++
      else if (m.winning_team === 2) wins2++
    })

  const scale = suggestFreeForAllPoints(2) // [4, 2]
  const out: Record<string, number> = {}
  if (wins1 === wins2) {
    const avg = Math.round((scale[0] + scale[1]) / 2)
    ;[...team1, ...team2].forEach((id) => { out[id] = avg })
  } else {
    const winners = wins1 > wins2 ? team1 : team2
    const losers = wins1 > wins2 ? team2 : team1
    winners.forEach((id) => { out[id] = scale[0] })
    losers.forEach((id) => { out[id] = scale[1] })
  }
  return out
}

// Map a ranking to point amounts. Tied contestants share their group's average
// point value (rounded), so a 3-way tie for 2nd-4th each gets the average of
// the 2nd, 3rd and 4th place point amounts.
export function rankingToPoints(ranks: Ranking, numContestants: number): Record<string, number> {
  const scale = suggestFreeForAllPoints(numContestants)
  const out: Record<string, number> = {}
  let placeIdx = 0
  for (const group of ranks) {
    const slice = scale.slice(placeIdx, placeIdx + group.length)
    if (slice.length === 0) break
    const avg = Math.round(slice.reduce((a, b) => a + b, 0) / slice.length)
    for (const id of group) {
      out[id] = avg
    }
    placeIdx += group.length
  }
  return out
}
