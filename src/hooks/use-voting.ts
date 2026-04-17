import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'

export interface VoteOption {
  id: string
  session_id: string
  label: string
  sort_order: number
  voteCount: number
}

export interface VoteSession {
  id: string
  question: string
  status: 'open' | 'closed'
  created_at: string
  options: VoteOption[]
  totalVotes: number
}

function getVoterToken(): string {
  const key = 'mats-games-voter-token'
  let token = localStorage.getItem(key)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(key, token)
  }
  return token
}

// Admin: all sessions
export function useVoteSessions() {
  const [sessions, setSessions] = useState<VoteSession[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchAll = useCallback(async () => {
    const [sessionsRes, optionsRes, votesRes] = await Promise.all([
      supabase.from('vote_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('vote_options').select('*').order('sort_order'),
      supabase.from('votes').select('session_id, option_id'),
    ])

    const rawSessions = (sessionsRes.data ?? []) as { id: string; question: string; status: 'open' | 'closed'; created_at: string }[]
    const rawOptions = (optionsRes.data ?? []) as { id: string; session_id: string; label: string; sort_order: number }[]
    const rawVotes = (votesRes.data ?? []) as { session_id: string; option_id: string }[]

    const built: VoteSession[] = rawSessions.map((s) => {
      const opts = rawOptions.filter((o) => o.session_id === s.id)
      const sessionVotes = rawVotes.filter((v) => v.session_id === s.id)
      const options: VoteOption[] = opts.map((o) => ({
        ...o,
        voteCount: sessionVotes.filter((v) => v.option_id === o.id).length,
      }))
      return { ...s, options, totalVotes: sessionVotes.length }
    })

    setSessions(built)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const createSession = async (question: string, optionLabels: string[]) => {
    const { error } = await supabase.rpc('create_vote_session', {
      token_input: sessionToken,
      question_input: question,
      option_labels: optionLabels,
    })
    if (error) throw error
    await fetchAll()
  }

  const closeSession = async (sessionId: string) => {
    const { error } = await supabase.rpc('close_vote_session', {
      token_input: sessionToken,
      session_id_input: sessionId,
    })
    if (error) throw error
    await fetchAll()
  }

  const deleteSession = async (sessionId: string) => {
    const { error } = await supabase.rpc('delete_vote_session', {
      token_input: sessionToken,
      session_id_input: sessionId,
    })
    if (error) throw error
    await fetchAll()
  }

  return { sessions, loading, createSession, closeSession, deleteSession, refetch: fetchAll }
}

// Public: active vote + cast
export function useActiveVote() {
  const [session, setSession] = useState<VoteSession | null>(null)
  const [myVote, setMyVote] = useState<string | null>(null) // option_id
  const [loading, setLoading] = useState(true)
  const voterToken = getVoterToken()

  const fetchAll = useCallback(async () => {
    const [sessionsRes, optionsRes, votesRes] = await Promise.all([
      supabase.from('vote_sessions').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(1),
      supabase.from('vote_options').select('*').order('sort_order'),
      supabase.from('votes').select('session_id, option_id, voter_token'),
    ])

    const rawSessions = (sessionsRes.data ?? []) as { id: string; question: string; status: 'open' | 'closed'; created_at: string }[]
    const rawOptions = (optionsRes.data ?? []) as { id: string; session_id: string; label: string; sort_order: number }[]
    const rawVotes = (votesRes.data ?? []) as { session_id: string; option_id: string; voter_token: string }[]

    if (rawSessions.length === 0) {
      setSession(null)
      setLoading(false)
      return
    }

    const s = rawSessions[0]
    const opts = rawOptions.filter((o) => o.session_id === s.id)
    const sessionVotes = rawVotes.filter((v) => v.session_id === s.id)
    const options: VoteOption[] = opts.map((o) => ({
      ...o,
      voteCount: sessionVotes.filter((v) => v.option_id === o.id).length,
    }))

    const myVoteRow = sessionVotes.find((v) => v.voter_token === voterToken)
    setMyVote(myVoteRow?.option_id ?? null)
    setSession({ ...s, options, totalVotes: sessionVotes.length })
    setLoading(false)
  }, [voterToken])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const interval = setInterval(fetchAll, 3000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const castVote = async (optionId: string) => {
    if (!session) return
    const { error } = await supabase.rpc('cast_vote', {
      session_id_input: session.id,
      option_id_input: optionId,
      voter_token_input: voterToken,
    })
    if (error) throw error
    setMyVote(optionId)
    await fetchAll()
  }

  return { session, myVote, loading, castVote, voterToken }
}
