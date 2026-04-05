import { useState, useEffect } from 'react'
import { useRebus, type RebusTask } from '@/hooks/use-rebus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MapPin, Send, CheckCircle, Lock, Clock, PartyPopper } from 'lucide-react'

export function RebusPage() {
  const { tasks, loading, submitAnswer, refetch } = useRebus()
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(refetch, 5000)
    return () => clearInterval(interval)
  }, [refetch])

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

  const activeTask = tasks.find((t) => t.status === 'active')
  const submittedTask = tasks.find((t) => t.status === 'submitted')
  const approvedTask = tasks.find((t) => t.status === 'approved')
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const totalCount = tasks.length
  const allDone = totalCount > 0 && completedCount === totalCount

  const currentTask = approvedTask ?? submittedTask ?? activeTask

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeTask || !answer.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await submitAnswer(activeTask.id, answer.trim())
      setAnswer('')
    } catch {
      setError('Failed to submit answer')
    }
    setSubmitting(false)
  }

  // No tasks at all
  if (totalCount === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="py-12 space-y-3">
            <PartyPopper className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-2xl font-black text-primary">Mats Games</h1>
            <p className="text-muted-foreground">Rebus run coming soon...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // All tasks completed
  if (allDone) {
    return (
      <div className="space-y-6">
        <WelcomeHeader completedCount={completedCount} totalCount={totalCount} />
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-12 text-center space-y-3">
            <PartyPopper className="h-16 w-16 mx-auto text-primary" />
            <h2 className="text-2xl font-black text-primary">Du er fremme!</h2>
            <p className="text-muted-foreground">Alle oppgaver er fullfort. Gratulerer!</p>
          </CardContent>
        </Card>
        <CompletedTasks tasks={tasks} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <WelcomeHeader completedCount={completedCount} totalCount={totalCount} />

      {/* Current task */}
      {currentTask && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Oppgave {currentTask.sort_order}
              </CardTitle>
              <StatusBadge status={currentTask.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <h2 className="text-lg font-bold">{currentTask.title}</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {currentTask.description}
            </p>

            {/* Active answer task - show input */}
            {currentTask.status === 'active' && currentTask.task_type === 'answer' && (
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  placeholder="Skriv svaret ditt her..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoFocus
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting || !answer.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? 'Sender...' : 'Send svar'}
                </Button>
              </form>
            )}

            {/* Active activity task - just waiting for admin */}
            {currentTask.status === 'active' && currentTask.task_type === 'activity' && (
              <div className="text-center py-4">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Gjennomfor oppgaven og vent pa godkjenning
                </p>
              </div>
            )}

            {/* Submitted - waiting for approval */}
            {currentTask.status === 'submitted' && (
              <div className="text-center py-4">
                <Clock className="h-8 w-8 mx-auto text-primary animate-pulse mb-2" />
                <p className="text-sm text-muted-foreground">
                  Svaret ditt er sendt inn. Venter pa godkjenning...
                </p>
                {currentTask.submitted_answer && (
                  <p className="text-sm mt-2">
                    Ditt svar: <span className="font-bold">{currentTask.submitted_answer}</span>
                  </p>
                )}
              </div>
            )}

            {/* Approved - show coordinates */}
            {currentTask.status === 'approved' && (
              <div className="space-y-3">
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center space-y-2">
                  <CheckCircle className="h-8 w-8 mx-auto text-primary mb-1" />
                  <p className="text-sm font-bold text-primary">Godkjent!</p>
                  {currentTask.destination_name && (
                    <p className="font-semibold">{currentTask.destination_name}</p>
                  )}
                  {currentTask.destination_coords && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-mono text-sm">{currentTask.destination_coords}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          const coords = currentTask.destination_coords!
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`,
                            '_blank'
                          )
                        }}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        Apne i kart
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Dra til lokasjonen. Neste oppgave lasers opp nar du ankommer.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completed tasks */}
      <CompletedTasks tasks={tasks} />
    </div>
  )
}

function WelcomeHeader({ completedCount, totalCount }: { completedCount: number; totalCount: number }) {
  return (
    <div className="text-center pt-4 pb-2">
      <h1 className="text-2xl font-black tracking-tight text-primary">Mats Games</h1>
      <p className="text-sm text-muted-foreground mt-1 italic">Rebus Run</p>
      <div className="flex items-center justify-center gap-2 mt-3">
        <div className="h-1.5 flex-1 max-w-48 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">{completedCount}/{totalCount}</span>
      </div>
    </div>
  )
}

function CompletedTasks({ tasks }: { tasks: RebusTask[] }) {
  const completed = tasks.filter((t) => t.status === 'completed')
  if (completed.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Fullforte oppgaver</h3>
      {completed.map((t) => (
        <Card key={t.id} className="opacity-60">
          <CardContent className="flex items-center gap-3 py-2 px-4">
            <CheckCircle className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm">{t.title}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: RebusTask['status'] }) {
  switch (status) {
    case 'locked':
      return <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" /> Last</Badge>
    case 'active':
      return <Badge className="bg-primary/20 text-primary border-primary/30">Aktiv</Badge>
    case 'submitted':
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Venter</Badge>
    case 'approved':
      return <Badge className="bg-primary/20 text-primary border-primary/30"><MapPin className="h-3 w-3 mr-1" /> Godkjent</Badge>
    case 'completed':
      return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" /> Fullfort</Badge>
  }
}
