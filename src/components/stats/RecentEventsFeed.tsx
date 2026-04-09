import { Trophy, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ACTIVITY_FORMAT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { RecentEvent } from '@/hooks/use-stats'

function relativeTime(isoString: string): string {
  const rtf = new Intl.RelativeTimeFormat('nb', { numeric: 'auto' })
  const diff = new Date(isoString).getTime() - Date.now()
  const seconds = Math.round(diff / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)

  if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second')
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(days, 'day')
}

export function RecentEventsFeed({ events }: { events: RecentEvent[] }) {
  if (events.length === 0) return null

  return (
    <section className="space-y-2 animate-fade-up">
      <div className="flex items-center gap-2 px-1">
        <Trophy className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-sm tracking-widest text-muted-foreground">
          Siste hendelser
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
      </div>
      <div className="space-y-2">
        {events.map((event, i) => {
          const winners = event.standings.filter((s) => s.rank === 1)
          return (
            <div
              key={`${event.activityName}-${i}`}
              className="flex items-start gap-3 pl-3 border-l-2 border-primary/30 py-1.5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{event.activityName}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {ACTIVITY_FORMAT_LABELS[event.activityFormat]}
                  </Badge>
                </div>
                {winners.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex -space-x-1">
                      {winners.slice(0, 3).map((w) =>
                        w.contestant.avatar_url ? (
                          <img
                            key={w.contestant.id}
                            src={w.contestant.avatar_url}
                            alt={w.contestant.name}
                            className="w-5 h-5 rounded-full object-cover border border-background"
                          />
                        ) : (
                          <div
                            key={w.contestant.id}
                            className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-background"
                          >
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                        ),
                      )}
                    </div>
                    <span className={cn('text-xs text-gold font-medium')}>
                      {winners.map((w) => w.contestant.name).join(', ')}
                    </span>
                    {winners[0] && (
                      <span className="text-xs text-muted-foreground">
                        +{winners[0].points} MM
                      </span>
                    )}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                {relativeTime(event.completedAt)}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
