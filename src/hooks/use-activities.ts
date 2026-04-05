import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Activity, ActivityType, ActivityFormat } from '@/lib/types'

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchActivities = useCallback(async () => {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('sort_order')
    if (!error && data) setActivities(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const addActivity = async (
    name: string,
    type: ActivityType,
    format: ActivityFormat,
    contestantIds: string[],
    numRounds: number = 1,
  ) => {
    const { data, error } = await supabase.rpc('add_activity', {
      token_input: sessionToken,
      name_input: name,
      type_input: type,
      format_input: format,
      contestant_ids: contestantIds,
      num_rounds_input: numRounds,
    })
    if (error) throw error
    await fetchActivities()
    return data
  }

  const updateActivityStatus = async (id: string, status: Activity['status']) => {
    const { error } = await supabase.rpc('update_activity_status', {
      token_input: sessionToken,
      activity_id_input: id,
      status_input: status,
    })
    if (error) throw error
    await fetchActivities()
  }

  const deleteActivity = async (id: string) => {
    const { error } = await supabase.rpc('delete_activity', {
      token_input: sessionToken,
      activity_id_input: id,
    })
    if (error) throw error
    await fetchActivities()
  }

  return { activities, loading, addActivity, updateActivityStatus, deleteActivity, refetch: fetchActivities }
}
