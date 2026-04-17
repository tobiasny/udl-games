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

// Resolved hex/oklch colors for SVG text (CSS variables don't work on SVG fill)
const CHART_COLORS_RESOLVED = [
  '#c9a227', // gold-ish
  '#10b981', // green
  '#e34c26', // orange-red
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#f472b6', // pink
  '#f59e0b', // amber
  '#3b82f6', // blue
]

interface RaceChartProps {
  stats: StatsData
  height?: number | `${number}%`
  fontSize?: number
  strokeWidth?: number
  inlineLabels?: boolean
}

export function RaceChart({
  stats,
  height = 300,
  fontSize = 10,
  strokeWidth = 2,
  inlineLabels = false,
}: RaceChartProps) {
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

  const chartData = stats.raceData.map((point) => ({
    name: point.activityName,
    ...Object.fromEntries(
      activeContestantIds.map((id) => [id, point.cumulative[id] ?? 0]),
    ),
  }))

  const lastIndex = chartData.length - 1

  // Right margin needs room for inline labels; estimate ~9px per char + padding
  const maxNameLen = inlineLabels
    ? Math.max(...activeContestantIds.map((id) => (contestantMap.get(id)?.name ?? '').length))
    : 0
  const rightMargin = inlineLabels ? maxNameLen * (fontSize * 0.65) + 12 : 8

  return (
    <div className={inlineLabels ? undefined : 'space-y-2'}>
      {!inlineLabels && (
        <p className="text-xs text-muted-foreground px-1">
          Akkumulerte poeng etter hver aktivitet
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 8, right: rightMargin, left: -16, bottom: 40 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--color-muted-foreground)', fontSize }}
            angle={-40}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis
            tick={{ fill: 'var(--color-muted-foreground)', fontSize }}
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
          {!inlineLabels && (
            <Legend
              formatter={(id) => contestantMap.get(id)?.name ?? id}
              wrapperStyle={{ fontSize: fontSize + 2, paddingTop: '8px' }}
            />
          )}
          {activeContestantIds.map((id, i) => {
            const color = inlineLabels
              ? CHART_COLORS_RESOLVED[i % CHART_COLORS_RESOLVED.length]
              : CHART_COLORS[i % CHART_COLORS.length]
            const colorResolved = CHART_COLORS_RESOLVED[i % CHART_COLORS_RESOLVED.length]
            const name = contestantMap.get(id)?.name ?? id
            const r = strokeWidth + 1
            return (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={color}
                strokeWidth={strokeWidth}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                dot={(props: any) => {
                  const { cx, cy, index } = props
                  if (inlineLabels && index === lastIndex) {
                    return (
                      <g key={`dot-${id}-${index}`}>
                        <circle cx={cx} cy={cy} r={r} fill={colorResolved} />
                        <text
                          x={cx + r + 4}
                          y={cy}
                          fill={colorResolved}
                          fontSize={fontSize}
                          fontWeight="600"
                          dominantBaseline="middle"
                        >
                          {name}
                        </text>
                      </g>
                    )
                  }
                  return <circle key={`dot-${id}-${index}`} cx={cx} cy={cy} r={r} fill={colorResolved} />
                }}
                activeDot={{ r: strokeWidth + 3, fill: colorResolved }}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
