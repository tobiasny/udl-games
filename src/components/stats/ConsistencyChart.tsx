import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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

export function ConsistencyChart({ stats }: { stats: StatsData }) {
  if (stats.loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  const eligible = stats.contestantStats.filter((cs) => cs.activitiesPlayed >= 2)

  // Fall back to card layout if not enough data for a meaningful scatter
  if (eligible.length < 3) {
    return <ConsistencyCards stats={stats} />
  }

  const scatterData = eligible.map((cs, i) => ({
    x: Math.round(cs.avgPoints * 10) / 10,
    y: Math.round(cs.stdDev * 10) / 10,
    name: cs.contestant.name,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const avgX = scatterData.reduce((s, d) => s + d.x, 0) / scatterData.length
  const avgY = scatterData.reduce((s, d) => s + d.y, 0) / scatterData.length

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-1">
        Høy snitt + lav variasjon = konsistent topper. Høyre = bedre snitt. Ned = mer stabil.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 8, right: 24, left: -16, bottom: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />
          <XAxis
            type="number"
            dataKey="x"
            name="Snitt MM"
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            label={{ value: 'Snitt MM', position: 'insideBottom', offset: -4, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Variasjon"
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            label={{ value: 'Variasjon', angle: -90, position: 'insideLeft', offset: 16, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: 'var(--color-border)' }}
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
            formatter={(value, key) => [
              `${value ?? 0}`,
              key === 'x' ? 'Snitt MM' : 'Variasjon',
            ]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
          />
          <ReferenceLine x={avgX} stroke="var(--color-border)" strokeDasharray="4 2" />
          <ReferenceLine y={avgY} stroke="var(--color-border)" strokeDasharray="4 2" />
          <Scatter data={scatterData}>
            {scatterData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-2 px-1">
        {scatterData.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConsistencyCards({ stats }: { stats: StatsData }) {
  if (stats.contestantStats.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Trenger minst 2 fullførte aktiviteter per spiller for å vise statistikk.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-1">
        Trenger minst 3 spillere med 2+ aktiviteter for spredningsdiagram.
      </p>
      {stats.contestantStats
        .filter((cs) => cs.activitiesPlayed > 0)
        .map((cs) => (
          <Card key={cs.contestant.id}>
            <CardContent className="flex items-center justify-between py-3 px-4">
              <span className="font-medium">{cs.contestant.name}</span>
              <div className="flex gap-4 text-right text-sm">
                <div>
                  <div className={cn('font-display tracking-wider')}>
                    {cs.avgPoints.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Snitt MM</div>
                </div>
                <div>
                  <div className={cn('font-display tracking-wider')}>
                    {cs.stdDev.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Variasjon</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}
