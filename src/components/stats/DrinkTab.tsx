import { User } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
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
  key: string
  label: string
  [contestantId: string]: number | string
}

function toHourKey(d: Date): string {
  return (
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}`
  )
}

function keyToLabel(key: string): string {
  const [datePart, hourPart] = key.split('T')
  const d = new Date(`${datePart}T${hourPart}:00:00`)
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) + ' ' + hourPart + ':00'
}

function buildHourlyData(logs: DrinkLogEntry[]): HourlyBucket[] {
  if (logs.length === 0) return []

  // Aggregate drinks per hour bucket
  const buckets: Record<string, Record<string, number>> = {}
  for (const log of logs) {
    const key = toHourKey(new Date(log.created_at))
    if (!buckets[key]) buckets[key] = {}
    buckets[key][log.contestant_id] = (buckets[key][log.contestant_id] ?? 0) + 1
  }

  // Fill all hours between first and last drink (including empty ones)
  const times = logs.map((l) => new Date(l.created_at).getTime())
  const start = new Date(Math.min(...times))
  start.setMinutes(0, 0, 0)
  const end = new Date(Math.max(...times))
  end.setMinutes(0, 0, 0)

  const result: HourlyBucket[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const key = toHourKey(cur)
    result.push({ key, label: keyToLabel(key), ...(buckets[key] ?? {}) })
    cur.setHours(cur.getHours() + 1)
  }
  return result
}

interface DrinkTabProps {
  drinks: { drinkCounts: DrinkCount[]; drinkLogs: DrinkLogEntry[]; loading: boolean }
}

export function DrinkTab({ drinks }: DrinkTabProps) {
  if (drinks.loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  const sorted = drinks.drinkCounts.filter((d) => d.total > 0).sort((a, b) => b.total - a.total)
  const grandTotal = sorted.reduce((s, d) => s + d.total, 0)
  const activeContestants = sorted.map((d) => d.contestant)
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
      {/* Grand total */}
      <Card>
        <CardContent className="py-3 px-4 text-center">
          <div className="font-display text-3xl tracking-wider text-primary">{grandTotal}</div>
          <div className="text-xs text-muted-foreground">Totalt</div>
        </CardContent>
      </Card>

      {/* Hourly histogram over time — horizontally scrollable */}
      {hourlyData.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-2 px-2">
            <div className="text-xs text-muted-foreground mb-3 px-2">Drikker per time</div>
            <div className="overflow-x-auto">
              <div style={{ width: Math.max(hourlyData.length * 44, 300) }}>
                <BarChart
                  width={Math.max(hourlyData.length * 44, 300)}
                  height={220}
                  data={hourlyData}
                  margin={{ top: 0, right: 8, left: -20, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: '#888' }}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
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
                    formatter={(value, name) => {
                      const c = activeContestants.find((c) => c.id === name)
                      return [value, c?.name ?? name]
                    }}
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-player totals */}
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
            <div className="font-display text-xl text-primary">{d.total}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
