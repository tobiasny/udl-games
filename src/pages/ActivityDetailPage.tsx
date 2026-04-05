import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { useMatches } from '@/hooks/use-matches'
import { usePoints } from '@/hooks/use-points'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Play, CheckCircle, Trash2, Shuffle, Save } from 'lucide-react'
import { ACTIVITY_TYPE_LABELS, ACTIVITY_FORMAT_LABELS } from '@/lib/constants'
import { suggestFreeForAllPoints, suggestTeamPoints } from '@/lib/algorithms/points'
import { generateRoundRobin } from '@/lib/algorithms/round-robin'
import { generateDoubleElimination, shuffleTeams } from '@/lib/algorithms/double-elimination'
import type { Activity, Contestant, Match, MatchPlayer } from '@/lib/types'

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessionToken } = useAuth()
  const { matches, matchPlayers, setMatchResult, deleteMatch, refetch: refetchMatches } = useMatches(id!)
  const { points, savePoints } = usePoints(id!)

  const [activity, setActivity] = useState<Activity | null>(null)
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [activityContestantIds, setActivityContestantIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pointValues, setPointValues] = useState<Record<string, number>>({})
  const [freeForAllRankings, setFreeForAllRankings] = useState<string[]>([])
  const [maxMatches, setMaxMatches] = useState<number | undefined>()

  useEffect(() => {
    async function load() {
      const [actRes, acRes, contRes] = await Promise.all([
        supabase.from('activities').select('*').eq('id', id!).single(),
        supabase.from('activity_contestants').select('contestant_id').eq('activity_id', id!),
        supabase.from('contestants').select('*').order('name'),
      ])
      if (actRes.data) setActivity(actRes.data)
      if (acRes.data) setActivityContestantIds(acRes.data.map((ac) => ac.contestant_id))
      if (contRes.data) setContestants(contRes.data)
      setLoading(false)
    }
    load()
  }, [id])

  // Initialize point values from saved points
  useEffect(() => {
    if (points.length > 0) {
      const vals: Record<string, number> = {}
      points.forEach((p) => { vals[p.contestant_id] = p.amount })
      setPointValues(vals)
    }
  }, [points])

  // Initialize free-for-all rankings
  useEffect(() => {
    if (activity?.format === 'free_for_all' && activityContestantIds.length > 0 && freeForAllRankings.length === 0) {
      setFreeForAllRankings(activityContestantIds)
    }
  }, [activity, activityContestantIds, freeForAllRankings.length])

  if (loading || !activity) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

  const activeContestants = contestants.filter((c) => activityContestantIds.includes(c.id))
  const contestantMap = new Map(contestants.map((c) => [c.id, c]))

  function getPlayerName(id: string): string {
    return contestantMap.get(id)?.name ?? 'Unknown'
  }

  function getTeamSize(): number {
    const map: Record<string, number> = { '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4, free_for_all: 0 }
    return map[activity!.type] ?? 0
  }

  // Suggest points based on current rankings
  function suggestPoints() {
    if (activity!.format === 'free_for_all') {
      const suggested = suggestFreeForAllPoints(freeForAllRankings.length)
      const vals: Record<string, number> = {}
      freeForAllRankings.forEach((cId, i) => { vals[cId] = suggested[i] })
      setPointValues(vals)
    } else {
      // For team games, calculate wins per player from matches
      const wins: Record<string, number> = {}
      activityContestantIds.forEach((cId) => { wins[cId] = 0 })
      matches.filter((m) => m.status === 'completed' && m.winning_team).forEach((m) => {
        const players = matchPlayers.filter((mp) => mp.match_id === m.id && mp.team === m.winning_team)
        players.forEach((mp) => { wins[mp.contestant_id] = (wins[mp.contestant_id] ?? 0) + 1 })
      })
      const ranked = [...activityContestantIds].sort((a, b) => (wins[b] ?? 0) - (wins[a] ?? 0))
      const suggested = suggestTeamPoints(ranked.length)
      const vals: Record<string, number> = {}
      ranked.forEach((cId, i) => { vals[cId] = suggested[i] })
      setPointValues(vals)
    }
  }

  async function handleSavePoints() {
    const data = activityContestantIds.map((cId) => ({
      contestant_id: cId,
      amount: pointValues[cId] ?? 0,
    }))
    await savePoints(data)
  }

  async function handleStatusChange(status: Activity['status']) {
    await supabase.rpc('update_activity_status', {
      token_input: sessionToken,
      activity_id_input: id!,
      status_input: status,
    })
    setActivity({ ...activity!, status })
  }

  async function handleGenerateRoundRobin() {
    const teamSize = getTeamSize()
    const rrMatches = generateRoundRobin(activityContestantIds, teamSize, maxMatches)
    const { error } = await supabase.rpc('create_round_robin_matches', {
      token_input: sessionToken,
      activity_id_input: id!,
      matches_data: rrMatches.map((m) => ({
        team1: m.team1,
        team2: m.team2,
        round: m.round,
      })),
    })
    if (!error) refetchMatches()
  }

  async function handleGenerateDoubleElim() {
    const teamSize = getTeamSize()
    // Create random teams from available contestants
    const shuffled = [...activityContestantIds].sort(() => Math.random() - 0.5)
    const teams: string[][] = []
    for (let i = 0; i < shuffled.length; i += teamSize) {
      if (i + teamSize <= shuffled.length) {
        teams.push(shuffled.slice(i, i + teamSize))
      }
    }
    const bracket = generateDoubleElimination(shuffleTeams(teams))
    const { error } = await supabase.rpc('create_bracket_matches', {
      token_input: sessionToken,
      activity_id_input: id!,
      matches_data: bracket.map((m) => ({
        bracket: m.bracket,
        bracket_round: m.bracketRound,
        bracket_position: m.bracketPosition,
        team1: m.team1,
        team2: m.team2,
        source_match_winner: m.sourceMatchWinner,
        source_match_loser: m.sourceMatchLoser,
        temp_id: m.id,
      })),
    })
    if (!error) refetchMatches()
  }

  function moveRanking(index: number, direction: 'up' | 'down') {
    const newRankings = [...freeForAllRankings]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newRankings.length) return
    ;[newRankings[index], newRankings[newIndex]] = [newRankings[newIndex], newRankings[index]]
    setFreeForAllRankings(newRankings)
  }

  // Group matches by round for round robin
  const matchesByRound = matches.reduce<Record<number, Match[]>>((acc, m) => {
    const round = m.round ?? 0
    if (!acc[round]) acc[round] = []
    acc[round].push(m)
    return acc
  }, {})

  // Group matches by bracket for double elimination
  const matchesByBracket = matches.reduce<Record<string, Match[]>>((acc, m) => {
    const bracket = m.bracket ?? 'other'
    if (!acc[bracket]) acc[bracket] = []
    acc[bracket].push(m)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/activities')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{activity.name}</h1>
          <div className="flex gap-1 mt-1">
            <Badge variant="secondary">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
            <Badge variant="outline">{ACTIVITY_FORMAT_LABELS[activity.format]}</Badge>
            <Badge>{activity.status}</Badge>
          </div>
        </div>
      </div>

      {/* Status controls */}
      <Card>
        <CardContent className="py-3 flex gap-2 flex-wrap">
          {activity.status === 'draft' && (
            <Button size="sm" onClick={() => handleStatusChange('in_progress')}>
              <Play className="h-4 w-4 mr-1" /> Start
            </Button>
          )}
          {activity.status === 'in_progress' && (
            <Button size="sm" onClick={() => handleStatusChange('completed')}>
              <CheckCircle className="h-4 w-4 mr-1" /> Complete
            </Button>
          )}
          {activity.status === 'completed' && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange('in_progress')}>
              Reopen
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Contestants */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Contestants ({activeContestants.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {activeContestants.map((c) => (
            <Badge key={c.id} variant="secondary">{c.name}</Badge>
          ))}
        </CardContent>
      </Card>

      {/* Free-for-all: ranking + points */}
      {activity.format === 'free_for_all' && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Rankings & Points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {freeForAllRankings.map((cId, index) => (
              <div key={cId} className="flex items-center gap-2">
                <span className="w-6 text-center font-bold text-sm">{index + 1}</span>
                <span className="flex-1 text-sm">{getPlayerName(cId)}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => moveRanking(index, 'up')} disabled={index === 0}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => moveRanking(index, 'down')} disabled={index === freeForAllRankings.length - 1}>
                    ↓
                  </Button>
                </div>
                <Input
                  type="number"
                  className="w-16 text-center"
                  value={pointValues[cId] ?? 0}
                  onChange={(e) => setPointValues({ ...pointValues, [cId]: parseInt(e.target.value) || 0 })}
                />
                <span className="text-xs text-muted-foreground">MM</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={suggestPoints}>
                <Shuffle className="h-4 w-4 mr-1" /> Suggest
              </Button>
              <Button size="sm" onClick={handleSavePoints}>
                <Save className="h-4 w-4 mr-1" /> Save Points
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Round Robin */}
      {activity.format === 'round_robin' && (
        <>
          {matches.length === 0 && (
            <Card>
              <CardContent className="py-4 space-y-3">
                <p className="text-sm text-muted-foreground">Generate round robin matches</p>
                <div className="flex items-center gap-2">
                  <label className="text-sm">Max matches:</label>
                  <Input
                    type="number"
                    className="w-20"
                    placeholder="All"
                    value={maxMatches ?? ''}
                    onChange={(e) => setMaxMatches(e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
                <Button size="sm" onClick={handleGenerateRoundRobin}>
                  <Shuffle className="h-4 w-4 mr-1" /> Generate Matches
                </Button>
              </CardContent>
            </Card>
          )}

          {Object.entries(matchesByRound)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([round, roundMatches]) => (
              <Card key={round}>
                <CardHeader className="py-2">
                  <CardTitle className="text-sm">Round {round}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {roundMatches.map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      players={matchPlayers.filter((mp) => mp.match_id === m.id)}
                      getPlayerName={getPlayerName}
                      onResult={setMatchResult}
                      onDelete={deleteMatch}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
        </>
      )}

      {/* Double Elimination */}
      {activity.format === 'double_elimination' && (
        <>
          {matches.length === 0 && (
            <Card>
              <CardContent className="py-4">
                <Button size="sm" onClick={handleGenerateDoubleElim}>
                  <Shuffle className="h-4 w-4 mr-1" /> Generate Bracket
                </Button>
              </CardContent>
            </Card>
          )}

          {['winners', 'losers', 'grand_final'].map((bracket) => {
            const bracketMatches = matchesByBracket[bracket]
            if (!bracketMatches?.length) return null
            return (
              <Card key={bracket}>
                <CardHeader className="py-2">
                  <CardTitle className="text-sm capitalize">
                    {bracket === 'grand_final' ? 'Grand Final' : `${bracket} Bracket`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {bracketMatches
                    .sort((a, b) => (a.bracket_round ?? 0) - (b.bracket_round ?? 0) || (a.bracket_position ?? 0) - (b.bracket_position ?? 0))
                    .map((m) => (
                      <MatchRow
                        key={m.id}
                        match={m}
                        players={matchPlayers.filter((mp) => mp.match_id === m.id)}
                        getPlayerName={getPlayerName}
                        onResult={setMatchResult}
                        onDelete={deleteMatch}
                      />
                    ))}
                </CardContent>
              </Card>
            )
          })}
        </>
      )}

      {/* Points section for team games */}
      {activity.format !== 'free_for_all' && matches.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Points (Mats Munny)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeContestants.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{c.name}</span>
                <Input
                  type="number"
                  className="w-16 text-center"
                  value={pointValues[c.id] ?? 0}
                  onChange={(e) => setPointValues({ ...pointValues, [c.id]: parseInt(e.target.value) || 0 })}
                />
                <span className="text-xs text-muted-foreground">MM</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={suggestPoints}>
                <Shuffle className="h-4 w-4 mr-1" /> Suggest
              </Button>
              <Button size="sm" onClick={handleSavePoints}>
                <Save className="h-4 w-4 mr-1" /> Save Points
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MatchRow({
  match,
  players,
  getPlayerName,
  onResult,
  onDelete,
}: {
  match: Match
  players: MatchPlayer[]
  getPlayerName: (id: string) => string
  onResult: (matchId: string, winningTeam: number) => void
  onDelete: (matchId: string) => void
}) {
  const team1 = players.filter((p) => p.team === 1).map((p) => getPlayerName(p.contestant_id))
  const team2 = players.filter((p) => p.team === 2).map((p) => getPlayerName(p.contestant_id))

  return (
    <div className="flex items-center gap-2 text-sm border rounded-md p-2">
      <div className={`flex-1 text-right ${match.winning_team === 1 ? 'font-bold' : ''}`}>
        {team1.length > 0 ? team1.join(' & ') : 'TBD'}
      </div>
      <span className="text-muted-foreground px-1">vs</span>
      <div className={`flex-1 ${match.winning_team === 2 ? 'font-bold' : ''}`}>
        {team2.length > 0 ? team2.join(' & ') : 'TBD'}
      </div>
      {match.status !== 'completed' && team1.length > 0 && team2.length > 0 && (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => onResult(match.id, 1)} className="text-xs px-2 h-7">
            ←W
          </Button>
          <Button size="sm" variant="outline" onClick={() => onResult(match.id, 2)} className="text-xs px-2 h-7">
            W→
          </Button>
        </div>
      )}
      {match.status === 'completed' && (
        <Badge variant="secondary" className="text-xs">Done</Badge>
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(match.id)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}
