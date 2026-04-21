import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const PLAYER_SESSION_KEY = 'udl_player_session'

export function usePlayerAuth() {
  const [contestantId, setContestantId] = useState<string | null>(null)
  const [playerToken, setPlayerToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem(PLAYER_SESSION_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase.rpc('get_player_session', {
      player_token_input: token,
    })
    if (error) {
      setLoading(false)
      return
    }
    if (data) {
      setContestantId(data as string)
      setPlayerToken(token)
    } else {
      localStorage.removeItem(PLAYER_SESSION_KEY)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = useCallback(async (
    contestantIdInput: string,
    pin: string,
  ): Promise<boolean> => {
    const { data, error } = await supabase.rpc('authenticate_player', {
      contestant_id_input: contestantIdInput,
      pin_input: pin,
    })
    if (error) throw error
    if (!data) return false
    localStorage.setItem(PLAYER_SESSION_KEY, data as string)
    setPlayerToken(data as string)
    setContestantId(contestantIdInput)
    return true
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(PLAYER_SESSION_KEY)
    setPlayerToken(null)
    setContestantId(null)
  }, [])

  return { contestantId, playerToken, loading, login, logout }
}
