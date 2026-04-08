import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Activity, Contestant, Points } from '@/lib/types'

export interface ActivityStanding {
  contestant: Contestant
  points: number
  rank: number
}

export interface ActivityWithStandings {
  activity: Activity
  standings: ActivityStanding[]
}

export function useActivityHistory() {
  const [completed, setCompleted] = useState<ActivityWithStandings[]>([])
  const [currents, setCurrents] = useState<ActivityWithStandings[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [activitiesRes, contestantsRes, pointsRes, acRes] = await Promise.all([
      supabase.from('activities').select('*').order('created_at', { ascending: false }),
      supabase.from('contestants').select('*'),
      supabase.from('points').select('*'),
      supabase.from('activity_contestants').select('*'),
    ])

    const activities = (activitiesRes.data ?? []) as Activity[]
    const contestants = (contestantsRes.data ?? []) as Contestant[]
    const points = (pointsRes.data ?? []) as Points[]
    const acs = (acRes.data ?? []) as { activity_id: string; contestant_id: string }[]

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

    const completedList: ActivityWithStandings[] = activities
      .filter((a) => a.status === 'completed')
      .map((a) => ({ activity: a, standings: standingsFor(a) }))

    const currentList: ActivityWithStandings[] = activities
      .filter((a) => a.status === 'in_progress')
      .map((a) => ({ activity: a, standings: standingsFor(a) }))

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
