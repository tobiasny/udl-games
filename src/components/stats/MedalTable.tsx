import { Crown, Medal, Award, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { StatsData } from '@/hooks/use-stats'

export function MedalTable({ stats }: { stats: StatsData }) {
  if (stats.loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  const sorted = stats.contestantStats.slice().sort((a, b) => {
    if (b.podiums.gold !== a.podiums.gold) return b.podiums.gold - a.podiums.gold
    if (b.podiums.silver !== a.podiums.silver) return b.podiums.silver - a.podiums.silver
    return b.podiums.bronze - a.podiums.bronze
  })

  const hasAnyPodium = sorted.some(
    (cs) => cs.podiums.gold + cs.podiums.silver + cs.podiums.bronze > 0,
  )

  if (!hasAnyPodium) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Ingen fullførte aktiviteter ennå.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map((cs, i) => {
        const rank = i + 1
        return (
          <Card
            key={cs.contestant.id}
            className={cn(
              'transition-all',
              rank === 1 && 'neon-border-gold',
              rank === 2 && 'neon-border-silver',
              rank === 3 && 'neon-border-bronze',
            )}
          >
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <span
                className={cn(
                  'w-6 text-center font-display text-sm shrink-0',
                  rank === 1
                    ? 'text-gold'
                    : rank === 2
                      ? 'text-silver'
                      : rank === 3
                        ? 'text-bronze'
                        : 'text-muted-foreground',
                )}
              >
                {rank}
              </span>
              {cs.contestant.avatar_url ? (
                <img
                  src={cs.contestant.avatar_url}
                  alt={cs.contestant.name}
                  className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <span className="flex-1 font-medium">{cs.contestant.name}</span>
              <div className="flex items-center gap-4">
                <MedalCount icon={Crown} count={cs.podiums.gold} color="text-gold" label="Gull" />
                <MedalCount icon={Medal} count={cs.podiums.silver} color="text-silver" label="Sølv" />
                <MedalCount icon={Award} count={cs.podiums.bronze} color="text-bronze" label="Bronse" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function MedalCount({
  icon: Icon,
  count,
  color,
  label,
}: {
  icon: typeof Crown
  count: number
  color: string
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-8" title={label}>
      <Icon className={cn('h-4 w-4', color)} />
      <span className={cn('font-display text-sm', count > 0 ? color : 'text-muted-foreground/40')}>
        {count}
      </span>
    </div>
  )
}
