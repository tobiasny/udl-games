import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLeaderboard, type LeaderboardEntryWithDelta } from '@/hooks/use-leaderboard'
import { useStats } from '@/hooks/use-stats'
import { Card, CardContent } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { RecentEventsFeed } from '@/components/stats/RecentEventsFeed'
import { PredictionBlock } from '@/components/stats/PredictionBlock'
import { cn } from '@/lib/utils'
import { Crown, Medal, Award, TrendingUp, TrendingDown } from 'lucide-react'

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
  const stats = useStats({ pollInterval: 10000 })

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Hero header */}
      <div className="text-center pt-8 pb-2 animate-fade-up">
        <h1 className="font-display text-4xl tracking-tight">
          Mats Games
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Mats drekkes ut
        </p>
      </div>

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

      <PredictionBlock entries={entries} contestantStats={stats.contestantStats} />
      <RecentEventsFeed events={stats.recentEvents} />
    </div>
  )
}

function LeaderboardRow({ entry, index }: { entry: LeaderboardEntryWithDelta; index: number }) {
  const RankIcon = RANK_ICON[entry.rank]
  const [showDelta, setShowDelta] = useState(false)
  const [showRankChange, setShowRankChange] = useState(false)

  // Flash point delta when it changes
  useEffect(() => {
    if (entry.pointsDelta !== 0) {
      setShowDelta(true)
      const timer = setTimeout(() => setShowDelta(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [entry.pointsDelta, entry.total_points])

  // Flash rank change
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
            {/* Rank change indicator */}
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
          {/* Point delta flash */}
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
