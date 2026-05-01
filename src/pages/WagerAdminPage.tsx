import { useState, useEffect } from 'react'
import { Swords } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useContestants } from '@/hooks/use-contestants'
import { useWagers } from '@/hooks/use-wagers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { LeaderboardEntry } from '@/lib/types'

export function WagerAdminPage() {
  const { contestants } = useContestants()
  const { wagers, loading, createWager } = useWagers()

  const [playerAId, setPlayerAId] = useState('')
  const [playerBId, setPlayerBId] = useState('')
  const [betAmount, setBetAmount] = useState('')
  const [winnerId, setWinnerId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [balances, setBalances] = useState<Map<string, number>>(new Map())

  // Fetch current leaderboard balances for validation
  useEffect(() => {
    supabase
      .from('leaderboard')
      .select('id, total_points')
      .then(({ data }) => {
        if (data) {
          setBalances(new Map((data as LeaderboardEntry[]).map((e) => [e.id, e.total_points])))
        }
      })
  }, [wagers]) // refresh after each wager is created

  const bet = parseInt(betAmount, 10)
  const validBet = !isNaN(bet) && bet > 0
  const balanceA = playerAId ? (balances.get(playerAId) ?? 0) : null
  const balanceB = playerBId ? (balances.get(playerBId) ?? 0) : null
  const aCanAfford = balanceA === null || !validBet || balanceA >= bet
  const bCanAfford = balanceB === null || !validBet || balanceB >= bet

  const canSubmit =
    playerAId &&
    playerBId &&
    playerAId !== playerBId &&
    validBet &&
    winnerId &&
    aCanAfford &&
    bCanAfford &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      await createWager(playerAId, playerBId, bet, winnerId)
      setPlayerAId('')
      setPlayerBId('')
      setBetAmount('')
      setWinnerId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setSubmitting(false)
    }
  }

  const playerA = contestants.find((c) => c.id === playerAId)
  const playerB = contestants.find((c) => c.id === playerBId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5" />
        <h1 className="text-xl font-display tracking-wider">Veddemål</h1>
      </div>

      {/* Creation form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display tracking-wider">Nytt veddemål</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Player selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Spiller A</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={playerAId}
                  onChange={(e) => {
                    setPlayerAId(e.target.value)
                    if (winnerId && winnerId !== playerBId) setWinnerId('')
                  }}
                >
                  <option value="">Velg spiller…</option>
                  {contestants.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.id === playerBId}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {playerAId && validBet && !aCanAfford && (
                  <p className="text-xs text-destructive">
                    {playerA?.name} har bare {balanceA} poeng
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Spiller B</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={playerBId}
                  onChange={(e) => {
                    setPlayerBId(e.target.value)
                    if (winnerId && winnerId !== playerAId) setWinnerId('')
                  }}
                >
                  <option value="">Velg spiller…</option>
                  {contestants.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.id === playerAId}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {playerBId && validBet && !bCanAfford && (
                  <p className="text-xs text-destructive">
                    {playerB?.name} har bare {balanceB} poeng
                  </p>
                )}
              </div>
            </div>

            {/* Bet amount */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Innsats (poeng)</label>
              <Input
                type="number"
                min={1}
                placeholder="0"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-32"
              />
            </div>

            {/* Winner toggle — only shown when both players are selected */}
            {playerA && playerB && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Vinner</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={winnerId === playerA.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWinnerId(playerA.id)}
                  >
                    {playerA.name}
                  </Button>
                  <Button
                    type="button"
                    variant={winnerId === playerB.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWinnerId(playerB.id)}
                  >
                    {playerB.name}
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={!canSubmit}>
              {submitting ? 'Oppretter…' : 'Opprett veddemål'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Past wagers */}
      {!loading && wagers.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display text-sm tracking-widest text-muted-foreground px-1">
            Historikk
          </h2>
          {wagers.map((w) => (
            <Card key={w.activity.id}>
              <CardContent className="flex items-center gap-3 py-3 px-4 text-sm">
                <Swords className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1">
                  <span className="font-medium text-primary">{w.winner.name}</span>
                  {' vant '}
                  <span className="font-display text-primary">{w.betAmount}</span>
                  {' poeng fra '}
                  <span className="font-medium">{w.loser.name}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(w.activity.created_at).toLocaleDateString('nb-NO', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
