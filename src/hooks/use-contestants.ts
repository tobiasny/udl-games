import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Contestant } from '@/lib/types'

export function useContestants() {
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchContestants = useCallback(async () => {
    const { data, error } = await supabase
      .from('contestants')
      .select('*')
      .order('name')
    if (!error && data) setContestants(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchContestants()
  }, [fetchContestants])

  const addContestant = async (name: string) => {
    const { error } = await supabase.rpc('add_contestant', {
      token_input: sessionToken,
      name_input: name,
    })
    if (error) throw error
    await fetchContestants()
  }

  const updateContestant = async (id: string, name: string) => {
    const { error } = await supabase.rpc('update_contestant', {
      token_input: sessionToken,
      contestant_id_input: id,
      name_input: name,
    })
    if (error) throw error
    await fetchContestants()
  }

  const updateAvatar = async (id: string, avatarUrl: string) => {
    const { error } = await supabase.rpc('update_contestant_avatar', {
      token_input: sessionToken,
      contestant_id_input: id,
      avatar_url_input: avatarUrl || null,
    })
    if (error) throw error
    await fetchContestants()
  }

  const deleteContestant = async (id: string) => {
    const { error } = await supabase.rpc('delete_contestant', {
      token_input: sessionToken,
      contestant_id_input: id,
    })
    if (error) throw error
    await fetchContestants()
  }

  const setPlayerPin = async (contestantId: string, pin: string) => {
    const { error } = await supabase.rpc('set_player_pin', {
      token_input: sessionToken,
      contestant_id_input: contestantId,
      pin_input: pin,
    })
    if (error) throw error
  }

  return { contestants, loading, addContestant, updateContestant, updateAvatar, deleteContestant, setPlayerPin, refetch: fetchContestants }
}
