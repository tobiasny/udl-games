import { useState } from 'react'
import { TrendingUp, Users, ArrowLeftRight, Medal, Target, Sparkles, Clock, Beer } from 'lucide-react'
import { useStats } from '@/hooks/use-stats'
import { useDrinks } from '@/hooks/use-drinks'
import { cn } from '@/lib/utils'
import { MedalTable } from '@/components/stats/MedalTable'
import { PlayerStatCards } from '@/components/stats/PlayerStatCards'
import { H2HMatrix } from '@/components/stats/H2HMatrix'
import { RaceChart } from '@/components/stats/RaceChart'
import { ConsistencyChart } from '@/components/stats/ConsistencyChart'
import { HighlightsTab } from '@/components/stats/HighlightsTab'
import { TimelineTab } from '@/components/stats/TimelineTab'
import { DrinkTab } from '@/components/stats/DrinkTab'

type TabKey = 'race' | 'spillere' | 'h2h' | 'medaljer' | 'konsistens' | 'høydepunkter' | 'tidslinje' | 'drikke'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'race',         label: 'Løp',          icon: TrendingUp },
  { key: 'spillere',     label: 'Spillere',      icon: Users },
  { key: 'h2h',          label: 'H2H',           icon: ArrowLeftRight },
  { key: 'medaljer',     label: 'Medaljer',      icon: Medal },
  { key: 'konsistens',   label: 'Konsistens',    icon: Target },
  { key: 'høydepunkter', label: 'Høydepunkter',  icon: Sparkles },
  { key: 'tidslinje',    label: 'Tidslinje',     icon: Clock },
  { key: 'drikke',       label: 'Drikke',        icon: Beer },
]

export function StatsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('race')
  const stats = useStats()
  const drinks = useDrinks()

  return (
    <div className="space-y-5">
      <div className="text-center pt-4 pb-2 animate-fade-up">
        <h1 className="font-display text-4xl text-primary tracking-wider text-glow">
          Statistikk
        </h1>
        <p className="text-sm text-muted-foreground mt-1 italic">
          Tall, grafer og rivaliseringer
        </p>
      </div>

      {/* Tab grid — 4 columns × 2 rows */}
      <div className="grid grid-cols-4 gap-2 animate-fade-up" style={{ animationDelay: '60ms' }}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-xs font-medium transition-all',
                active
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', active && 'text-primary')} />
              <span className="text-center leading-tight">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        {activeTab === 'race'         && <RaceChart stats={stats} />}
        {activeTab === 'spillere'     && <PlayerStatCards stats={stats} />}
        {activeTab === 'h2h'          && <H2HMatrix stats={stats} />}
        {activeTab === 'medaljer'     && <MedalTable stats={stats} />}
        {activeTab === 'konsistens'   && <ConsistencyChart stats={stats} />}
        {activeTab === 'høydepunkter' && <HighlightsTab stats={stats} />}
        {activeTab === 'tidslinje'    && <TimelineTab events={stats.recentEvents} />}
        {activeTab === 'drikke'       && <DrinkTab drinks={drinks} />}
      </div>
    </div>
  )
}
