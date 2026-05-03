import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Crown, Medal, Award, User, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useStats } from '@/hooks/use-stats'
import { useLeaderboard } from '@/hooks/use-leaderboard'
import { ACTIVITY_FORMAT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useDrinks } from '@/hooks/use-drinks'
import type { DrinkLogEntry } from '@/hooks/use-drinks'

function ordinal(n: number) {
  return `${n}.`
}

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const stats = useStats()
  const { entries: leaderboard } = useLeaderboard()
  const { drinkLogs } = useDrinks()
  const playerDrinks = drinkLogs.filter((l) => l.contestant_id === id)

  if (stats.loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Laster...</div>
    )
  }

  const cs = stats.contestantStats.find((s) => s.contestant.id === id)
  if (!cs) {
    return (
      <div className="space-y-4 pt-8">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Tilbake
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Spiller ikke funnet.
          </CardContent>
        </Card>
      </div>
    )
  }

  const leaderboardEntry = leaderboard.find((e) => e.id === id)
  const rank = leaderboardEntry?.rank
  const totalPoints = leaderboardEntry?.total_points ?? 0

  const RANK_STYLES: Record<number, string> = {
    1: 'neon-border-gold',
    2: 'neon-border-silver',
    3: 'neon-border-bronze',
  }
  const RANK_COLOR: Record<number, string> = {
    1: 'text-gold',
    2: 'text-silver',
    3: 'text-bronze',
  }
  const RANK_ICON: Record<number, typeof Crown> = {
    1: Crown,
    2: Medal,
    3: Award,
  }

  const RankIcon = rank ? RANK_ICON[rank] : null
  const rankColor = rank ? RANK_COLOR[rank] : 'text-muted-foreground'

  // H2H opponents: contestants this player has faced
  const opponents = stats.contestants.filter((c) => {
    if (c.id === id) return false
    const wins = stats.h2h.wins[id!]?.[c.id] ?? 0
    const losses = stats.h2h.wins[c.id]?.[id!] ?? 0
    return wins + losses > 0
  })

  return (
    <div className="space-y-6 pb-8">
      {/* Back nav */}
      <Link
        to="/"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors pt-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Tilbake til resultater
      </Link>

      {/* Hero */}
      <Card className={cn('animate-fade-up', rank && RANK_STYLES[rank])}>
        <CardContent className="flex items-center gap-4 py-5 px-5">
          {cs.contestant.avatar_url ? (
            <img
              src={cs.contestant.avatar_url}
              alt={cs.contestant.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-border shrink-0"
            />
          ) : (
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-2xl font-display border-2 border-border shrink-0',
              rank ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
            )}>
              {cs.contestant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl tracking-wider truncate">{cs.contestant.name}</h1>
            {rank && (
              <div className={cn('flex items-center gap-1.5 mt-1', rankColor)}>
                {RankIcon && <RankIcon className="h-4 w-4" />}
                <span className="text-sm font-medium">{ordinal(rank)} plass</span>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-3xl tracking-tight">{totalPoints}</div>
            <div className="text-xs text-muted-foreground">MM totalt</div>
          </div>
        </CardContent>
      </Card>

      {/* Key stats */}
      <Card className="animate-fade-up" style={{ animationDelay: '60ms' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display tracking-wider">Nøkkelstatistikk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-center">
            <StatCell label="Aktiviteter" value={String(cs.activitiesPlayed)} />
            <StatCell label="Seire" value={String(cs.wins)} />
            <StatCell
              label="Seierrate"
              value={cs.activitiesPlayed > 0 ? `${Math.round(cs.winRate * 100)}%` : '–'}
            />
            <StatCell
              label="Snitt MM"
              value={cs.activitiesPlayed > 0 ? cs.avgPoints.toFixed(1) : '–'}
            />
          </div>
          {cs.bestActivity && (
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-gold shrink-0" />
              <span className="text-muted-foreground">Beste aktivitet:</span>
              <span className="font-medium">{cs.bestActivity.activity.name}</span>
              <span className="text-primary font-display">{cs.bestActivity.points} MM</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity breakdown */}
      {cs.activityBreakdown.length > 0 && (
        <Card className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display tracking-wider">Aktivitetshistorikk</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="divide-y divide-border">
              {cs.activityBreakdown
                .slice()
                .reverse()
                .map((b) => (
                  <div key={b.activity.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        'w-7 text-center font-display text-sm shrink-0',
                        b.rank === 1
                          ? 'text-gold'
                          : b.rank === 2
                            ? 'text-silver'
                            : b.rank === 3
                              ? 'text-bronze'
                              : 'text-muted-foreground',
                      )}
                    >
                      {ordinal(b.rank)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{b.activity.name}</div>
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {ACTIVITY_FORMAT_LABELS[b.activity.format]}
                      </Badge>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-display text-lg tracking-wider text-primary">
                        {b.points}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">MM</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* H2H summary */}
      {opponents.length > 0 && (
        <Card className="animate-fade-up" style={{ animationDelay: '180ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display tracking-wider">Head-to-Head</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="divide-y divide-border">
              {opponents.map((opp) => {
                const wins = stats.h2h.wins[id!]?.[opp.id] ?? 0
                const losses = stats.h2h.wins[opp.id]?.[id!] ?? 0
                return (
                  <div key={opp.id} className="flex items-center gap-3 px-4 py-2.5">
                    {opp.avatar_url ? (
                      <img
                        src={opp.avatar_url}
                        alt={opp.name}
                        className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="flex-1 font-medium text-sm">{opp.name}</span>
                    <span
                      className={cn(
                        'font-display text-sm tracking-wider',
                        wins > losses
                          ? 'text-green-400'
                          : wins < losses
                            ? 'text-red-400'
                            : 'text-yellow-400',
                      )}
                    >
                      {wins} seire – {losses} tap
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drink chart */}
      {playerDrinks.length > 0 && (
        <DrinkChartSection logs={playerDrinks} />
      )}
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="font-display text-xl tracking-wider">{value}</div>
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
    </div>
  )
}

interface PlayerDrinkBucket {
  label: string
  drinks: number
}

function toHourKey(d: Date): string {
  return (
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}`
  )
}

function keyToLabel(key: string): string {
  const [datePart, hourPart] = key.split('T')
  const d = new Date(`${datePart}T${hourPart}:00:00`)
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) + ' ' + hourPart + ':00'
}

function buildPlayerHourlyData(logs: DrinkLogEntry[]): PlayerDrinkBucket[] {
  if (logs.length === 0) return []
  const counts: Record<string, number> = {}
  for (const log of logs) {
    const key = toHourKey(new Date(log.created_at))
    counts[key] = (counts[key] ?? 0) + 1
  }
  const times = logs.map((l) => new Date(l.created_at).getTime())
  const start = new Date(Math.min(...times))
  start.setMinutes(0, 0, 0)
  const end = new Date(Math.max(...times))
  end.setMinutes(0, 0, 0)
  const result: PlayerDrinkBucket[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const key = toHourKey(cur)
    result.push({ label: keyToLabel(key), drinks: counts[key] ?? 0 })
    cur.setHours(cur.getHours() + 1)
  }
  return result
}

function DrinkChartSection({ logs }: { logs: DrinkLogEntry[] }) {
  const data = buildPlayerHourlyData(logs)
  const scrollRef = useRef<HTMLDivElement>(null)
  const width = Math.max(data.length * 44, 300)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [data])

  return (
    <Card className="animate-fade-up" style={{ animationDelay: '240ms' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display tracking-wider">Drikkeprofil 🍺</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <div className="overflow-x-auto" ref={scrollRef}>
          <div style={{ width }}>
            <BarChart width={width} height={180} data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="drinks" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
