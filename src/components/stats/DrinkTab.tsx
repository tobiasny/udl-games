import { User } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DrinkCount, DrinkLogEntry } from '@/hooks/use-drinks'

// Must use hardcoded hex — CSS vars don't resolve on SVG attributes
const DRINK_COLORS = [
  '#c9a227',
  '#10b981',
  '#e34c26',
  '#a855f7',
  '#06b6d4',
  '#f472b6',
  '#f59e0b',
  '#3b82f6',
]

interface HourlyBucket {
  label: string
  [contestantId: string]: number | string
}

function buildHourlyData(logs: DrinkLogEntry[]): HourlyBucket[] {
  const buckets: Record<number, Record<string, number>> = {}

  for (const log of logs) {
    const hour = new Date(log.created_at).getHours()
    if (!buckets[hour]) buckets[hour] = {}
    buckets[hour][log.contestant_id] = (buckets[hour][log.contestant_id] ?? 0) + 1
  }

  const hours = Object.keys(buckets).map(Number).sort((a, b) => a - b)

  return hours.map((hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    ...buckets[hour],
  }))
}

interface DrinkTabProps {
  drinks: { drinkCounts: DrinkCount[]; drinkLogs: DrinkLogEntry[]; loading: boolean }
}

export function DrinkTab({ drinks }: DrinkTabProps) {
  if (drinks.loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  const sorted = drinks.drinkCounts.filter((d) => d.total > 0).sort((a, b) => b.total - a.total)
  const activeContestants = sorted.map((d) => d.contestant)

  const fridayTotal = drinks.drinkCounts.reduce((s, d) => s + d.friday, 0)
  const saturdayTotal = drinks.drinkCounts.reduce((s, d) => s + d.saturday, 0)

  const hourlyData = buildHourlyData(drinks.drinkLogs)

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Ingen drikker registrert ennå. 🍺
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Day totals */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <div className="font-display text-2xl tracking-wider">{fridayTotal}</div>
            <div className="text-xs text-muted-foreground">Fredag totalt</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <div className="font-display text-2xl tracking-wider">{saturdayTotal}</div>
            <div className="text-xs text-muted-foreground">Lørdag totalt</div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly histogram */}
      {hourlyData.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-2 px-2">
            <div className="text-xs text-muted-foreground mb-3 px-2">Drikker per time</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#888' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#888' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20,20,30,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) => {
                    const c = activeContestants.find((c) => c.id === value)
                    return c?.name ?? value
                  }}
                />
                {activeContestants.map((c, i) => (
                  <Bar
                    key={c.id}
                    dataKey={c.id}
                    name={c.id}
                    stackId="drinks"
                    fill={DRINK_COLORS[i % DRINK_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-player list */}
      {sorted.map((d, i) => (
        <Card key={d.contestant.id}>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <span className="w-6 text-center font-display text-sm text-muted-foreground shrink-0">
              {i + 1}
            </span>
            {d.contestant.avatar_url ? (
              <img
                src={d.contestant.avatar_url}
                alt={d.contestant.name}
                className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <span className="flex-1 font-medium">{d.contestant.name}</span>
            <div className="flex items-center gap-3 text-sm">
              <div className="text-center">
                <div className={cn('font-display', d.friday > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                  {d.friday}
                </div>
                <div className="text-xs text-muted-foreground">Fre</div>
              </div>
              <div className="text-center">
                <div className={cn('font-display', d.saturday > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                  {d.saturday}
                </div>
                <div className="text-xs text-muted-foreground">Lør</div>
              </div>
              <div className="text-center min-w-8">
                <div className="font-display text-lg text-primary">{d.total}</div>
                <div className="text-xs text-muted-foreground">Tot</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
