import { useActivityHistory, type ActivityWithStandings } from '@/hooks/use-activity-history'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { ACTIVITY_TYPE_LABELS, ACTIVITY_FORMAT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Radio, Trophy, History, User } from 'lucide-react'

export function ActivityHistoryPage() {
  const { completed, current, loading } = useActivityHistory()

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pt-4 pb-2 animate-fade-up">
        <h1 className="font-display text-4xl text-primary tracking-wider text-glow">
          Aktiviteter
        </h1>
        <p className="text-sm text-muted-foreground mt-1 italic">
          Live og historikk
        </p>
      </div>

      {/* Current activity */}
      {current && (
        <section className="space-y-3 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center gap-2 px-1">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            <h2 className="font-display text-sm tracking-widest text-primary">Pagar na</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/40 to-transparent" />
          </div>
          <CurrentActivityCard data={current} />
        </section>
      )}

      {/* Completed activities */}
      <section className="space-y-3 animate-fade-up" style={{ animationDelay: '160ms' }}>
        <div className="flex items-center gap-2 px-1">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">Historikk</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
        </div>
        {completed.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Ingen fullforte aktiviteter enna.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {completed.map((item, i) => (
              <CompletedActivityCard key={item.activity.id} data={item} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function CurrentActivityCard({ data }: { data: ActivityWithStandings }) {
  const { activity, standings } = data
  return (
    <Card className="neon-border animate-pulse-glow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-display text-xl tracking-wider text-primary">
            {activity.name}
          </CardTitle>
          <div className="flex gap-1">
            <Badge variant="secondary" className="text-xs">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
            <Badge variant="outline" className="text-xs">{ACTIVITY_FORMAT_LABELS[activity.format]}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {standings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Venter pa deltakere...
          </p>
        ) : (
          <StandingsList standings={standings} compact={false} live />
        )}
      </CardContent>
    </Card>
  )
}

function CompletedActivityCard({ data, index }: { data: ActivityWithStandings; index: number }) {
  const { activity, standings } = data
  const winner = standings[0]

  return (
    <Card style={{ animationDelay: `${index * 60}ms` }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-display text-lg tracking-wider">
            {activity.name}
          </CardTitle>
          <div className="flex gap-1">
            <Badge variant="secondary" className="text-xs">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
            <Badge variant="outline" className="text-xs">{ACTIVITY_FORMAT_LABELS[activity.format]}</Badge>
          </div>
        </div>
        {winner && (
          <div className="flex items-center gap-2 text-sm pt-1">
            <Trophy className="h-4 w-4 text-gold" />
            <span className="text-muted-foreground">Vinner:</span>
            <span className="font-semibold text-gold">{winner.contestant.name}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <StandingsList standings={standings} compact />
      </CardContent>
    </Card>
  )
}

function StandingsList({
  standings,
  compact,
  live,
}: {
  standings: { contestant: { id: string; name: string; avatar_url: string | null }; points: number; rank: number }[]
  compact?: boolean
  live?: boolean
}) {
  return (
    <div className={cn('space-y-1.5', compact && 'space-y-1')}>
      {standings.map((row) => (
        <div
          key={row.contestant.id}
          className={cn(
            'flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors',
            row.rank === 1 && 'bg-gold/5'
          )}
        >
          <span className={cn(
            'font-display text-sm w-6 text-center tracking-wider',
            row.rank === 1 ? 'text-gold' : row.rank === 2 ? 'text-silver' : row.rank === 3 ? 'text-bronze' : 'text-muted-foreground'
          )}>
            {row.rank}
          </span>
          {row.contestant.avatar_url ? (
            <img
              src={row.contestant.avatar_url}
              alt={row.contestant.name}
              className={cn('rounded-full object-cover border border-border', compact ? 'w-6 h-6' : 'w-7 h-7')}
            />
          ) : (
            <div className={cn(
              'rounded-full bg-secondary flex items-center justify-center',
              compact ? 'w-6 h-6' : 'w-7 h-7'
            )}>
              <User className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
          <span className={cn('flex-1 font-medium', compact ? 'text-sm' : 'text-base')}>
            {row.contestant.name}
          </span>
          <div className="text-right">
            {live ? (
              <AnimatedNumber
                value={row.points}
                className={cn('font-display tracking-wider text-primary', compact ? 'text-base' : 'text-xl')}
              />
            ) : (
              <span className={cn('font-display tracking-wider text-primary', compact ? 'text-base' : 'text-xl')}>
                {row.points}
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-1">MM</span>
          </div>
        </div>
      ))}
    </div>
  )
}
