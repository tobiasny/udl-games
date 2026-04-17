import { useState } from 'react'
import { Beer, Minus, User } from 'lucide-react'
import { useDrinks } from '@/hooks/use-drinks'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function DrinkAdminPage() {
  const { drinkCounts, loading, logDrink, removeLastDrink } = useDrinks()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleAdd(contestantId: string) {
    setPendingId(contestantId)
    setError('')
    try {
      await logDrink(contestantId)
    } catch {
      setError('Kunne ikke logge drink')
    } finally {
      setPendingId(null)
    }
  }

  async function handleRemove(contestantId: string) {
    setPendingId(`undo-${contestantId}`)
    setError('')
    try {
      await removeLastDrink(contestantId)
    } catch {
      setError('Kunne ikke angre')
    } finally {
      setPendingId(null)
    }
  }

  const grandTotal = drinkCounts.reduce((s, d) => s + d.total, 0)

  if (loading) return <div className="text-center py-12 text-muted-foreground">Laster...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beer className="h-5 w-5" />
          <h1 className="text-xl font-display tracking-wider">Drikkesporing</h1>
        </div>
        <div className="font-display text-2xl text-primary">{grandTotal} 🍺</div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {drinkCounts.map((d) => {
          const isAdding = pendingId === d.contestant.id
          const isRemoving = pendingId === `undo-${d.contestant.id}`
          return (
            <Card key={d.contestant.id}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                {d.contestant.avatar_url ? (
                  <img
                    src={d.contestant.avatar_url}
                    alt={d.contestant.name}
                    className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="flex-1 font-medium">{d.contestant.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl w-8 text-center">{d.total}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={isRemoving || d.total === 0}
                    onClick={() => handleRemove(d.contestant.id)}
                    aria-label="Angre siste drink"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={isAdding}
                    onClick={() => handleAdd(d.contestant.id)}
                    className="gap-1"
                  >
                    <Beer className="h-4 w-4" />
                    <span>+1</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
