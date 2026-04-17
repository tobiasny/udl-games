import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Contestant } from '@/lib/types'

export interface DrinkLogEntry {
  id: string
  contestant_id: string
  created_at: string
}

export interface DrinkCount {
  contestant: Contestant
  friday: number
  saturday: number
  total: number
}

function getDayLabel(dateStr: string): 'friday' | 'saturday' | 'other' {
  const d = new Date(dateStr)
  const dow = d.getDay() // 0=Sun,5=Fri,6=Sat
  if (dow === 5) return 'friday'
  if (dow === 6) return 'saturday'
  return 'other'
}

export function useDrinks() {
  const [drinkCounts, setDrinkCounts] = useState<DrinkCount[]>([])
  const [drinkLogs, setDrinkLogs] = useState<DrinkLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchAll = useCallback(async () => {
    const [logsRes, contestantsRes] = await Promise.all([
      supabase.from('drink_log').select('id, contestant_id, created_at').order('created_at'),
      supabase.from('contestants').select('*').order('name'),
    ])

    const logs = (logsRes.data ?? []) as DrinkLogEntry[]
    const contestants = (contestantsRes.data ?? []) as Contestant[]

    const counts: DrinkCount[] = contestants.map((c) => {
      const mine = logs.filter((l) => l.contestant_id === c.id)
      return {
        contestant: c,
        friday: mine.filter((l) => getDayLabel(l.created_at) === 'friday').length,
        saturday: mine.filter((l) => getDayLabel(l.created_at) === 'saturday').length,
        total: mine.length,
      }
    })

    setDrinkLogs(logs)
    setDrinkCounts(counts)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const interval = setInterval(fetchAll, 10000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const logDrink = async (contestantId: string) => {
    const { error } = await supabase.rpc('log_drink', {
      token_input: sessionToken,
      contestant_id_input: contestantId,
    })
    if (error) throw error
    await fetchAll()
  }

  const removeLastDrink = async (contestantId: string) => {
    const { error } = await supabase.rpc('remove_last_drink', {
      token_input: sessionToken,
      contestant_id_input: contestantId,
    })
    if (error) throw error
    await fetchAll()
  }

  return { drinkCounts, drinkLogs, loading, logDrink, removeLastDrink, refetch: fetchAll }
}
