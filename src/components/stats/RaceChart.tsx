import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import type { StatsData } from '@/hooks/use-stats'

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
]

export function RaceChart({ stats }: { stats: StatsData }) {
  if (stats.loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  if (stats.raceData.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Ingen fullførte aktiviteter ennå — løpet har ikke startet.
        </CardContent>
      </Card>
    )
  }

  // Only show contestants who have earned any points
  const activeContestantIds = stats.contestants
    .filter((c) => {
      const last = stats.raceData[stats.raceData.length - 1]
      return last && (last.cumulative[c.id] ?? 0) > 0
    })
    .map((c) => c.id)

  const contestantMap = new Map(stats.contestants.map((c) => [c.id, c]))

  // Shape data for recharts: array of { activityName, [contestant_id]: cumulative }
  const chartData = stats.raceData.map((point) => ({
    name: point.activityName,
    ...Object.fromEntries(
      activeContestantIds.map((id) => [id, point.cumulative[id] ?? 0]),
    ),
  }))

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">
        Akkumulerte poeng etter hver aktivitet
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            angle={-40}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            unit=" MM"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'var(--color-foreground)', marginBottom: 4 }}
            itemStyle={{ color: 'var(--color-muted-foreground)' }}
            formatter={(value, id) => [
              `${value ?? 0} MM`,
              contestantMap.get(String(id))?.name ?? String(id),
            ]}
          />
          <Legend
            formatter={(id) => contestantMap.get(id)?.name ?? id}
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />
          {activeContestantIds.map((id, i) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
