export type ActivityType = 'free_for_all' | '1v1' | '2v2' | '3v3' | '4v4' | '2v2v2v2' | 'event'
export type ActivityFormat =
  | 'free_for_all'
  | 'round_robin'
  | 'double_elimination'
  | 'team_battle'
  | 'multi_team_battle'
  | 'event'
export type ActivityStatus = 'draft' | 'in_progress' | 'completed'
export type MatchStatus = 'pending' | 'in_progress' | 'completed'
export type BracketType = 'winners' | 'losers' | 'grand_final'

export interface Contestant {
  id: string
  name: string
  avatar_url: string | null
  created_at: string
}

export interface Activity {
  id: string
  name: string
  type: ActivityType
  format: ActivityFormat
  status: ActivityStatus
  sort_order: number
  num_rounds: number
  created_at: string
}

export interface ActivityContestant {
  activity_id: string
  contestant_id: string
}

export interface Match {
  id: string
  activity_id: string
  round: number | null
  bracket: BracketType | null
  bracket_round: number | null
  bracket_position: number | null
  source_match_winner: string | null
  source_match_loser: string | null
  team1_source_match: string | null
  team1_source_from: 'winner' | 'loser' | null
  team2_source_match: string | null
  team2_source_from: 'winner' | 'loser' | null
  status: MatchStatus
  winning_team: number | null
  // Multi-team battle only: { "1": placement, "2": placement, ... } where
  // placement is 1..4 (1 = best). Null for regular two-team matches.
  team_placements: Record<string, number> | null
  created_at: string
}

export interface MatchPlayer {
  id: string
  match_id: string
  contestant_id: string
  team: number
}

export interface Points {
  id: string
  activity_id: string
  contestant_id: string
  amount: number
  created_at: string
}

export interface LeaderboardEntry {
  id: string
  name: string
  avatar_url: string | null
  total_points: number
  rank: number
}
