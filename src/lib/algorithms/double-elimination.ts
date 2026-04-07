export interface BracketMatchSource {
  matchId: string
  from: 'winner' | 'loser'
}

export interface BracketMatch {
  id: string // temp id used to link matches before they are persisted
  bracket: 'winners' | 'losers' | 'grand_final'
  bracketRound: number
  bracketPosition: number
  team1: string[] | null
  team2: string[] | null
  // Each team slot is either pre-filled (round 1 of winners bracket) or
  // sourced from another match's winner OR loser.
  team1Source: BracketMatchSource | null
  team2Source: BracketMatchSource | null
}

let nextId = 0
function tempId(): string {
  return `temp_${nextId++}`
}

function makeMatch(
  bracket: BracketMatch['bracket'],
  round: number,
  position: number
): BracketMatch {
  return {
    id: tempId(),
    bracket,
    bracketRound: round,
    bracketPosition: position,
    team1: null,
    team2: null,
    team1Source: null,
    team2Source: null,
  }
}

// Generate a double-elimination bracket from a list of teams.
// Currently expects the team count to be a power of 2 (4, 8, 16, ...).
// Non-power-of-2 inputs are padded with null and will leave bye matches that
// the user can either resolve manually or wire up after a future bye-handling
// pass.
export function generateDoubleElimination(teams: string[][]): BracketMatch[] {
  nextId = 0
  const n = teams.length
  if (n < 2) return []

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)))
  const paddedTeams: (string[] | null)[] = [...teams]
  while (paddedTeams.length < bracketSize) paddedTeams.push(null)

  const matches: BracketMatch[] = []

  // Winners bracket round 1: pre-filled teams.
  const winnersRounds: BracketMatch[][] = [[]]
  for (let i = 0; i < bracketSize / 2; i++) {
    const m = makeMatch('winners', 1, i + 1)
    m.team1 = paddedTeams[i * 2]
    m.team2 = paddedTeams[i * 2 + 1]
    winnersRounds[0].push(m)
    matches.push(m)
  }

  // Subsequent winners rounds: each slot fed by the winner of a prior match.
  let wrRound = 2
  while (winnersRounds[winnersRounds.length - 1].length > 1) {
    const prev = winnersRounds[winnersRounds.length - 1]
    const round: BracketMatch[] = []
    for (let i = 0; i < prev.length / 2; i++) {
      const m = makeMatch('winners', wrRound, i + 1)
      m.team1Source = { matchId: prev[i * 2].id, from: 'winner' }
      m.team2Source = { matchId: prev[i * 2 + 1].id, from: 'winner' }
      matches.push(m)
      round.push(m)
    }
    winnersRounds.push(round)
    wrRound++
  }

  const winnersChampMatch = winnersRounds[winnersRounds.length - 1][0]

  // Losers bracket: alternates "cross" rounds (winners-of-prev-LR vs
  // losers-from-current-WR) with consolidation rounds (winners-of-prev-LR
  // pair up).
  let prevLosers: BracketMatch[] = []
  let lrRound = 1

  for (let wrIdx = 0; wrIdx < winnersRounds.length; wrIdx++) {
    const wrMatches = winnersRounds[wrIdx]

    if (wrIdx === 0) {
      // LR1: pair losers from WR1.
      const round: BracketMatch[] = []
      for (let i = 0; i < wrMatches.length / 2; i++) {
        const m = makeMatch('losers', lrRound, i + 1)
        m.team1Source = { matchId: wrMatches[i * 2].id, from: 'loser' }
        m.team2Source = { matchId: wrMatches[i * 2 + 1].id, from: 'loser' }
        matches.push(m)
        round.push(m)
      }
      prevLosers = round
      lrRound++
      continue
    }

    // Cross round: winner of previous LR match plays loser of this WR match.
    const cross: BracketMatch[] = []
    const crossCount = Math.min(prevLosers.length, wrMatches.length)
    for (let i = 0; i < crossCount; i++) {
      const m = makeMatch('losers', lrRound, i + 1)
      m.team1Source = { matchId: prevLosers[i].id, from: 'winner' }
      m.team2Source = { matchId: wrMatches[i].id, from: 'loser' }
      matches.push(m)
      cross.push(m)
    }
    lrRound++

    if (cross.length > 1) {
      // Consolidation: pair winners of cross matches.
      const cons: BracketMatch[] = []
      for (let i = 0; i < cross.length / 2; i++) {
        const m = makeMatch('losers', lrRound, i + 1)
        m.team1Source = { matchId: cross[i * 2].id, from: 'winner' }
        m.team2Source = { matchId: cross[i * 2 + 1].id, from: 'winner' }
        matches.push(m)
        cons.push(m)
      }
      prevLosers = cons
      lrRound++
    } else {
      prevLosers = cross
    }
  }

  const losersChampMatch =
    prevLosers.length > 0 ? prevLosers[prevLosers.length - 1] : null

  // Grand final + reset.
  if (losersChampMatch) {
    const gf = makeMatch('grand_final', 1, 1)
    gf.team1Source = { matchId: winnersChampMatch.id, from: 'winner' }
    gf.team2Source = { matchId: losersChampMatch.id, from: 'winner' }
    matches.push(gf)

    // Reset match: only actually played if the losers-bracket champion wins
    // GF1. set_match_result drops this row when team1 wins GF1.
    const reset = makeMatch('grand_final', 2, 1)
    reset.team1Source = { matchId: gf.id, from: 'winner' }
    reset.team2Source = { matchId: gf.id, from: 'loser' }
    matches.push(reset)
  }

  return matches
}

