export interface BracketMatch {
  id: string // temp id for linking
  bracket: 'winners' | 'losers' | 'grand_final'
  bracketRound: number
  bracketPosition: number
  team1: string[] | null
  team2: string[] | null
  sourceMatchWinner: string | null // id of match whose winner feeds here
  sourceMatchLoser: string | null  // id of match whose loser feeds here
}

let nextId = 0
function tempId(): string {
  return `temp_${nextId++}`
}

// Generate a double-elimination bracket from a list of teams
export function generateDoubleElimination(teams: string[][]): BracketMatch[] {
  nextId = 0
  const n = teams.length
  if (n < 2) return []

  // Pad to nearest power of 2
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)))
  const paddedTeams: (string[] | null)[] = [...teams]
  while (paddedTeams.length < bracketSize) paddedTeams.push(null)

  // Shuffle padded teams so byes are distributed
  // (actual teams are already shuffled by caller if random)

  const matches: BracketMatch[] = []

  // Winners bracket round 1
  const wr1: BracketMatch[] = []
  for (let i = 0; i < bracketSize / 2; i++) {
    const t1 = paddedTeams[i * 2]
    const t2 = paddedTeams[i * 2 + 1]
    const match: BracketMatch = {
      id: tempId(),
      bracket: 'winners',
      bracketRound: 1,
      bracketPosition: i + 1,
      team1: t1,
      team2: t2,
      sourceMatchWinner: null,
      sourceMatchLoser: null,
    }
    wr1.push(match)
    matches.push(match)
  }

  // Build subsequent winners bracket rounds
  let prevWinners = wr1
  let wrRound = 2
  while (prevWinners.length > 1) {
    const round: BracketMatch[] = []
    for (let i = 0; i < prevWinners.length / 2; i++) {
      const match: BracketMatch = {
        id: tempId(),
        bracket: 'winners',
        bracketRound: wrRound,
        bracketPosition: i + 1,
        team1: null,
        team2: null,
        sourceMatchWinner: prevWinners[i * 2].id,
        sourceMatchLoser: null,
      }
      // The second source is also a winner
      match.sourceMatchLoser = null
      // We need a custom field for the second source
      // Actually, let's use a convention: sourceMatchWinner feeds team1
      // We'll add a second link via the match itself
      // Simplified: just track both parent matches
      matches.push(match)
      round.push(match)
    }
    // Fix: we need two source winners for winners bracket matches
    for (let i = 0; i < round.length; i++) {
      round[i].sourceMatchWinner = prevWinners[i * 2].id
      // Use sourceMatchLoser field to hold the second winner source
      // This is a hack but works for our bracket progression
      round[i].sourceMatchLoser = prevWinners[i * 2 + 1].id
    }
    prevWinners = round
    wrRound++
  }

  const winnersChampMatch = prevWinners[0]

  // Losers bracket
  // LR1: losers from WR1 pair up
  // LR2: winners of LR1 play losers from WR2
  // Continue alternating

  // Collect losers from each winners round
  const winnersRounds: BracketMatch[][] = []
  let wr = 1
  while (true) {
    const roundMatches = matches.filter(
      (m) => m.bracket === 'winners' && m.bracketRound === wr
    )
    if (roundMatches.length === 0) break
    winnersRounds.push(roundMatches)
    wr++
  }

  let prevLosers: BracketMatch[] = []
  let lrRound = 1

  for (let wrIdx = 0; wrIdx < winnersRounds.length; wrIdx++) {
    const losersFromWR = winnersRounds[wrIdx]

    if (wrIdx === 0) {
      // First losers round: pair up losers from WR1
      const round: BracketMatch[] = []
      for (let i = 0; i < losersFromWR.length / 2; i++) {
        const match: BracketMatch = {
          id: tempId(),
          bracket: 'losers',
          bracketRound: lrRound,
          bracketPosition: i + 1,
          team1: null,
          team2: null,
          sourceMatchWinner: losersFromWR[i * 2].id, // loser of this WR match
          sourceMatchLoser: losersFromWR[i * 2 + 1].id, // loser of this WR match
        }
        matches.push(match)
        round.push(match)
      }
      prevLosers = round
      lrRound++
    } else {
      // Cross round: winners of previous losers round play losers from this winners round
      const round: BracketMatch[] = []
      const crossCount = Math.min(prevLosers.length, losersFromWR.length)
      for (let i = 0; i < crossCount; i++) {
        const match: BracketMatch = {
          id: tempId(),
          bracket: 'losers',
          bracketRound: lrRound,
          bracketPosition: i + 1,
          team1: null,
          team2: null,
          sourceMatchWinner: prevLosers[i].id,
          sourceMatchLoser: losersFromWR[i].id,
        }
        matches.push(match)
        round.push(match)
      }
      lrRound++

      // If more than 1 match, add a consolidation round
      if (round.length > 1) {
        const consolidation: BracketMatch[] = []
        for (let i = 0; i < round.length / 2; i++) {
          const match: BracketMatch = {
            id: tempId(),
            bracket: 'losers',
            bracketRound: lrRound,
            bracketPosition: i + 1,
            team1: null,
            team2: null,
            sourceMatchWinner: round[i * 2].id,
            sourceMatchLoser: round[i * 2 + 1]?.id ?? null,
          }
          matches.push(match)
          consolidation.push(match)
        }
        prevLosers = consolidation
        lrRound++
      } else {
        prevLosers = round
      }
    }
  }

  const losersChampMatch = prevLosers.length > 0 ? prevLosers[prevLosers.length - 1] : null

  // Grand final
  if (losersChampMatch) {
    const grandFinal: BracketMatch = {
      id: tempId(),
      bracket: 'grand_final',
      bracketRound: 1,
      bracketPosition: 1,
      team1: null,
      team2: null,
      sourceMatchWinner: winnersChampMatch.id,
      sourceMatchLoser: losersChampMatch.id,
    }
    matches.push(grandFinal)

    // Grand final reset (conditional)
    const reset: BracketMatch = {
      id: tempId(),
      bracket: 'grand_final',
      bracketRound: 2,
      bracketPosition: 1,
      team1: null,
      team2: null,
      sourceMatchWinner: grandFinal.id,
      sourceMatchLoser: grandFinal.id,
    }
    matches.push(reset)
  }

  return matches
}

// Shuffle teams randomly
export function shuffleTeams(teams: string[][]): string[][] {
  const shuffled = [...teams]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
