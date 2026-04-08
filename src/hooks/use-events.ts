import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Activity } from '@/lib/types'

// An "event" is an activity with type='event'. It has exactly one participant
// and exactly one points row, both written atomically by the add_event RPC.
// This hook exposes the admin-facing CRUD for them; the public leaderboard /
// activity history picks them up automatically via the existing points feed.
export interface Event {
  id: string
  title: string
  contestant_id: string
  points: number
  created_at: string
}

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchEvents = useCallback(async () => {
    // Pull the event activities plus their participant row and their points
    // row in one round trip, then flatten to the flat Event shape the UI wants.
    const { data, error } = await supabase
      .from('activities')
      .select('id, name, created_at, activity_contestants(contestant_id), points(amount)')
      .eq('type', 'event')
      .order('created_at', { ascending: false })

    if (!error && data) {
      type Row = Pick<Activity, 'id' | 'created_at'> & {
        name: string
        activity_contestants: { contestant_id: string }[]
        points: { amount: number }[]
      }
      const flat: Event[] = (data as Row[]).map((row) => ({
        id: row.id,
        title: row.name,
        contestant_id: row.activity_contestants[0]?.contestant_id ?? '',
        points: row.points[0]?.amount ?? 0,
        created_at: row.created_at,
      }))
      setEvents(flat)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const addEvent = async (title: string, contestantId: string, points: number) => {
    const { error } = await supabase.rpc('add_event', {
      token_input: sessionToken,
      title_input: title,
      contestant_id_input: contestantId,
      points_input: points,
    })
    if (error) throw error
    await fetchEvents()
  }

  const updateEvent = async (
    eventId: string,
    title: string,
    contestantId: string,
    points: number,
  ) => {
    const { error } = await supabase.rpc('update_event', {
      token_input: sessionToken,
      event_id_input: eventId,
      title_input: title,
      contestant_id_input: contestantId,
      points_input: points,
    })
    if (error) throw error
    await fetchEvents()
  }

  // Events are just activities under the hood, so delete_activity handles
  // the cascade (points + activity_contestants) for us.
  const deleteEvent = async (eventId: string) => {
    const { error } = await supabase.rpc('delete_activity', {
      token_input: sessionToken,
      activity_id_input: eventId,
    })
    if (error) throw error
    await fetchEvents()
  }

  return { events, loading, addEvent, updateEvent, deleteEvent, refetch: fetchEvents }
}
