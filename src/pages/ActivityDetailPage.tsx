import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { useActivities } from '@/hooks/use-activities'
import { useMatches } from '@/hooks/use-matches'
import { usePoints } from '@/hooks/use-points'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Play, CheckCircle, Trash2, Shuffle } from 'lucide-react'
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_FORMAT_LABELS,
  STATUS_LABELS,
  TEAM_SIZES,
} from '@/lib/constants'
import { shuffle } from '@/lib/utils'
import { suggestFreeForAllPoints } from '@/lib/algorithms/points'
import {
  computeBracketRanking,
  computeRoundRobinRanking,
  computeTeamBattlePoints,
  rankingToPoints,
} from '@/lib/algorithms/ranking'
import { generateRoundRobin } from '@/lib/algorithms/round-robin'
import { generateDoubleElimination } from '@/lib/algorithms/double-elimination'
import type { Activity, Contestant, Match, MatchPlayer } from '@/lib/types'

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessionToken } = useAuth()
  const { updateActivityStatus, deleteActivity } = useActivities()
  const { matches, matchPlayers, setMatchResult, deleteMatch, refetch: refetchMatches } = useMatches(id!)
  const { points, savePoints } = usePoints(id!)

  const [activity, setActivity] = useState<Activity | null>(null)
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [activityContestantIds, setActivityContestantIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pointValues, setPointValues] = useState<Record<string, number>>({})
  const [pointsTouched, setPointsTouched] = useState(false)
  const [freeForAllRankings, setFreeForAllRankings] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  // Wraps mutation handlers so any thrown error becomes a user-visible
  // message instead of an unhandled promise rejection.
  async function runAction(label: string, fn: () => Promise<void>) {
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      console.error(label, e)
      setActionError(`${label} feilet. Prov igjen.`)
    }
  }

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

  // Initialize point values from saved points (treat as user-edited so the
  // auto-computed proposal doesn't overwrite them on reopen).
  useEffect(() => {
    if (points.length > 0) {
      const vals: Record<string, number> = {}
      points.forEach((p) => { vals[p.contestant_id] = p.amount })
      setPointValues(vals)
      setPointsTouched(true)
    }
  }, [points])

  // Initialize free-for-all rankings
  useEffect(() => {
    if (activity?.format === 'free_for_all' && activityContestantIds.length > 0 && freeForAllRankings.length === 0) {
      setFreeForAllRankings(activityContestantIds)
    }
  }, [activity, activityContestantIds, freeForAllRankings.length])

  // True when there are no outstanding matches blocking results. Free-for-all
  // has no matches, so it's always "ready" once a ranking exists.
  const allMatchesComplete = useMemo(() => {
    if (!activity) return false
    if (activity.format === 'free_for_all') return freeForAllRankings.length > 0
    return matches.length > 0 && matches.every((m) => m.status === 'completed')
  }, [activity, matches, freeForAllRankings.length])

  // True for the few formats that record actual matches in the matches table.
  const hasMatches = activity?.format !== 'free_for_all'

  // Auto-computed point proposal based on the current results / ranking. Empty
  // when results are not yet final, so the input fields are left untouched
  // until the activity is actually decided.
  const proposedPoints = useMemo<Record<string, number>>(() => {
    if (!activity) return {}
    if (activity.format === 'free_for_all') {
      const scale = suggestFreeForAllPoints(freeForAllRankings.length)
      const out: Record<string, number> = {}
      freeForAllRankings.forEach((cId, i) => { out[cId] = scale[i] ?? 0 })
      return out
    }
    if (!allMatchesComplete) return {}
    if (activity.format === 'team_battle') {
      return computeTeamBattlePoints(matches, matchPlayers)
    }
    const ranks =
      activity.format === 'round_robin'
        ? computeRoundRobinRanking(activityContestantIds, matches, matchPlayers)
        : computeBracketRanking(matches, matchPlayers)
    return rankingToPoints(ranks, activityContestantIds.length)
  }, [activity, matches, matchPlayers, freeForAllRankings, allMatchesComplete, activityContestantIds])

  // Push proposed values into the inputs as long as the user hasn't manually
  // edited them (or loaded previously-saved points).
  useEffect(() => {
    if (pointsTouched) return
    if (Object.keys(proposedPoints).length === 0) return
    setPointValues(proposedPoints)
  }, [proposedPoints, pointsTouched])

  if (loading || !activity) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  const activeContestants = contestants.filter((c) => activityContestantIds.includes(c.id))
  const contestantMap = new Map(contestants.map((c) => [c.id, c]))

  function getPlayerName(id: string): string {
    return contestantMap.get(id)?.name ?? 'Ukjent'
  }

  function getTeamSize(): number {
    return TEAM_SIZES[activity!.type] ?? 0
  }

  function handleDeleteActivity() {
    if (!window.confirm(`Slette "${activity!.name}"? Alle kamper og poeng for denne aktiviteten forsvinner.`)) return
    void runAction('Sletting', async () => {
      await deleteActivity(id!)
      navigate('/admin/activities')
    })
  }

  function handleStatusChange(status: Activity['status']) {
    void runAction('Statusendring', async () => {
      await updateActivityStatus(id!, status)
      setActivity({ ...activity!, status })
    })
  }

  // Save the current point values, then mark the activity completed. Points
  // are only persisted to the leaderboard at this moment. If savePoints
  // throws, the activity is NOT marked completed.
  function handleCompleteAndAward() {
    void runAction('Fullforing', async () => {
      const data = activityContestantIds.map((cId) => ({
        contestant_id: cId,
        amount: pointValues[cId] ?? 0,
      }))
      await savePoints(data)
      await updateActivityStatus(id!, 'completed')
      setActivity({ ...activity!, status: 'completed' })
    })
  }

  function resetToProposed() {
    setPointValues(proposedPoints)
    setPointsTouched(false)
  }

  function updatePointValue(cId: string, amount: number) {
    setPointValues({ ...pointValues, [cId]: amount })
    setPointsTouched(true)
  }

  function handleGenerateRoundRobin() {
    void runAction('Generering av kamper', async () => {
      const teamSize = getTeamSize()
      // num_rounds is set during activity creation; treat 0 / unset as "alle".
      const cap = activity!.num_rounds && activity!.num_rounds > 0 ? activity!.num_rounds : undefined
      const rrMatches = generateRoundRobin(activityContestantIds, teamSize, cap)
      const { error } = await supabase.rpc('create_round_robin_matches', {
        token_input: sessionToken,
        activity_id_input: id!,
        matches_data: rrMatches.map((m) => ({
          team1: m.team1,
          team2: m.team2,
          round: m.round,
        })),
      })
      if (error) throw error
      await refetchMatches()
    })
  }

  // Team battle: split the roster into two random halves and create N matches
  // (all sharing the same teams) where N = activity.num_rounds. Re-clicking
  // re-shuffles, since create_round_robin_matches deletes the existing rows
  // for this activity first.
  function handleGenerateTeamBattle() {
    void runAction('Generering av lagkamper', async () => {
      const shuffled = shuffle(activityContestantIds)
      // Split into two teams. On an odd roster, team2 ends up one player
      // larger rather than dropping anyone — every selected player must play.
      const half = Math.floor(shuffled.length / 2)
      const team1 = shuffled.slice(0, half)
      const team2 = shuffled.slice(half)
      if (team1.length === 0 || team2.length === 0) {
        throw new Error('Trenger minst to spillere for lagkamp')
      }
      const numMatches = Math.max(1, activity!.num_rounds || 1)
      const matchesData = Array.from({ length: numMatches }, (_, i) => ({
        team1,
        team2,
        round: i + 1,
      }))
      const { error } = await supabase.rpc('create_round_robin_matches', {
        token_input: sessionToken,
        activity_id_input: id!,
        matches_data: matchesData,
      })
      if (error) throw error
      await refetchMatches()
    })
  }

  function handleGenerateDoubleElim() {
    void runAction('Generering av bracket', async () => {
      const teamSize = getTeamSize()
      const shuffled = shuffle(activityContestantIds)
      const teams: string[][] = []
      for (let i = 0; i < shuffled.length; i += teamSize) {
        if (i + teamSize <= shuffled.length) {
          teams.push(shuffled.slice(i, i + teamSize))
        }
      }
      // Players are already shuffled, so the team order here is also random.
      const bracket = generateDoubleElimination(teams)
      const { error } = await supabase.rpc('create_bracket_matches', {
        token_input: sessionToken,
        activity_id_input: id!,
        matches_data: bracket.map((m) => ({
          bracket: m.bracket,
          bracket_round: m.bracketRound,
          bracket_position: m.bracketPosition,
          team1: m.team1,
          team2: m.team2,
          team1_source_temp: m.team1Source?.matchId ?? null,
          team1_source_from: m.team1Source?.from ?? null,
          team2_source_temp: m.team2Source?.matchId ?? null,
          team2_source_from: m.team2Source?.from ?? null,
          temp_id: m.id,
        })),
      })
      if (error) throw error
      await refetchMatches()
    })
  }

  function moveRanking(index: number, direction: 'up' | 'down') {
    const newRankings = [...freeForAllRankings]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newRankings.length) return
    ;[newRankings[index], newRankings[newIndex]] = [newRankings[newIndex], newRankings[index]]
    setFreeForAllRankings(newRankings)
  }

  const matchesByRound = matches.reduce<Record<number, Match[]>>((acc, m) => {
    const round = m.round ?? 0
    if (!acc[round]) acc[round] = []
    acc[round].push(m)
    return acc
  }, {})

  const matchesByBracket = matches.reduce<Record<string, Match[]>>((acc, m) => {
    const bracket = m.bracket ?? 'other'
    if (!acc[bracket]) acc[bracket] = []
    acc[bracket].push(m)
    return acc
  }, {})

  const BRACKET_LABELS: Record<string, string> = {
    winners: 'Vinnerbracket',
    losers: 'Taperbracket',
    grand_final: 'Storfinal',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/activities')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-display tracking-wider">{activity.name}</h1>
          <div className="flex gap-1 mt-1">
            <Badge variant="secondary">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
            <Badge variant="outline">{ACTIVITY_FORMAT_LABELS[activity.format]}</Badge>
            <Badge>{STATUS_LABELS[activity.status] ?? activity.status}</Badge>
          </div>
        </div>
      </div>

      {actionError && (
        <Card className="border-destructive">
          <CardContent className="py-2 text-sm text-destructive flex items-center justify-between gap-2">
            <span>{actionError}</span>
            <Button size="sm" variant="ghost" onClick={() => setActionError(null)}>
              Lukk
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status controls */}
      <Card>
        <CardContent className="py-3 flex gap-2 flex-wrap">
          {activity.status === 'draft' && (
            <Button size="sm" onClick={() => handleStatusChange('in_progress')}>
              <Play className="h-4 w-4 mr-1" /> Start
            </Button>
          )}
          {activity.status === 'in_progress' && (
            <Button
              size="sm"
              onClick={handleCompleteAndAward}
              disabled={!allMatchesComplete}
              title={allMatchesComplete ? undefined : 'Alle kamper ma vaere ferdig'}
            >
              <CheckCircle className="h-4 w-4 mr-1" /> Fullfor og tildel poeng
            </Button>
          )}
          {activity.status === 'completed' && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange('in_progress')}>
              Gjenapne
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={handleDeleteActivity}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Slett
          </Button>
        </CardContent>
      </Card>

      {/* Contestants */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Deltakere ({activeContestants.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {activeContestants.map((c) => (
            <Badge key={c.id} variant="secondary">{c.name}</Badge>
          ))}
        </CardContent>
      </Card>

      {/* Free-for-all: ranking + auto-proposed points */}
      {activity.format === 'free_for_all' && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Rangering & Poeng</CardTitle>
            <p className="text-xs text-muted-foreground">
              Foreslatte poeng oppdateres automatisk fra rangeringen. Lagres nar du fullforer aktiviteten.
            </p>
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
                  onChange={(e) => updatePointValue(cId, parseInt(e.target.value) || 0)}
                />
                <span className="text-xs text-muted-foreground">MM</span>
              </div>
            ))}
            {pointsTouched && Object.keys(proposedPoints).length > 0 && (
              <div className="pt-2">
                <Button size="sm" variant="outline" onClick={resetToProposed}>
                  <Shuffle className="h-4 w-4 mr-1" /> Tilbakestill til forslag
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Round Robin */}
      {activity.format === 'round_robin' && (
        <>
          {matches.length === 0 && (
            <Card>
              <CardContent className="py-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Genererer inntil {activity.num_rounds || '?'} kamper basert pa innstillinger fra opprettelsen.
                </p>
                <Button size="sm" onClick={handleGenerateRoundRobin}>
                  <Shuffle className="h-4 w-4 mr-1" /> Generer kamper
                </Button>
              </CardContent>
            </Card>
          )}

          {Object.entries(matchesByRound)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([round, roundMatches]) => (
              <Card key={round}>
                <CardHeader className="py-2">
                  <CardTitle className="text-sm">Runde {round}</CardTitle>
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
                  <Shuffle className="h-4 w-4 mr-1" /> Generer bracket
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
                  <CardTitle className="text-sm">
                    {BRACKET_LABELS[bracket] ?? bracket}
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

      {/* Team Battle */}
      {activity.format === 'team_battle' && (
        <>
          <Card>
            <CardContent className="py-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                {matches.length === 0
                  ? `Spillerne deles tilfeldig i to lag. ${activity.num_rounds || 1} kamp${(activity.num_rounds || 1) === 1 ? '' : 'er'} mellom lagene.`
                  : 'Klikk for a omfordele lagene tilfeldig (sletter eksisterende kamper).'}
              </p>
              <Button size="sm" onClick={handleGenerateTeamBattle}>
                <Shuffle className="h-4 w-4 mr-1" />
                {matches.length === 0 ? 'Generer lagkamper' : 'Omfordel lag'}
              </Button>
            </CardContent>
          </Card>

          {matches.length > 0 && (() => {
            const refMatch = matches[0]
            const team1 = matchPlayers
              .filter((mp) => mp.match_id === refMatch.id && mp.team === 1)
              .map((mp) => getPlayerName(mp.contestant_id))
            const team2 = matchPlayers
              .filter((mp) => mp.match_id === refMatch.id && mp.team === 2)
              .map((mp) => getPlayerName(mp.contestant_id))
            return (
              <Card>
                <CardHeader className="py-2">
                  <CardTitle className="text-sm">Lag</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div><span className="font-bold">Lag 1:</span> {team1.join(', ')}</div>
                  <div><span className="font-bold">Lag 2:</span> {team2.join(', ')}</div>
                </CardContent>
              </Card>
            )
          })()}

          {matches.length > 0 && (
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Kamper</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {matches.map((m, i) => (
                  <MatchRow
                    key={m.id}
                    label={`Kamp ${i + 1}`}
                    match={m}
                    players={matchPlayers.filter((mp) => mp.match_id === m.id)}
                    getPlayerName={getPlayerName}
                    onResult={setMatchResult}
                    onDelete={deleteMatch}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Points section for team games -- only after all matches are done */}
      {hasMatches && matches.length > 0 && allMatchesComplete && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Poeng (Mats Munny)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Foreslatte poeng er regnet ut fra resultatene. Lagres nar du fullforer aktiviteten.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeContestants.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{c.name}</span>
                <Input
                  type="number"
                  className="w-16 text-center"
                  value={pointValues[c.id] ?? 0}
                  onChange={(e) => updatePointValue(c.id, parseInt(e.target.value) || 0)}
                />
                <span className="text-xs text-muted-foreground">MM</span>
              </div>
            ))}
            {pointsTouched && Object.keys(proposedPoints).length > 0 && (
              <div className="pt-2">
                <Button size="sm" variant="outline" onClick={resetToProposed}>
                  <Shuffle className="h-4 w-4 mr-1" /> Tilbakestill til forslag
                </Button>
              </div>
            )}
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
  label,
}: {
  match: Match
  players: MatchPlayer[]
  getPlayerName: (id: string) => string
  onResult: (matchId: string, winningTeam: number) => void
  onDelete: (matchId: string) => void
  label?: string
}) {
  const team1 = players.filter((p) => p.team === 1).map((p) => getPlayerName(p.contestant_id))
  const team2 = players.filter((p) => p.team === 2).map((p) => getPlayerName(p.contestant_id))

  return (
    <div className="flex items-center gap-2 text-sm border rounded-md p-2">
      {label && <span className="text-xs text-muted-foreground w-12 shrink-0">{label}</span>}
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
            ←V
          </Button>
          <Button size="sm" variant="outline" onClick={() => onResult(match.id, 2)} className="text-xs px-2 h-7">
            V→
          </Button>
        </div>
      )}
      {match.status === 'completed' && (
        <Badge variant="secondary" className="text-xs">Ferdig</Badge>
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(match.id)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}
