import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TEAM_SIZES } from '@/lib/constants'
import type { Activity, ActivityFormat, Contestant, Match, MatchPlayer, Points } from '@/lib/types'

export interface ContestantStats {
  contestant: Contestant
  activitiesPlayed: number
  wins: number
  winRate: number
  avgPoints: number
  stdDev: number
  bestActivity: { activity: Activity; points: number } | null
  podiums: { gold: number; silver: number; bronze: number }
  activityBreakdown: { activity: Activity; points: number; rank: number }[]
}

export interface H2HRecord {
  // wins[a_id][b_id] = number of times contestant a beat contestant b
  wins: Record<string, Record<string, number>>
  orderedIds: string[] // contestant ids sorted by total points desc
}

export interface RacePoint {
  activityId: string
  activityName: string
  completedAt: string
  cumulative: Record<string, number> // contestant_id → running MM total
}

export interface RecentEvent {
  activityName: string
  activityFormat: ActivityFormat
  completedAt: string
  standings: { contestant: Contestant; points: number; rank: number }[]
}

export interface StatsData {
  contestants: Contestant[]
  contestantStats: ContestantStats[]
  h2h: H2HRecord
  raceData: RacePoint[]
  recentEvents: RecentEvent[]
  loading: boolean
  refetch: () => void
}

