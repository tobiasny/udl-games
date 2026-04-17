import { Vote } from 'lucide-react'
import { useActiveVote } from '@/hooks/use-voting'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function VotePage() {
  const { session, myVote, loading, castVote } = useActiveVote()
  const [casting, setCasting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleVote(optionId: string) {
    if (myVote || casting) return
    setCasting(optionId)
    setError('')
    try {
      await castVote(optionId)
    } catch {
      setError('Kunne ikke stemme. Prøv igjen.')
    } finally {
      setCasting(null)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  if (!session) {
    return (
      <div className="text-center py-16 space-y-2">
        <Vote className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground">Ingen aktiv avstemning nå.</p>
      </div>
    )
  }

  const hasVoted = !!myVote

  return (
    <div className="space-y-6 pb-8">
      <div className="text-center pt-6 animate-fade-up">
        <Vote className="h-8 w-8 mx-auto text-primary mb-3" />
        <h1 className="font-display text-2xl tracking-wider">{session.question}</h1>
        {hasVoted && (
          <p className="text-sm text-muted-foreground mt-2">
            Du har stemt — her er resultatene så langt ({session.totalVotes} stemmer)
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <div className="space-y-3">
        {session.options.map((opt, i) => {
          const pct = session.totalVotes > 0 ? Math.round((opt.voteCount / session.totalVotes) * 100) : 0
          const isMyVote = myVote === opt.id
          const isPending = casting === opt.id

          return (
            <div key={opt.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              {hasVoted ? (
                /* Results view */
                <Card className={cn(isMyVote && 'border-primary/60 bg-primary/5')}>
                  <CardContent className="py-4 px-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={cn('font-medium', isMyVote && 'text-primary')}>
                        {opt.label}
                        {isMyVote && <span className="ml-2 text-xs text-primary">← din stemme</span>}
                      </span>
                      <span className="font-display text-lg">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', isMyVote ? 'bg-primary' : 'bg-muted-foreground/40')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.voteCount} stemmer</p>
                  </CardContent>
                </Card>
              ) : (
                /* Voting view */
                <Button
                  className="w-full h-14 text-base"
                  variant="outline"
                  disabled={!!casting}
                  onClick={() => handleVote(opt.id)}
                >
                  {isPending ? 'Stemmer...' : opt.label}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
