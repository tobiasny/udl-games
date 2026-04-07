import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { LeaderboardEntry } from '@/lib/types'

export interface LeaderboardEntryWithDelta extends LeaderboardEntry {
  pointsDelta: number
  rankDelta: number
  isNew: boolean
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntryWithDelta[]>([])
  const [loading, setLoading] = useState(true)
  const prevEntriesRef = useRef<Map<string, LeaderboardEntry>>(new Map())

  const fetchLeaderboard = useCallback(async () => {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('rank')
    if (!error && data) {
      const prev = prevEntriesRef.current
      const withDelta: LeaderboardEntryWithDelta[] = data.map((entry) => {
        const prevEntry = prev.get(entry.id)
        return {
          ...entry,
          pointsDelta: prevEntry ? entry.total_points - prevEntry.total_points : 0,
          rankDelta: prevEntry ? prevEntry.rank - entry.rank : 0,
          isNew: !prevEntry && prev.size > 0,
        }
      })
      setEntries(withDelta)
      // Store current as prev for next poll
      const newMap = new Map<string, LeaderboardEntry>()
      data.forEach((e) => newMap.set(e.id, e))
      prevEntriesRef.current = newMap
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Poll every 10 seconds for live updates
  useEffect(() => {
    const interval = setInterval(fetchLeaderboard, 10000)
    return () => clearInterval(interval)
  }, [fetchLeaderboard])

  return { entries, loading, refetch: fetchLeaderboard }
}
