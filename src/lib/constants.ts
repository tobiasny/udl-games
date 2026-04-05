import type { ActivityType, ActivityFormat } from './types'

// Default point suggestions for free-for-all (8 players)
// Tighter spread with small top bonus
export function suggestFreeForAllPoints(numParticipants: number): number[] {
  const points: number[] = []
  for (let place = 1; place <= numParticipants; place++) {
    let pts = numParticipants - place + 1 // Base: descending from n to 1
    if (place === 1) pts += 2 // Bonus for 1st
    if (place === 2) pts += 1 // Bonus for 2nd
    points.push(pts)
  }
  return points
}

// For team games, rank teams by wins then apply same distribution
export function suggestTeamPoints(
  numTeams: number,
): { teamRank: number; pointsPerPlayer: number }[] {
  const basePoints = suggestFreeForAllPoints(numTeams)
  return basePoints.map((pts, i) => ({
    teamRank: i + 1,
    pointsPerPlayer: pts,
  }))
}

// Valid format options per activity type
export const VALID_FORMATS: Record<ActivityType, ActivityFormat[]> = {
  free_for_all: ['free_for_all'],
  '1v1': ['round_robin', 'double_elimination'],
  '2v2': ['round_robin', 'double_elimination'],
  '3v3': ['round_robin', 'double_elimination'],
  '4v4': ['free_for_all'],
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  free_for_all: 'Free for All',
  '1v1': '1v1',
  '2v2': '2v2',
  '3v3': '3v3',
  '4v4': '4v4',
}

export const ACTIVITY_FORMAT_LABELS: Record<ActivityFormat, string> = {
  free_for_all: 'Free for All',
  round_robin: 'Round Robin',
  double_elimination: 'Double Elimination',
}
