import { useSearchParams } from 'react-router-dom'
import { Gamepad2, Sparkles, Users, Settings, Beer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActivitiesPage } from './ActivitiesPage'
import { EventsPage } from './EventsPage'
import { ContestantsPage } from './ContestantsPage'
import { RebusAdminPage } from './RebusAdminPage'
import { DrinkAdminPage } from './DrinkAdminPage'

const TABS = [
  { key: 'aktiviteter', label: 'Aktiviteter', icon: Gamepad2 },
  { key: 'events', label: 'Events', icon: Sparkles },
  { key: 'deltakere', label: 'Deltakere', icon: Users },
  { key: 'rebus', label: 'Rebus', icon: Settings },
  { key: 'drikke', label: 'Drikke', icon: Beer },
] as const

type TabKey = (typeof TABS)[number]['key']

export function AdminPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const activeTab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : 'aktiviteter'

  function setTab(key: TabKey) {
    setParams({ tab: key }, { replace: true })
  }

  return (
    <div className="space-y-4">
      {/* Tab grid */}
      <div className="grid grid-cols-5 gap-2">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
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
      <div>
        {activeTab === 'aktiviteter' && <ActivitiesPage />}
        {activeTab === 'events' && <EventsPage />}
        {activeTab === 'deltakere' && <ContestantsPage />}
        {activeTab === 'rebus' && <RebusAdminPage />}
        {activeTab === 'drikke' && <DrinkAdminPage />}
      </div>
    </div>
  )
}
