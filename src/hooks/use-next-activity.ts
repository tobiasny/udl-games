import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Activity } from '@/lib/types'

export function useNextActivity() {
  const [next, setNext] = useState<Activity | null>(null)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('status', 'draft')
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    setNext((data as Activity | null) ?? null)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  useEffect(() => {
    const interval = setInterval(fetch, 10000)
    return () => clearInterval(interval)
  }, [fetch])

  return { next }
}
