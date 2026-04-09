import { useState } from 'react'
import { ChevronDown, Crown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LeaderboardEntryWithDelta } from '@/hooks/use-leaderboard'
import type { ContestantStats } from '@/hooks/use-stats'

export function PredictionBlock({
  entries,
  contestantStats,
}: {
  entries: LeaderboardEntryWithDelta[]
  contestantStats: ContestantStats[]
}) {
  const [expanded, setExpanded] = useState(false)

  if (entries.length < 2) return null

  const leader = entries[0]
  const statsMap = new Map(contestantStats.map((cs) => [cs.contestant.id, cs]))

  return (
    <section className="animate-fade-up">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 px-1 w-full group"
      >
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-sm tracking-widest text-muted-foreground">
          Hvem kan ta ledelsen?
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <Card className="mt-2">
          <CardContent className="py-3 px-4 divide-y divide-border">
            {entries.map((entry) => {
              const cs = statsMap.get(entry.id)
              const isLeader = entry.rank === 1
              const gap = leader.total_points - entry.total_points

              if (isLeader) {
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1">
                    <Crown className="h-4 w-4 text-gold shrink-0" />
                    <span className="font-medium text-sm flex-1">{entry.name}</span>
                    <span className="text-xs text-gold font-medium">Leder</span>
                  </div>
                )
              }

              const avg = cs?.avgPoints ?? 0
              const prediction =
                avg > 0 ? `~${Math.ceil(gap / avg)} aktiviteter` : 'Ikke nok data'

              return (
                <div key={entry.id} className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1">
                  <span className="font-display text-sm text-muted-foreground w-4 text-center shrink-0">
                    {entry.rank}
                  </span>
                  <span className="font-medium text-sm flex-1">{entry.name}</span>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{gap} MM bak</div>
                    <div className="text-xs text-primary font-medium">{prediction}</div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
