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
    // Single round trip: fetch matches with their players nested under each
    // row, then split into the two flat state arrays the rest of the app
    // already expects.
    const { data, error } = await supabase
      .from('matches')
      .select('*, match_players(*)')
      .eq('activity_id', activityId)
      .order('round')
      .order('bracket_round')
      .order('bracket_position')

    if (!error && data) {
      const flatMatches: Match[] = []
      const flatPlayers: MatchPlayer[] = []
      for (const row of data as (Match & { match_players: MatchPlayer[] })[]) {
        const { match_players, ...match } = row
        flatMatches.push(match)
        flatPlayers.push(...match_players)
      }
      setMatches(flatMatches)
      setMatchPlayers(flatPlayers)
    }
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

  const clearMatchResult = async (matchId: string) => {
    const { error } = await supabase.rpc('clear_match_result', {
      token_input: sessionToken,
      match_id_input: matchId,
    })
    if (error) throw error
    await fetchMatches()
  }

  return {
    matches,
    matchPlayers,
    loading,
    setMatchResult,
    clearMatchResult,
    deleteMatch,
    refetch: fetchMatches,
  }
}
