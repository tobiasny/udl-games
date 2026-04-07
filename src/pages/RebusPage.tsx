import { useState, useEffect } from 'react'
import { useRebus, type RebusTask } from '@/hooks/use-rebus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, Send, CheckCircle, Clock, PartyPopper, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RebusPage() {
  const { tasks, loading, submitAnswer, refetch } = useRebus()
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [viewKey, setViewKey] = useState(0)

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(refetch, 5000)
    return () => clearInterval(interval)
  }, [refetch])

  // Find the single "current" task
  const activeTask = tasks.find((t) => t.status === 'active')
  const submittedTask = tasks.find((t) => t.status === 'submitted')
  const approvedTask = tasks.find((t) => t.status === 'approved')
  const currentTask = approvedTask ?? submittedTask ?? activeTask

  const totalCount = tasks.length
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const allDone = totalCount > 0 && completedCount === totalCount

  // Trigger fade transition whenever we move to a new task or status
  const currentKey = currentTask ? `${currentTask.id}-${currentTask.status}` : allDone ? 'done' : 'empty'
  useEffect(() => {
    setViewKey((k) => k + 1)
  }, [currentKey])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeTask || !answer.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await submitAnswer(activeTask.id, answer.trim())
      setAnswer('')
    } catch {
      setError('Noe gikk galt. Prov igjen.')
    }
    setSubmitting(false)
  }

  return (
    <FullScreenShell>
      {loading ? (
        <CenteredMessage>
          <div className="text-muted-foreground tracking-wide animate-pulse">Laster...</div>
        </CenteredMessage>
      ) : totalCount === 0 ? (
        <CenteredMessage key="empty">
          <Sparkles className="h-14 w-14 mx-auto text-primary mb-4" />
          <h1 className="font-display text-4xl text-primary tracking-wider text-glow mb-2">Rebus Run</h1>
          <p className="text-muted-foreground">Kommer snart...</p>
        </CenteredMessage>
      ) : allDone ? (
        <CenteredMessage key="done">
          <div className="animate-pulse-glow rounded-full p-6 inline-flex">
            <PartyPopper className="h-20 w-20 text-primary text-glow" />
          </div>
          <h1 className="font-display text-6xl text-primary tracking-wider text-glow mt-6 mb-3">
            Du er fremme!
          </h1>
          <p className="text-lg text-muted-foreground max-w-sm mx-auto">
            Alle oppgaver er fullfort. Gratulerer, Mats!
          </p>
        </CenteredMessage>
      ) : currentTask ? (
        <StoryView
          key={viewKey}
          task={currentTask}
          answer={answer}
          onAnswerChange={setAnswer}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
        />
      ) : null}

      {/* Subtle progress bar at bottom */}
      {totalCount > 0 && !allDone && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border/30 z-20">
          <div
            className="h-full bg-primary shadow-[0_0_10px_oklch(0.82_0.16_195/0.6)] transition-all duration-1000 ease-out"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      )}
    </FullScreenShell>
  )
}

function FullScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-background bg-grid overflow-hidden flex flex-col">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[oklch(0.75_0.2_310/0.04)] blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex-1 flex items-center justify-center p-6 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center animate-fade-up max-w-md">
      {children}
    </div>
  )
}

function StoryView({
  task,
  answer,
  onAnswerChange,
  onSubmit,
  submitting,
  error,
}: {
  task: RebusTask
  answer: string
  onAnswerChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
  error: string
}) {
  return (
    <div className="w-full max-w-xl mx-auto space-y-8 animate-fade-up">
      {/* Task number — subtle */}
      <div className="text-center">
        <div className="inline-block font-display text-xs tracking-[0.3em] text-primary/60 uppercase">
          Oppgave {String(task.sort_order).padStart(2, '0')}
        </div>
      </div>

      {/* Title */}
      <h1 className="font-display text-4xl sm:text-5xl text-center text-foreground tracking-wide leading-tight">
        {task.title}
      </h1>

      {/* Description */}
      <p className="text-center text-base sm:text-lg text-muted-foreground whitespace-pre-wrap leading-relaxed max-w-lg mx-auto">
        {task.description}
      </p>

      {/* State-specific content */}
      <div className="pt-4">
        {task.status === 'active' && task.task_type === 'answer' && (
          <form onSubmit={onSubmit} className="space-y-4 max-w-sm mx-auto">
            <Input
              placeholder="Skriv svaret ditt..."
              value={answer}
              onChange={(e) => onAnswerChange(e.target.value)}
              autoFocus
              className="text-center text-lg h-12 neon-border bg-card/40"
            />
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full h-12 text-base" disabled={submitting || !answer.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Sender...' : 'Send svar'}
            </Button>
          </form>
        )}

        {task.status === 'active' && task.task_type === 'activity' && (
          <WaitingState
            icon={<Clock className="h-12 w-12 text-muted-foreground animate-pulse" />}
            message="Gjennomfor oppgaven og vent pa godkjenning"
          />
        )}

        {task.status === 'submitted' && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full glass-panel animate-pulse-glow">
              <Clock className="h-10 w-10 text-primary" />
            </div>
            <p className="text-muted-foreground">Venter pa godkjenning...</p>
            {task.submitted_answer && (
              <p className="text-sm">
                Ditt svar: <span className="font-bold text-primary text-glow">{task.submitted_answer}</span>
              </p>
            )}
          </div>
        )}

        {task.status === 'approved' && (
          <div className="text-center space-y-5 animate-fade-up">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 neon-border">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary tracking-wider text-glow">
              Godkjent!
            </h2>
            {task.destination_name && (
              <p className="text-xl font-semibold">{task.destination_name}</p>
            )}
            {task.destination_coords && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="font-mono text-sm">{task.destination_coords}</span>
                </div>
                <Button
                  size="lg"
                  onClick={() => {
                    const coords = task.destination_coords!
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`,
                      '_blank'
                    )
                  }}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Apne i kart
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2">
              Dra til lokasjonen. Neste oppgave apnes nar du ankommer.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function WaitingState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className={cn('text-center space-y-4')}>
      <div className="inline-flex items-center justify-center">{icon}</div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}
