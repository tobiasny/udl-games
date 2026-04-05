// Generate all combinations of size k from array
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 1) return arr.map((item) => [item])
  if (k === arr.length) return [arr]
  const result: T[][] = []
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i]
    const rest = combinations(arr.slice(i + 1), k - 1)
    for (const combo of rest) {
      result.push([head, ...combo])
    }
  }
  return result
}

export interface RoundRobinMatch {
  team1: string[]
  team2: string[]
  round: number
}

// Generate round robin matches for NvN format
// Ensures all players play with and against all others as much as possible
export function generateRoundRobin(
  playerIds: string[],
  teamSize: number,
  maxMatches?: number,
): RoundRobinMatch[] {
  if (teamSize * 2 > playerIds.length) return []

  // Generate all possible teams
  const allTeams = combinations(playerIds, teamSize)

  // Generate all valid matches (non-overlapping teams)
  const validMatches: [number, number][] = []
  for (let i = 0; i < allTeams.length; i++) {
    for (let j = i + 1; j < allTeams.length; j++) {
      const overlap = allTeams[i].some((p) => allTeams[j].includes(p))
      if (!overlap) validMatches.push([i, j])
    }
  }

  // Track played-with and played-against pairings
  const n = playerIds.length
  const playerIndex = new Map(playerIds.map((id, i) => [id, i]))
  const playedWith = Array.from({ length: n }, () => new Set<number>())
  const playedAgainst = Array.from({ length: n }, () => new Set<number>())

  const selectedMatches: RoundRobinMatch[] = []
  const usedMatchIndices = new Set<number>()

  const limit = maxMatches ?? validMatches.length

  while (selectedMatches.length < limit) {
    let bestIdx = -1
    let bestScore = -1

    for (let m = 0; m < validMatches.length; m++) {
      if (usedMatchIndices.has(m)) continue

      const [ti, tj] = validMatches[m]
      const t1 = allTeams[ti]
      const t2 = allTeams[tj]

      // Score = number of new pairings this match would create
      let score = 0
      // With-pairs within each team
      for (let a = 0; a < t1.length; a++) {
        for (let b = a + 1; b < t1.length; b++) {
          const ai = playerIndex.get(t1[a])!
          const bi = playerIndex.get(t1[b])!
          if (!playedWith[ai].has(bi)) score++
        }
      }
      for (let a = 0; a < t2.length; a++) {
        for (let b = a + 1; b < t2.length; b++) {
          const ai = playerIndex.get(t2[a])!
          const bi = playerIndex.get(t2[b])!
          if (!playedWith[ai].has(bi)) score++
        }
      }
      // Against-pairs between teams
      for (const p1 of t1) {
        for (const p2 of t2) {
          const pi = playerIndex.get(p1)!
          const qi = playerIndex.get(p2)!
          if (!playedAgainst[pi].has(qi)) score++
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestIdx = m
      }
    }

    if (bestIdx === -1 || bestScore === 0) break

    usedMatchIndices.add(bestIdx)
    const [ti, tj] = validMatches[bestIdx]
    const t1 = allTeams[ti]
    const t2 = allTeams[tj]

    // Update tracking
    for (let a = 0; a < t1.length; a++) {
      for (let b = a + 1; b < t1.length; b++) {
        const ai = playerIndex.get(t1[a])!
        const bi = playerIndex.get(t1[b])!
        playedWith[ai].add(bi)
        playedWith[bi].add(ai)
      }
    }
    for (let a = 0; a < t2.length; a++) {
      for (let b = a + 1; b < t2.length; b++) {
        const ai = playerIndex.get(t2[a])!
        const bi = playerIndex.get(t2[b])!
        playedWith[ai].add(bi)
        playedWith[bi].add(ai)
      }
    }
    for (const p1 of t1) {
      for (const p2 of t2) {
        const pi = playerIndex.get(p1)!
        const qi = playerIndex.get(p2)!
        playedAgainst[pi].add(qi)
        playedAgainst[qi].add(pi)
      }
    }

    selectedMatches.push({ team1: [...t1], team2: [...t2], round: 0 })
  }

  // Assign rounds (no player in more than one match per round)
  let currentRound = 1
  const assigned = new Set<number>()

  while (assigned.size < selectedMatches.length) {
    const roundPlayers = new Set<string>()
    for (let i = 0; i < selectedMatches.length; i++) {
      if (assigned.has(i)) continue
      const match = selectedMatches[i]
      const allPlayers = [...match.team1, ...match.team2]
      if (allPlayers.some((p) => roundPlayers.has(p))) continue
      match.round = currentRound
      allPlayers.forEach((p) => roundPlayers.add(p))
      assigned.add(i)
    }
    currentRound++
  }

  return selectedMatches
}
