import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useLeaderboard, type LeaderboardEntryWithDelta } from '@/hooks/use-leaderboard'
import { useActivityHistory } from '@/hooks/use-activity-history'
import { useNextActivity } from '@/hooks/use-next-activity'
import { Card, CardContent } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { cn } from '@/lib/utils'
import { Crown, Medal, Award, TrendingUp, TrendingDown, Radio, Clock } from 'lucide-react'

const RANK_STYLES: Record<number, string> = {
  1: 'neon-border-gold',
  2: 'neon-border-silver',
  3: 'neon-border-bronze',
}

const RANK_BADGE: Record<number, string> = {
  1: 'text-gold',
  2: 'text-silver',
  3: 'text-bronze',
}

const RANK_ICON: Record<number, typeof Crown> = {
  1: Crown,
  2: Medal,
  3: Award,
}

function ordinal(n: number) {
  if (n === 1) return '1.'
  if (n === 2) return '2.'
  if (n === 3) return '3.'
  return `${n}.`
}

export function LeaderboardPage() {
  const { entries, loading } = useLeaderboard()
  const { currents } = useActivityHistory()
  const { next } = useNextActivity()
  const firedRef = useRef<Set<string>>(new Set())

  // Fire confetti when any entry gains points
  useEffect(() => {
    const gainers = entries.filter((e) => e.pointsDelta > 0)
    if (gainers.length === 0) return
    // Use total_points as a unique key so we only fire once per award
    const key = gainers.map((e) => `${e.id}:${e.total_points}`).join(',')
    if (firedRef.current.has(key)) return
    firedRef.current.add(key)

    confetti({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#c9a227', '#10b981', '#e34c26', '#a855f7', '#06b6d4'],
    })
  }, [entries])

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Hero header */}
      <div className="text-center pt-8 pb-2 animate-fade-up">
        <h1 className="font-display text-4xl tracking-tight">
          Mats Games
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Mats drekkes ut
        </p>
      </div>

      {/* Activity status row — active + next side by side when both present */}
      {(currents.length > 0 || (next && !currents.some((c) => c.activity.id === next?.id))) && (
        <div className={`grid gap-3 animate-fade-up ${
          currents.length > 0 && next && !currents.some((c) => c.activity.id === next.id)
            ? 'grid-cols-2'
            : 'grid-cols-1'
        }`}>
          {/* "Nå spilles" card */}
          {currents.length > 0 && (
            <Link to="/activities" className="min-w-0">
              <div className="flex flex-col gap-2 px-4 py-4 h-full rounded-2xl border border-primary/40 bg-primary/8 hover:bg-primary/12 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 shrink-0">
                    <Radio className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <span className="text-xs font-mono tracking-widest uppercase text-primary/70">Spilles nå</span>
                </div>
                <div className="font-semibold text-sm leading-snug line-clamp-2">
                  {currents.length === 1
                    ? currents[0].activity.name
                    : `${currents.length} aktiviteter pågår`}
                </div>
              </div>
            </Link>
          )}

          {/* "Neste aktivitet" card */}
          {next && !currents.some((c) => c.activity.id === next.id) && (
            <div className="flex flex-col gap-2 px-4 py-4 h-full rounded-2xl border border-border bg-card/40 min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Neste</span>
              </div>
              <div className="font-semibold text-sm leading-snug line-clamp-2">{next.name}</div>
            </div>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <Card className="animate-fade-up">
          <CardContent className="py-8 text-center text-muted-foreground">
            Ingen poeng delt ut ennå. La lekene begynne!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <LeaderboardRow key={entry.id} entry={entry} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function LeaderboardRow({ entry, index }: { entry: LeaderboardEntryWithDelta; index: number }) {
  const RankIcon = RANK_ICON[entry.rank]
  const [showDelta, setShowDelta] = useState(false)
  const [showRankChange, setShowRankChange] = useState(false)

  useEffect(() => {
    if (entry.pointsDelta !== 0) {
      setShowDelta(true)
      const timer = setTimeout(() => setShowDelta(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [entry.pointsDelta, entry.total_points])

  useEffect(() => {
    if (entry.rankDelta !== 0) {
      setShowRankChange(true)
      const timer = setTimeout(() => setShowRankChange(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [entry.rankDelta, entry.rank])

  return (
    <Link to={`/players/${entry.id}`}>
    <Card
      className={cn(
        'transition-all hover:scale-[1.01] animate-fade-up cursor-pointer',
        RANK_STYLES[entry.rank] ?? 'border-border',
        entry.pointsDelta > 0 && showDelta && 'ring-1 ring-primary/40'
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <CardContent className="flex items-center justify-between py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-display tracking-wider relative',
            entry.rank <= 3
              ? `${RANK_BADGE[entry.rank]} bg-current/10`
              : 'text-muted-foreground bg-secondary'
          )}>
            {RankIcon ? (
              <RankIcon className="h-5 w-5" />
            ) : (
              <span className="font-display text-lg">{entry.rank}</span>
            )}
            {showRankChange && entry.rankDelta !== 0 && (
              <span className={cn(
                'absolute -top-1.5 -right-1.5 flex items-center text-[10px] font-bold rounded-full px-1',
                entry.rankDelta > 0
                  ? 'text-green-400 bg-green-400/10'
                  : 'text-red-400 bg-red-400/10'
              )}>
                {entry.rankDelta > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
          {entry.avatar_url ? (
            <img
              src={entry.avatar_url}
              alt={entry.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center font-display text-lg tracking-wider border-2 border-border',
              entry.rank <= 3 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
            )}>
              {entry.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-semibold">{entry.name}</span>
            <span className={cn(
              'block text-xs',
              RANK_BADGE[entry.rank] ?? 'text-muted-foreground'
            )}>
              {ordinal(entry.rank)} plass
            </span>
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          {showDelta && entry.pointsDelta !== 0 && (
            <span className={cn(
              'text-sm font-bold animate-fade-up',
              entry.pointsDelta > 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {entry.pointsDelta > 0 ? '+' : ''}{entry.pointsDelta}
            </span>
          )}
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={entry.total_points}
              className="font-display text-2xl tracking-tight"
            />
            <span className="text-xs text-muted-foreground font-medium">
              MM
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  )
}
