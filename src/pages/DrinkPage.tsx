import { useState, useEffect, useCallback } from 'react'
import { Beer, User, X } from 'lucide-react'
import { usePlayerAuth } from '@/hooks/use-player-auth'
import { useDrinks } from '@/hooks/use-drinks'
import { useContestants } from '@/hooks/use-contestants'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Contestant } from '@/lib/types'

export function DrinkPage() {
  const { contestantId, playerToken, loading: authLoading, login, logout } = usePlayerAuth()
  const { contestants, loading: contestantsLoading } = useContestants()
  const { drinkCounts, loading: _drinksLoading, logDrinkSelf } = useDrinks()

  // Login state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginPending, setLoginPending] = useState(false)

  // Drink tap state
  const [flashGreen, setFlashGreen] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [optimisticDelta, setOptimisticDelta] = useState(0)
  const [, forceUpdate] = useState(0)

  // Re-render when cooldown expires so the button re-enables automatically
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const ms = cooldownUntil - Date.now()
    const t = setTimeout(() => forceUpdate((n) => n + 1), ms)
    return () => clearTimeout(t)
  }, [cooldownUntil])

  const submitPin = useCallback(async (pinValue: string) => {
    if (!selectedId) return
    setLoginPending(true)
    setLoginError('')
    try {
      const success = await login(selectedId, pinValue)
      if (!success) {
        setPin('')
        setLoginError('Feil PIN-kode')
      }
    } catch {
      setPin('')
      setLoginError('Nettverksfeil — prøv igjen')
    } finally {
      setLoginPending(false)
    }
  }, [selectedId, login])

  function handlePinDigit(digit: string) {
    if (loginPending) return
    const next = pin.length < 4 ? pin + digit : pin
    setPin(next)
    if (next.length === 4 && selectedId) {
      void submitPin(next)
    }
  }

  function handleSelectContestant(id: string) {
    setSelectedId(id)
    setPin('')
    setLoginError('')
  }

  const handleDrink = useCallback(async () => {
    if (!playerToken || Date.now() < cooldownUntil) return
    setOptimisticDelta((d) => d + 1)
    setFlashGreen(true)
    setCooldownUntil(Date.now() + 5000)
    setTimeout(() => setFlashGreen(false), 2000)
    try {
      await logDrinkSelf(playerToken)
      setOptimisticDelta((d) => d - 1)
    } catch {
      setOptimisticDelta((d) => d - 1)
    }
  }, [playerToken, cooldownUntil, logDrinkSelf])

  if (authLoading || contestantsLoading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  if (!contestantId || !playerToken) {
    return (
      <LoginView
        contestants={contestants}
        selectedId={selectedId}
        pin={pin}
        error={loginError}
        pending={loginPending}
        onSelectContestant={handleSelectContestant}
        onPinDigit={handlePinDigit}
        onBackspace={() => setPin((p) => p.slice(0, -1))}
      />
    )
  }

  // Authenticated view — sort by drinks desc, then name asc for stable ordering
  const sorted = [...drinkCounts].sort(
    (a, b) => b.total - a.total || a.contestant.name.localeCompare(b.contestant.name),
  )
  const myIdx = sorted.findIndex((d) => d.contestant.id === contestantId)
  const myData = sorted[myIdx]
  const myCount = (myData?.total ?? 0) + optimisticDelta
  const above = myIdx > 0 ? sorted[myIdx - 1] : null
  const below = myIdx < sorted.length - 1 ? sorted[myIdx + 1] : null
  const grandTotal = drinkCounts.reduce((s, d) => s + d.total, 0) + optimisticDelta
  const isCoolingDown = Date.now() < cooldownUntil
  const myContestant = myData?.contestant

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beer className="h-5 w-5" />
          <span className="font-display tracking-wider">{myContestant?.name}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground gap-1.5">
          <X className="h-3.5 w-3.5" />
          <span className="text-xs">Logg ut</span>
        </Button>
      </div>

      {/* Counter */}
      <div className="text-center">
        <div
          className={cn(
            'font-display text-8xl font-bold transition-colors duration-300',
            flashGreen ? 'text-green-400' : 'text-foreground',
          )}
        >
          {myCount}
        </div>
        <div className="text-sm text-muted-foreground mt-1">drinker</div>
      </div>

      {/* Big drink button */}
      <Button
        className={cn(
          'w-full h-20 text-2xl font-bold gap-3 transition-all duration-300',
          flashGreen
            ? 'bg-green-500 hover:bg-green-500 shadow-[0_0_32px_rgba(74,222,128,0.4)]'
            : 'shadow-[0_0_24px_rgba(99,102,241,0.3)]',
        )}
        onClick={handleDrink}
        disabled={isCoolingDown}
      >
        {isCoolingDown ? (
          <span className="text-sm tracking-widest opacity-60">Venter...</span>
        ) : (
          <>🍺 +1</>
        )}
      </Button>

      {/* Drink-rank context: show neighbors only when there are multiple players */}
      {sorted.length > 1 && (
        <div className="space-y-1 text-sm">
          {above && (
            <div className="flex justify-between text-muted-foreground px-2">
              <span>↑ {above.contestant.name}</span>
              <span>{above.total}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-primary px-2 py-1 rounded-lg bg-primary/10">
            <span>{myContestant?.name}</span>
            <span>{myCount}</span>
          </div>
          {below && (
            <div className="flex justify-between text-muted-foreground px-2">
              <span>↓ {below.contestant.name}</span>
              <span>{below.total}</span>
            </div>
          )}
        </div>
      )}

      {/* Party total */}
      <div className="text-center text-sm text-muted-foreground border-t border-border pt-4">
        Fest-total: 🍺 {grandTotal}
      </div>
    </div>
  )
}

// --- Login sub-view ---

interface LoginViewProps {
  contestants: Contestant[]
  selectedId: string | null
  pin: string
  error: string
  pending: boolean
  onSelectContestant: (id: string) => void
  onPinDigit: (digit: string) => void
  onBackspace: () => void
}

function LoginView({
  contestants,
  selectedId,
  pin,
  error,
  pending,
  onSelectContestant,
  onPinDigit,
  onBackspace,
}: LoginViewProps) {
  return (
    <div className="space-y-5 pt-2">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 text-center">
          Hvem er du?
        </p>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {contestants.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectContestant(c.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors text-left',
                selectedId === c.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:bg-accent/50 text-foreground',
              )}
            >
              {c.avatar_url ? (
                <img
                  src={c.avatar_url}
                  alt={c.name}
                  className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <span className="font-medium">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedId && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest text-center">
            PIN-kode
          </p>

          {/* 4-dot PIN indicator */}
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-10 h-12 rounded-xl border flex items-center justify-center text-xl transition-colors',
                  i < pin.length
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card',
                )}
              >
                {i < pin.length ? '●' : ''}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          {pending && (
            <p className="text-xs text-muted-foreground text-center animate-pulse">
              Sjekker...
            </p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                onClick={() => onPinDigit(d)}
                className="h-12 rounded-xl border border-border bg-card text-foreground text-lg font-medium hover:bg-accent/50 transition-colors active:scale-95"
              >
                {d}
              </button>
            ))}
            <div />
            <button
              onClick={() => onPinDigit('0')}
              className="h-12 rounded-xl border border-border bg-card text-foreground text-lg font-medium hover:bg-accent/50 transition-colors active:scale-95"
            >
              0
            </button>
            <button
              onClick={onBackspace}
              className="h-12 rounded-xl border border-border bg-card text-muted-foreground hover:bg-accent/50 transition-colors active:scale-95"
            >
              ⌫
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
