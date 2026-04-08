import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Activity, Contestant, Match, Points } from '@/lib/types'

export interface ActivityStanding {
  contestant: Contestant
  points: number
  rank: number
}

// Snapshot of how far an in-progress activity has gone. `total` may be 0 for
// formats (like free_for_all) where there are no matches to count -- the UI
// uses that to show a generic "in progress" hint instead of a fraction.
export interface ActivityProgress {
  completedMatches: number
  totalMatches: number
  participantCount: number
}

export interface ActivityWithStandings {
  activity: Activity
  standings: ActivityStanding[]
  progress?: ActivityProgress
}

export function useActivityHistory() {
  const [completed, setCompleted] = useState<ActivityWithStandings[]>([])
  const [currents, setCurrents] = useState<ActivityWithStandings[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [activitiesRes, contestantsRes, pointsRes, acRes, matchesRes] = await Promise.all([
      supabase.from('activities').select('*').order('created_at', { ascending: false }),
      supabase.from('contestants').select('*'),
      supabase.from('points').select('*'),
      supabase.from('activity_contestants').select('*'),
      supabase.from('matches').select('id, activity_id, status'),
    ])

    const activities = (activitiesRes.data ?? []) as Activity[]
    const contestants = (contestantsRes.data ?? []) as Contestant[]
    const points = (pointsRes.data ?? []) as Points[]
    const acs = (acRes.data ?? []) as { activity_id: string; contestant_id: string }[]
    const matches = (matchesRes.data ?? []) as Pick<Match, 'id' | 'activity_id' | 'status'>[]

    const contestantMap = new Map(contestants.map((c) => [c.id, c]))

    function standingsFor(activity: Activity): ActivityStanding[] {
      const participantIds = acs
        .filter((ac) => ac.activity_id === activity.id)
        .map((ac) => ac.contestant_id)

      const activityPoints = points.filter((p) => p.activity_id === activity.id)
      const pointsMap = new Map(activityPoints.map((p) => [p.contestant_id, p.amount]))

      const rows = participantIds
        .map((cid) => {
          const contestant = contestantMap.get(cid)
          if (!contestant) return null
          return { contestant, points: pointsMap.get(cid) ?? 0 }
        })
        .filter((r): r is { contestant: Contestant; points: number } => r !== null)
        .sort((a, b) => b.points - a.points)

      // Assign ranks, handling ties
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

    function progressFor(activity: Activity): ActivityProgress {
      const activityMatches = matches.filter((m) => m.activity_id === activity.id)
      const completedMatches = activityMatches.filter((m) => m.status === 'completed').length
      const participantCount = acs.filter((ac) => ac.activity_id === activity.id).length
      return {
        completedMatches,
        totalMatches: activityMatches.length,
        participantCount,
      }
    }

    // Order by when each activity actually finished, not when it was created.
    // Events are inserted as already-completed and would otherwise always sit
    // at the top of the list regardless of when surrounding activities ended.
    // Fall back to created_at for any legacy row missing completed_at.
    const completedList: ActivityWithStandings[] = activities
      .filter((a) => a.status === 'completed')
      .map((a) => ({ activity: a, standings: standingsFor(a) }))
      .sort((a, b) => {
        const at = a.activity.completed_at ?? a.activity.created_at
        const bt = b.activity.completed_at ?? b.activity.created_at
        return bt.localeCompare(at)
      })

    const currentList: ActivityWithStandings[] = activities
      .filter((a) => a.status === 'in_progress')
      .map((a) => ({ activity: a, standings: standingsFor(a), progress: progressFor(a) }))

    setCompleted(completedList)
    setCurrents(currentList)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Poll every 10 seconds for live updates
  useEffect(() => {
    const interval = setInterval(fetchAll, 10000)
    return () => clearInterval(interval)
  }, [fetchAll])

  return { completed, currents, loading, refetch: fetchAll }
}
