import { Trophy, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ACTIVITY_FORMAT_LABELS } from '@/lib/constants'
import type { RecentEvent } from '@/hooks/use-stats'

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dayLabel(isoString: string): string {
  const date = new Date(isoString)
  // Use day of week in Norwegian
  return date.toLocaleDateString('nb-NO', { weekday: 'long' })
}

function durationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

export function TimelineTab({ events }: { events: RecentEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Ingen fullførte aktiviteter ennå.
        </CardContent>
      </Card>
    )
  }

  // Show all events in chronological order (oldest first)
  const sorted = events.slice().sort((a, b) => a.completedAt.localeCompare(b.completedAt))

  // Group by day
  const dayGroups: { day: string; events: RecentEvent[] }[] = []
  for (const event of sorted) {
    const day = dayLabel(event.completedAt)
    const last = dayGroups[dayGroups.length - 1]
    if (last?.day === day) {
      last.events.push(event)
    } else {
      dayGroups.push({ day, events: [event] })
    }
  }

  return (
    <div className="space-y-6">
      {dayGroups.map(({ day, events: dayEvents }) => (
        <div key={day} className="space-y-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest capitalize">
              {day}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="relative pl-6 space-y-0">
            {/* Vertical line */}
            <div className="absolute left-2 top-2 bottom-2 w-px bg-primary/20" />

            {dayEvents.map((event, i) => {
              const winners = event.standings.filter((s) => s.rank === 1)
              const mins = durationMinutes(event.createdAt, event.completedAt)
              const showDuration = mins >= 2 && mins <= 240

              return (
                <div key={`${event.activityName}-${i}`} className="relative pb-4 last:pb-0">
                  {/* Timeline dot */}
                  <div className="absolute -left-4 top-3 w-2 h-2 rounded-full bg-primary/60 border border-background" />

                  <Card className="hover:border-border/80 transition-colors">
                    <CardContent className="py-3 px-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{event.activityName}</span>
                          <Badge variant="outline" className="text-xs">
                            {ACTIVITY_FORMAT_LABELS[event.activityFormat]}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 font-mono">
                          {formatTime(event.completedAt)}
                          {showDuration && (
                            <span className="ml-1 opacity-60">~{mins}m</span>
                          )}
                        </span>
                      </div>

                      {winners.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Trophy className="h-3.5 w-3.5 text-gold shrink-0" />
                          <div className="flex items-center gap-1.5">
                            {winners.slice(0, 3).map((w) =>
                              w.contestant.avatar_url ? (
                                <img
                                  key={w.contestant.id}
                                  src={w.contestant.avatar_url}
                                  alt={w.contestant.name}
                                  className="w-5 h-5 rounded-full object-cover border border-border"
                                />
                              ) : (
                                <div
                                  key={w.contestant.id}
                                  className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center"
                                >
                                  <User className="h-3 w-3 text-muted-foreground" />
                                </div>
                              ),
                            )}
                            <span className="text-xs text-gold font-medium">
                              {winners.map((w) => w.contestant.name).join(', ')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              +{winners[0].points} MM
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
