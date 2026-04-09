import { useState } from 'react'
import { useStats } from '@/hooks/use-stats'
import { cn } from '@/lib/utils'
import { MedalTable } from '@/components/stats/MedalTable'
import { PlayerStatCards } from '@/components/stats/PlayerStatCards'
import { H2HMatrix } from '@/components/stats/H2HMatrix'
import { RaceChart } from '@/components/stats/RaceChart'
import { ConsistencyChart } from '@/components/stats/ConsistencyChart'

type TabKey = 'race' | 'spillere' | 'h2h' | 'medaljer' | 'konsistens'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'race', label: 'Løp' },
  { key: 'spillere', label: 'Spillere' },
  { key: 'h2h', label: 'H2H' },
  { key: 'medaljer', label: 'Medaljer' },
  { key: 'konsistens', label: 'Konsistens' },
]

export function StatsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('race')
  const stats = useStats()

  return (
    <div className="space-y-6">
      <div className="text-center pt-4 pb-2 animate-fade-up">
        <h1 className="font-display text-4xl text-primary tracking-wider text-glow">
          Statistikk
        </h1>
        <p className="text-sm text-muted-foreground mt-1 italic">
          Tall, grafer og rivaliseringer
        </p>
      </div>

      {/* Tab bar */}
      <nav className="overflow-x-auto whitespace-nowrap border-b border-border animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="flex gap-0.5 px-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'relative px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === key
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              {activeTab === key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab content */}
      <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        {activeTab === 'race' && <RaceChart stats={stats} />}
        {activeTab === 'spillere' && <PlayerStatCards stats={stats} />}
        {activeTab === 'h2h' && <H2HMatrix stats={stats} />}
        {activeTab === 'medaljer' && <MedalTable stats={stats} />}
        {activeTab === 'konsistens' && <ConsistencyChart stats={stats} />}
      </div>
    </div>
  )
}
