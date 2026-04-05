import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Points } from '@/lib/types'

export function usePoints(activityId: string) {
  const [points, setPoints] = useState<Points[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchPoints = useCallback(async () => {
    const { data, error } = await supabase
      .from('points')
      .select('*')
      .eq('activity_id', activityId)
    if (!error && data) setPoints(data)
    setLoading(false)
  }, [activityId])

  useEffect(() => {
    fetchPoints()
  }, [fetchPoints])

  const savePoints = async (pointsData: { contestant_id: string; amount: number }[]) => {
    const { error } = await supabase.rpc('save_points', {
      token_input: sessionToken,
      activity_id_input: activityId,
      points_data: pointsData,
    })
    if (error) throw error
    await fetchPoints()
  }

  return { points, loading, savePoints, refetch: fetchPoints }
}
