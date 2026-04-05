import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { LeaderboardEntry } from '@/lib/types'

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('rank')
    if (!error && data) setEntries(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return { entries, loading, refetch: fetchLeaderboard }
}
