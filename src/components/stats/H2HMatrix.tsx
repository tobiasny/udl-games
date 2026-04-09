import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { StatsData } from '@/hooks/use-stats'

export function H2HMatrix({ stats }: { stats: StatsData }) {
  if (stats.loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  const { h2h, contestants } = stats
  const ids = h2h.orderedIds.filter((id) => contestants.find((c) => c.id === id))

  const hasData = ids.some((a) =>
    ids.some((b) => a !== b && ((h2h.wins[a]?.[b] ?? 0) + (h2h.wins[b]?.[a] ?? 0)) > 0),
  )

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Ingen H2H-data ennå. Spill noen 1v1 eller 2v2 aktiviteter først.
        </CardContent>
      </Card>
    )
  }

  const contestantMap = new Map(contestants.map((c) => [c.id, c]))

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-1">
        Rad-spiller vant mot kolonne-spiller X ganger.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {/* top-left empty cell */}
              <th className="p-2 bg-card" />
              {ids.map((colId) => {
                const c = contestantMap.get(colId)
                return (
                  <th key={colId} className="p-2 bg-card text-center font-medium">
                    <div className="flex flex-col items-center gap-1">
                      {c?.avatar_url ? (
                        <img
                          src={c.avatar_url}
                          alt={c.name}
                          className="w-6 h-6 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {c?.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="hidden sm:block text-xs text-muted-foreground max-w-12 truncate">
                        {c?.name.split(' ')[0]}
                      </span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ids.map((rowId) => {
              const rowC = contestantMap.get(rowId)
              return (
                <tr key={rowId} className="border-t border-border">
                  <td className="p-2 bg-card font-medium whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {rowC?.avatar_url ? (
                        <img
                          src={rowC.avatar_url}
                          alt={rowC.name}
                          className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                          {rowC?.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm">{rowC?.name.split(' ')[0]}</span>
                    </div>
                  </td>
                  {ids.map((colId) => {
                    if (rowId === colId) {
                      return (
                        <td key={colId} className="p-2 text-center bg-secondary/30">
                          <span className="text-muted-foreground/30">—</span>
                        </td>
                      )
                    }
                    const wins = h2h.wins[rowId]?.[colId] ?? 0
                    const losses = h2h.wins[colId]?.[rowId] ?? 0
                    const total = wins + losses
                    return (
                      <td
                        key={colId}
                        className={cn(
                          'p-2 text-center font-display text-base tracking-wider',
                          total === 0
                            ? 'text-muted-foreground/30'
                            : wins > losses
                              ? 'text-green-400 bg-green-400/5'
                              : wins < losses
                                ? 'text-red-400 bg-red-400/5'
                                : 'text-yellow-400 bg-yellow-400/5',
                        )}
                      >
                        {total === 0 ? '·' : wins}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
