import { Trophy, Target, Crown, BarChart2, Zap, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { StatsData } from '@/hooks/use-stats'

export function HighlightsTab({ stats }: { stats: StatsData }) {
  if (stats.loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  const hasData = stats.contestantStats.some((cs) => cs.activitiesPlayed > 0)
  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Ingen fullførte aktiviteter ennå.
        </CardContent>
      </Card>
    )
  }

  // Biggest single win
  let biggestWin: { name: string; activity: string; points: number } | null = null
  for (const cs of stats.contestantStats) {
    if (cs.bestActivity && (!biggestWin || cs.bestActivity.points > biggestWin.points)) {
      biggestWin = {
        name: cs.contestant.name,
        activity: cs.bestActivity.activity.name,
        points: cs.bestActivity.points,
      }
    }
  }

  // Most consistent (lowest stdDev, min 2 activities)
  const consistentCandidates = stats.contestantStats.filter((cs) => cs.activitiesPlayed >= 2)
  const mostConsistent = consistentCandidates.length > 0
    ? consistentCandidates.reduce((best, cs) => cs.stdDev < best.stdDev ? cs : best)
    : null

  // Most wins
  const mostWins = stats.contestantStats.length > 0
    ? stats.contestantStats.reduce((best, cs) => cs.wins > best.wins ? cs : best)
    : null

  // Total MM awarded
  const totalMM = stats.contestantStats.reduce(
    (sum, cs) => sum + cs.activityBreakdown.reduce((s, b) => s + b.points, 0),
    0,
  )

  // Most active
  const mostActive = stats.contestantStats.length > 0
    ? stats.contestantStats.reduce((best, cs) => cs.activitiesPlayed > best.activitiesPlayed ? cs : best)
    : null

  // Most played activity (by participant count across raceData)
  const activityParticipants: Record<string, { name: string; count: number }> = {}
  for (const cs of stats.contestantStats) {
    for (const b of cs.activityBreakdown) {
      if (!activityParticipants[b.activity.id]) {
        activityParticipants[b.activity.id] = { name: b.activity.name, count: 0 }
      }
      activityParticipants[b.activity.id].count++
    }
  }
  const mostPlayed = Object.values(activityParticipants).reduce<{ name: string; count: number } | null>(
    (best, a) => (!best || a.count > best.count ? a : best),
    null,
  )

  const highlights = [
    biggestWin && {
      icon: Trophy,
      label: 'Største enkeltseier',
      value: `${biggestWin.points} MM`,
      sub: `${biggestWin.name} — ${biggestWin.activity}`,
      color: 'text-gold',
    },
    mostWins && mostWins.wins > 0 && {
      icon: Crown,
      label: 'Flest seire',
      value: `${mostWins.wins} seire`,
      sub: mostWins.contestant.name,
      color: 'text-primary',
    },
    mostConsistent && {
      icon: Target,
      label: 'Mest konsistent',
      value: `±${mostConsistent.stdDev.toFixed(1)} MM`,
      sub: `${mostConsistent.contestant.name} (snitt ${mostConsistent.avgPoints.toFixed(1)} MM)`,
      color: 'text-green-400',
    },
    mostActive && {
      icon: Zap,
      label: 'Mest aktiv',
      value: `${mostActive.activitiesPlayed} aktiviteter`,
      sub: mostActive.contestant.name,
      color: 'text-yellow-400',
    },
    mostPlayed && {
      icon: Users,
      label: 'Mest spillte aktivitet',
      value: `${mostPlayed.count} spillere`,
      sub: mostPlayed.name,
      color: 'text-purple-400',
    },
    {
      icon: BarChart2,
      label: 'Totalt delt ut',
      value: `${totalMM} MM`,
      sub: `fordelt på ${stats.raceData.length} aktiviteter`,
      color: 'text-muted-foreground',
    },
  ].filter(Boolean) as { icon: typeof Trophy; label: string; value: string; sub: string; color: string }[]

  return (
    <div className="space-y-3">
      {highlights.map(({ icon: Icon, label, value, sub, color }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-4 py-4 px-4">
            <div className={`shrink-0 ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`font-display text-xl tracking-wider ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground truncate">{sub}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
