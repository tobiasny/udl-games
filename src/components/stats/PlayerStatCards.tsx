import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { StatsData } from '@/hooks/use-stats'

export function PlayerStatCards({ stats }: { stats: StatsData }) {
  if (stats.loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  if (stats.contestantStats.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Ingen deltakere ennå.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {stats.contestantStats.map((cs) => (
        <Link key={cs.contestant.id} to={`/players/${cs.contestant.id}`}>
          <Card className="hover:border-primary/40 transition-colors cursor-pointer">
            <CardContent className="py-3 px-4 space-y-3">
              {/* Header row */}
              <div className="flex items-center gap-3">
                {cs.contestant.avatar_url ? (
                  <img
                    src={cs.contestant.avatar_url}
                    alt={cs.contestant.name}
                    className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <div className="font-semibold">{cs.contestant.name}</div>
                  {cs.bestActivity && (
                    <div className="text-xs text-muted-foreground">
                      Beste: {cs.bestActivity.activity.name} ({cs.bestActivity.points} MM)
                    </div>
                  )}
                </div>
              </div>
              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
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
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className={cn('font-display text-lg tracking-wider')}>{value}</div>
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
    </div>
  )
}
