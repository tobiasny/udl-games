import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Match, MatchPlayer } from '@/lib/types'

export function useMatches(activityId: string) {
  const [matches, setMatches] = useState<Match[]>([])
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchMatches = useCallback(async () => {
    const [matchRes, playerRes] = await Promise.all([
      supabase.from('matches').select('*').eq('activity_id', activityId).order('round').order('bracket_round').order('bracket_position'),
      supabase.from('match_players').select('*').in(
        'match_id',
        (await supabase.from('matches').select('id').eq('activity_id', activityId)).data?.map(m => m.id) ?? []
      ),
    ])
    if (!matchRes.error && matchRes.data) setMatches(matchRes.data)
    if (!playerRes.error && playerRes.data) setMatchPlayers(playerRes.data)
    setLoading(false)
  }, [activityId])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const setMatchResult = async (matchId: string, winningTeam: number) => {
    const { error } = await supabase.rpc('set_match_result', {
      token_input: sessionToken,
      match_id_input: matchId,
      winning_team_input: winningTeam,
    })
    if (error) throw error
    await fetchMatches()
  }

  const deleteMatch = async (matchId: string) => {
    const { error } = await supabase.rpc('delete_match', {
      token_input: sessionToken,
      match_id_input: matchId,
    })
    if (error) throw error
    await fetchMatches()
  }

  return { matches, matchPlayers, loading, setMatchResult, deleteMatch, refetch: fetchMatches }
}
