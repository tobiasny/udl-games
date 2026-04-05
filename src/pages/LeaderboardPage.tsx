import { useLeaderboard } from '@/hooks/use-leaderboard'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const RANK_STYLES: Record<number, string> = {
  1: 'border-gold/50 bg-gold/10',
  2: 'border-silver/40 bg-silver/5',
  3: 'border-bronze/40 bg-bronze/5',
}

const RANK_BADGE: Record<number, string> = {
  1: 'text-gold',
  2: 'text-silver',
  3: 'text-bronze',
}

export function LeaderboardPage() {
  const { entries, loading } = useLeaderboard()

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="text-center pt-4 pb-2">
        <h1 className="text-3xl font-black tracking-tight text-primary">
          Mats Games
        </h1>
        <p className="text-sm text-muted-foreground mt-1 italic">
          Mats drekkes ut
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No points awarded yet. Let the games begin!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className={cn(
                'transition-all',
                RANK_STYLES[entry.rank] ?? 'border-border'
              )}
            >
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-lg font-black w-8 text-center',
                      RANK_BADGE[entry.rank] ?? 'text-muted-foreground'
                    )}
                  >
                    {entry.rank === 1 ? '1st' : entry.rank === 2 ? '2nd' : entry.rank === 3 ? '3rd' : `${entry.rank}th`}
                  </span>
                  <span className="font-semibold">{entry.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary">{entry.total_points}</span>
                  <span className="text-xs text-muted-foreground ml-1">MM</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
