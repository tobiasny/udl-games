import { useState, useEffect, useRef } from 'react'
import { useLeaderboard } from '@/hooks/use-leaderboard'
import { useStats } from '@/hooks/use-stats'
import { RaceChart } from '@/components/stats/RaceChart'
import { cn } from '@/lib/utils'
import { Crown, Medal, Award } from 'lucide-react'

const CYCLE_SECONDS = 12
type View = 'leaderboard' | 'race'

const RANK_COLORS: Record<number, string> = {
  1: 'text-gold',
  2: 'text-silver',
  3: 'text-bronze',
}

const RANK_ICON: Record<number, typeof Crown> = {
  1: Crown,
  2: Medal,
  3: Award,
}

export function DisplayPage() {
  const { entries, loading: leaderboardLoading } = useLeaderboard()
  const stats = useStats({ pollInterval: 15000 })
  const [view, setView] = useState<View>('leaderboard')
  const [progress, setProgress] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(500)

  useEffect(() => {
    function measure() {
      if (contentRef.current) setChartHeight(contentRef.current.clientHeight - 80)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Cycle views
  useEffect(() => {
    const start = Date.now()
    const duration = CYCLE_SECONDS * 1000

    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(elapsed / duration, 1)
      setProgress(pct)
      if (pct < 1) {
        requestAnimationFrame(tick)
      }
    }
    const raf = requestAnimationFrame(tick)

    const timer = setTimeout(() => {
      setView((v) => (v === 'leaderboard' ? 'race' : 'leaderboard'))
      setProgress(0)
    }, duration)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [view])

  if (leaderboardLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="font-display text-muted-foreground tracking-widest animate-pulse">Laster...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border">
        <span className="font-display text-2xl tracking-widest">Mats Games</span>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView('leaderboard')}
              className={cn(
                'text-xs font-mono tracking-widest uppercase px-3 py-1 rounded border transition-colors',
                view === 'leaderboard'
                  ? 'border-primary text-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/40',
              )}
            >
              Resultater
            </button>
            <button
              type="button"
              onClick={() => setView('race')}
              className={cn(
                'text-xs font-mono tracking-widest uppercase px-3 py-1 rounded border transition-colors',
                view === 'race'
                  ? 'border-primary text-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/40',
              )}
            >
              Løp
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono tracking-widest text-primary uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-hidden px-8 py-6">
        {view === 'leaderboard' && (
          <div className="h-full flex flex-col justify-center space-y-3 max-w-2xl mx-auto">
            {entries.map((entry) => {
              const RankIcon = RANK_ICON[entry.rank]
              const rankColor = RANK_COLORS[entry.rank] ?? 'text-muted-foreground'
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center gap-6 px-6 py-4 rounded-2xl border',
                    entry.rank === 1
                      ? 'border-gold/40 bg-gold/5'
                      : entry.rank === 2
                        ? 'border-silver/30 bg-silver/5'
                        : entry.rank === 3
                          ? 'border-bronze/30 bg-bronze/5'
                          : 'border-border bg-card',
                  )}
                >
                  <div className={cn('w-10 shrink-0 flex justify-center', rankColor)}>
                    {RankIcon ? (
                      <RankIcon className="h-7 w-7" />
                    ) : (
                      <span className="font-display text-3xl">{entry.rank}</span>
                    )}
                  </div>
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-border shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-display text-xl shrink-0">
                      {entry.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 font-display text-3xl tracking-wider">{entry.name}</span>
                  <div className="text-right shrink-0">
                    <span className={cn('font-display text-4xl tracking-tight', rankColor)}>
                      {entry.total_points}
                    </span>
                    <span className="text-lg text-muted-foreground ml-2">MM</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'race' && (
          <div className="h-full flex flex-col">
            <h2 className="font-display text-2xl tracking-wider text-center mb-4 text-muted-foreground shrink-0">
              Poengutvikling
            </h2>
            <RaceChart stats={stats} height={chartHeight} fontSize={13} strokeWidth={3} inlineLabels />
          </div>
        )}
      </div>

      {/* Cycle progress bar */}
      <div className="h-0.5 bg-border">
        <div
          className="h-full bg-primary/50 transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}
