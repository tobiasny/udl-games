import { useState } from 'react'
import { useActivityHistory, type ActivityWithStandings } from '@/hooks/use-activity-history'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ACTIVITY_TYPE_LABELS, ACTIVITY_FORMAT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Radio, Trophy, History, User, Hourglass, ChevronDown, Sparkles } from 'lucide-react'
import type { ActivityFormat } from '@/lib/types'

export function ActivityHistoryPage() {
  const { completed, currents, loading } = useActivityHistory()

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

      {/* Current activities — may be several in parallel */}
      {currents.length > 0 && (
        <section className="space-y-3 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center gap-2 px-1">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            <h2 className="font-display text-sm tracking-widest text-primary">
              {currents.length === 1 ? 'Pågår nå' : `Pågår nå (${currents.length})`}
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/40 to-transparent" />
          </div>
          <div className="space-y-3">
            {currents.map((c) => (
              <CurrentActivityCard key={c.activity.id} data={c} />
            ))}
          </div>
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
              Ingen fullførte aktiviteter ennå.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {completed.map((item, i) =>
              item.activity.format === 'event' ? (
                <EventCard key={item.activity.id} data={item} index={i} />
              ) : (
                <CompletedActivityCard key={item.activity.id} data={item} index={i} />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function CurrentActivityCard({ data }: { data: ActivityWithStandings }) {
  const { activity, progress } = data
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
        <ProgressInfo
          format={activity.format}
          completedMatches={progress?.completedMatches ?? 0}
          totalMatches={progress?.totalMatches ?? 0}
          participantCount={progress?.participantCount ?? 0}
        />
      </CardContent>
    </Card>
  )
}

// Match-based formats use "kamper", round-based formats use "runder", and
// free-for-all has no matches at all -- show a generic in-progress hint.
function ProgressInfo({
  format,
  completedMatches,
  totalMatches,
  participantCount,
}: {
  format: ActivityFormat
  completedMatches: number
  totalMatches: number
  participantCount: number
}) {
  if (format === 'free_for_all') {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
        <Hourglass className="h-4 w-4 text-primary animate-pulse" />
        <span>
          Rangering pågår - {participantCount} deltaker{participantCount === 1 ? '' : 'e'}
        </span>
      </div>
    )
  }

  if (totalMatches === 0) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
        <Hourglass className="h-4 w-4 text-primary animate-pulse" />
        <span>Venter på at kamper genereres...</span>
      </div>
    )
  }

  const remaining = Math.max(0, totalMatches - completedMatches)
  const unitLabel =
    format === 'multi_team_battle' || format === 'team_battle' ? 'runder' : 'kamper'
  const unitLabelSingularDone =
    format === 'multi_team_battle' || format === 'team_battle' ? 'runde' : 'kamp'
  const pct = totalMatches === 0 ? 0 : Math.round((completedMatches / totalMatches) * 100)

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center gap-3 text-sm">
        <Hourglass className="h-4 w-4 text-primary animate-pulse shrink-0" />
        <span className="font-display tracking-wider text-primary text-base">
          {completedMatches} / {totalMatches}
        </span>
        <span className="text-muted-foreground">
          {completedMatches === 1 ? unitLabelSingularDone : unitLabel} ferdig
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {remaining === 0
          ? 'Alle kamper spilt - venter på fullføring'
          : `${remaining} ${remaining === 1 ? unitLabelSingularDone : unitLabel} igjen`}
      </div>
    </div>
  )
}

// Events are point-award entries -- not collapsible. The activity name is
// the event title, and there's typically a single recipient. We render each
// recipient on its own row with their name and the points awarded, dropping
// rank/badges/winner labels because they'd just duplicate the title.
function EventCard({ data, index }: { data: ActivityWithStandings; index: number }) {
  const { activity, standings } = data
  return (
    <Card style={{ animationDelay: `${index * 60}ms` }}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <CardTitle className="font-display text-lg tracking-wider">
            {activity.name}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {standings.map((row) => (
            <div
              key={row.contestant.id}
              className="flex items-center justify-between gap-3 px-2 py-1.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                {row.contestant.avatar_url ? (
                  <img
                    src={row.contestant.avatar_url}
                    alt={row.contestant.name}
                    className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="font-medium text-sm truncate">{row.contestant.name}</span>
              </div>
              <div className="text-right shrink-0">
                <span className={cn(
                  'font-display tracking-wider text-base',
                  row.points >= 0 ? 'text-primary' : 'text-destructive',
                )}>
                  {row.points > 0 ? '+' : ''}{row.points}
                </span>
                <span className="text-xs text-muted-foreground ml-1">MM</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function CompletedActivityCard({ data, index }: { data: ActivityWithStandings; index: number }) {
  const { activity, standings } = data
  // Team formats award the same point total to every member of the winning
  // team, so "winner" is everyone tied at rank 1 -- not just standings[0].
  const winners = standings.filter((s) => s.rank === 1)
  const [expanded, setExpanded] = useState(false)

  return (
    <Card style={{ animationDelay: `${index * 60}ms` }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full text-left"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="font-display text-lg tracking-wider">
              {activity.name}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
              <Badge variant="outline" className="text-xs">{ACTIVITY_FORMAT_LABELS[activity.format]}</Badge>
              <ChevronDown
                className={cn(
                  'h-4 w-4 ml-1 text-muted-foreground transition-transform',
                  expanded && 'rotate-180'
                )}
              />
            </div>
          </div>
          {winners.length > 0 && (
            <div className="flex items-start gap-2 text-sm pt-1">
              <Trophy className="h-4 w-4 text-gold mt-0.5 shrink-0" />
              <span className="text-muted-foreground shrink-0">
                {winners.length === 1 ? 'Vinner:' : 'Vinnere:'}
              </span>
              <span className="font-semibold text-gold">
                {winners.map((w) => w.contestant.name).join(', ')}
              </span>
            </div>
          )}
        </CardHeader>
      </button>
      {expanded && (
        <CardContent>
          <StandingsList standings={standings} compact />
        </CardContent>
      )}
    </Card>
  )
}

function StandingsList({
  standings,
  compact,
}: {
  standings: { contestant: { id: string; name: string; avatar_url: string | null }; points: number; rank: number }[]
  compact?: boolean
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
            <span className={cn('font-display tracking-wider text-primary', compact ? 'text-base' : 'text-xl')}>
              {row.points}
            </span>
            <span className="text-xs text-muted-foreground ml-1">MM</span>
          </div>
        </div>
      ))}
    </div>
  )
}