export function useStats({ pollInterval = 0 }: { pollInterval?: number } = {}): StatsData {
  const [data, setData] = useState<Omit<StatsData, 'loading' | 'refetch'>>({
    contestants: [],
    contestantStats: [],
    h2h: { wins: {}, orderedIds: [] },
    raceData: [],
    recentEvents: [],
  })
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [activitiesRes, contestantsRes, pointsRes, acRes, matchesRes, matchPlayersRes] =
      await Promise.all([
        supabase.from('activities').select('*'),
        supabase.from('contestants').select('*'),
        supabase.from('points').select('*'),
        supabase.from('activity_contestants').select('*'),
        supabase.from('matches').select('*'),
        supabase.from('match_players').select('*'),
      ])

    const activities = (activitiesRes.data ?? []) as Activity[]
    const contestants = (contestantsRes.data ?? []) as Contestant[]
    const points = (pointsRes.data ?? []) as Points[]
    const acs = (acRes.data ?? []) as { activity_id: string; contestant_id: string }[]
    const matches = (matchesRes.data ?? []) as Match[]
    const matchPlayers = (matchPlayersRes.data ?? []) as MatchPlayer[]

    const contestantMap = new Map(contestants.map((c) => [c.id, c]))
    const activityMap = new Map(activities.map((a) => [a.id, a]))

    // ── Completed activities sorted chronologically ──────────────────────
    const completedActivities = activities
      .filter((a) => a.status === 'completed')
      .sort((a, b) => {
        const at = a.completed_at ?? a.created_at
        const bt = b.completed_at ?? b.created_at
        return at.localeCompare(bt)
      })

    // ── Per-activity standings ────────────────────────────────────────────
    function standingsFor(activity: Activity) {
      const participantIds = acs
        .filter((ac) => ac.activity_id === activity.id)
        .map((ac) => ac.contestant_id)
      const pointsMap = new Map(
        points.filter((p) => p.activity_id === activity.id).map((p) => [p.contestant_id, p.amount]),
      )
      const rows = participantIds
        .map((cid) => {
          const contestant = contestantMap.get(cid)
          if (!contestant) return null
          return { contestant, points: pointsMap.get(cid) ?? 0 }
        })
        .filter((r): r is { contestant: Contestant; points: number } => r !== null)
        .sort((a, b) => b.points - a.points)

      let currentRank = 0
      let lastPoints = Infinity
      return rows.map((r, i) => {
        if (r.points < lastPoints) {
          currentRank = i + 1
          lastPoints = r.points
        }
        return { ...r, rank: currentRank }
      })
    }

    // ── Contestant stats ──────────────────────────────────────────────────
    // Build per-contestant breakdown across all completed activities
    const breakdownMap = new Map<
      string,
      { activity: Activity; points: number; rank: number }[]
    >()
    contestants.forEach((c) => breakdownMap.set(c.id, []))

    for (const activity of completedActivities) {
      const standings = standingsFor(activity)
      for (const s of standings) {
        breakdownMap.get(s.contestant.id)?.push({
          activity,
          points: s.points,
          rank: s.rank,
        })
      }
    }

    // Total points per contestant (for ordering)
    const totalPointsMap = new Map<string, number>()
    for (const [cid, breakdown] of breakdownMap) {
      totalPointsMap.set(cid, breakdown.reduce((sum, b) => sum + b.points, 0))
    }

    const contestantStats: ContestantStats[] = contestants
      .map((c) => {
        const breakdown = breakdownMap.get(c.id) ?? []
        const activitiesPlayed = breakdown.length
        const wins = breakdown.filter((b) => b.rank === 1).length
        const winRate = activitiesPlayed > 0 ? wins / activitiesPlayed : 0
        const pointValues = breakdown.map((b) => b.points)
        const avgPoints =
          activitiesPlayed > 0
            ? pointValues.reduce((s, v) => s + v, 0) / activitiesPlayed
            : 0
        const variance =
          activitiesPlayed > 0
            ? pointValues.reduce((s, v) => s + (v - avgPoints) ** 2, 0) / activitiesPlayed
            : 0
        const stdDev = Math.sqrt(variance)

        const bestEntry = breakdown.reduce<{ activity: Activity; points: number } | null>(
          (best, b) => (best === null || b.points > best.points ? b : best),
          null,
        )

        const podiums = {
          gold: breakdown.filter((b) => b.rank === 1).length,
          silver: breakdown.filter((b) => b.rank === 2).length,
          bronze: breakdown.filter((b) => b.rank === 3).length,
        }

        return {
          contestant: c,
          activitiesPlayed,
          wins,
          winRate,
          avgPoints,
          stdDev,
          bestActivity: bestEntry,
          podiums,
          activityBreakdown: breakdown,
        }
      })
      .sort((a, b) => (totalPointsMap.get(b.contestant.id) ?? 0) - (totalPointsMap.get(a.contestant.id) ?? 0))

    // ── Race data ─────────────────────────────────────────────────────────
    const running = new Map<string, number>()
    contestants.forEach((c) => running.set(c.id, 0))

    const raceData: RacePoint[] = completedActivities.map((activity) => {
      const activityPointsMap = new Map(
        points.filter((p) => p.activity_id === activity.id).map((p) => [p.contestant_id, p.amount]),
      )
      for (const [cid, amt] of activityPointsMap) {
        running.set(cid, (running.get(cid) ?? 0) + amt)
      }
      return {
        activityId: activity.id,
        activityName: activity.name,
        completedAt: activity.completed_at ?? activity.created_at,
        cumulative: Object.fromEntries(running),
      }
    })

    // ── H2H ───────────────────────────────────────────────────────────────
    // Only for 1v1 and 2v2 format activities (team sizes 1 and 2)
    const h2hActivityIds = new Set(
      activities
        .filter((a) => {
          const teamSize = TEAM_SIZES[a.type]
          return teamSize === 1 || teamSize === 2
        })
        .map((a) => a.id),
    )

    const winsRecord: Record<string, Record<string, number>> = {}
    const initWins = (id: string) => {
      if (!winsRecord[id]) winsRecord[id] = {}
    }
    const addWin = (winnerId: string, loserId: string) => {
      initWins(winnerId)
      initWins(loserId)
      winsRecord[winnerId][loserId] = (winsRecord[winnerId][loserId] ?? 0) + 1
    }

    const completedH2HMatches = matches.filter(
      (m) =>
        m.status === 'completed' &&
        m.winning_team !== null &&
        h2hActivityIds.has(m.activity_id),
    )

    for (const match of completedH2HMatches) {
      const activity = activityMap.get(match.activity_id)
      if (!activity) continue
      const teamSize = TEAM_SIZES[activity.type]

      const players = matchPlayers.filter((mp) => mp.match_id === match.id)
      const winningTeamPlayers = players.filter((mp) => mp.team === match.winning_team)
      const losingTeamPlayers = players.filter((mp) => mp.team !== match.winning_team)

      if (teamSize === 1) {
        // 1v1: single winner vs single loser
        const winner = winningTeamPlayers[0]
        const loser = losingTeamPlayers[0]
        if (winner && loser) addWin(winner.contestant_id, loser.contestant_id)
      } else {
        // 2v2: each winner gets a win credit against each loser
        for (const winner of winningTeamPlayers) {
          for (const loser of losingTeamPlayers) {
            addWin(winner.contestant_id, loser.contestant_id)
          }
        }
      }
    }

    // For 2v2v2v2: use team_placements for pairwise crediting
    const multiTeamActivityIds = new Set(
      activities.filter((a) => a.type === '2v2v2v2').map((a) => a.id),
    )
    const completedMultiMatches = matches.filter(
      (m) =>
        m.status === 'completed' &&
        m.team_placements !== null &&
        multiTeamActivityIds.has(m.activity_id),
    )
    for (const match of completedMultiMatches) {
      if (!match.team_placements) continue
      const players = matchPlayers.filter((mp) => mp.match_id === match.id)
      // team → sorted placement (1 = best)
      const teamPlacements = match.team_placements as Record<string, number>
      const teams = Object.keys(teamPlacements).map(Number)
      // For each pair, the team with lower placement number beats the other
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          const teamA = teams[i]
          const teamB = teams[j]
          const placementA = teamPlacements[String(teamA)]
          const placementB = teamPlacements[String(teamB)]
          const winnerTeam = placementA < placementB ? teamA : teamB
          const loserTeam = placementA < placementB ? teamB : teamA
          const winnerPlayers = players.filter((mp) => mp.team === winnerTeam)
          const loserPlayers = players.filter((mp) => mp.team === loserTeam)
          for (const winner of winnerPlayers) {
            for (const loser of loserPlayers) {
              addWin(winner.contestant_id, loser.contestant_id)
            }
          }
        }
      }
    }

    const orderedIds = contestantStats.map((cs) => cs.contestant.id)

    // ── Recent events ─────────────────────────────────────────────────────
    const recentEvents: RecentEvent[] = completedActivities
      .slice()
      .reverse()
      .slice(0, 8)
      .map((activity) => ({
        activityName: activity.name,
        activityFormat: activity.format,
        completedAt: activity.completed_at ?? activity.created_at,
        standings: standingsFor(activity),
      }))

    setData({ contestants, contestantStats, h2h: { wins: winsRecord, orderedIds }, raceData, recentEvents })
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!pollInterval) return
    const interval = setInterval(fetchAll, pollInterval)
    return () => clearInterval(interval)
  }, [fetchAll, pollInterval])

  return { ...data, loading, refetch: fetchAll }
}
