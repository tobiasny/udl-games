import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Activity, Contestant, Points } from '@/lib/types'

export interface WagerEntry {
  activity: Activity
  winner: Contestant
  loser: Contestant
  betAmount: number
}

export function useWagers() {
  const [wagers, setWagers] = useState<WagerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchAll = useCallback(async () => {
    const [activitiesRes, contestantsRes] = await Promise.all([
      supabase
        .from('activities')
        .select('*')
        .eq('type', 'wager')
        .order('created_at', { ascending: false }),
      supabase.from('contestants').select('*'),
    ])

    const activities = (activitiesRes.data ?? []) as Activity[]
    const contestants = (contestantsRes.data ?? []) as Contestant[]
    const contestantMap = new Map(contestants.map((c) => [c.id, c]))

    if (activities.length === 0) {
      setWagers([])
      setLoading(false)
      return
    }

    const activityIds = activities.map((a) => a.id)
    const { data: pointsData } = await supabase
      .from('points')
      .select('*')
      .in('activity_id', activityIds)

    const points = (pointsData ?? []) as Points[]

    const entries: WagerEntry[] = activities.flatMap((activity) => {
      const activityPoints = points.filter((p) => p.activity_id === activity.id)
      const winnerPoints = activityPoints.find((p) => p.amount > 0)
      const loserPoints = activityPoints.find((p) => p.amount < 0)
      if (!winnerPoints || !loserPoints) return []
      const winner = contestantMap.get(winnerPoints.contestant_id)
      const loser = contestantMap.get(loserPoints.contestant_id)
      if (!winner || !loser) return []
      return [{ activity, winner, loser, betAmount: winnerPoints.amount }]
    })

    setWagers(entries)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const createWager = async (
    playerAId: string,
    playerBId: string,
    betAmount: number,
    winnerId: string,
  ) => {
    const { error } = await supabase.rpc('create_wager', {
      token_input: sessionToken,
      player_a_id: playerAId,
      player_b_id: playerBId,
      bet_amount_input: betAmount,
      winner_id: winnerId,
    })
    if (error) throw error
    await fetchAll()
  }

  return { wagers, loading, createWager }
}
