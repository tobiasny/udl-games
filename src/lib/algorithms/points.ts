// Generate default point suggestions for free-for-all
// Tight spread with small bonuses for top positions
export function suggestFreeForAllPoints(numParticipants: number): number[] {
  const points: number[] = []
  for (let place = 1; place <= numParticipants; place++) {
    let pts = numParticipants - place + 1
    if (place === 1) pts += 2
    if (place === 2) pts += 1
    points.push(pts)
  }
  return points
}

// For team games: suggest points based on team rankings
// Each team member gets equal points
export function suggestTeamPoints(numTeams: number): number[] {
  return suggestFreeForAllPoints(numTeams)
}
