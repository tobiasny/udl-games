import { useLeaderboard } from '@/hooks/use-leaderboard'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const RANK_STYLES: Record<number, string> = {
  1: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  2: 'text-gray-500 bg-gray-50 border-gray-200',
  3: 'text-amber-700 bg-amber-50 border-amber-200',
}

export function LeaderboardPage() {
  const { entries, loading } = useLeaderboard()

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5" />
        <h1 className="text-xl font-bold">Leaderboard</h1>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No points awarded yet. Check back later!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className={cn(
                'transition-all',
                RANK_STYLES[entry.rank] ?? ''
              )}
            >
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold w-8 text-center">
                    {entry.rank}
                  </span>
                  <span className="font-medium">{entry.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">{entry.total_points}</span>
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
