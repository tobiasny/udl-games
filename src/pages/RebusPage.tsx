import { useState, useEffect, useCallback, useRef } from 'react'
import { useRebus, type RebusTask } from '@/hooks/use-rebus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, Send, CheckCircle, Clock, PartyPopper, Sparkles } from 'lucide-react'

const INTRO_SEEN_KEY = 'rebus-intro-seen-v1'

const INTRO_MESSAGES = [
  'Hei Mats...',
  'Du trodde du skulle fa hvile deg denne helgen...',
  'Men du tok feil...',
  'Den siste friske delen som er igjen av leveren din skal ofres....',
  'Det er bare en mate du kan overleve denne helgen pa...',
  '...og det er at du gjor akkurat som du far beskjed om...',
  'Jeg har en rekke oppdrag som jeg trenger at du skal utfore....',
  '... Her kommer forste oppdrag...',
]

/** Reveal `text` one character at a time. Returns the currently-visible
 *  substring, a `done` flag, and a `complete()` escape hatch (for click-to-skip). */
function useTypewriter(text: string, speed = 38) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    if (!text) {
      setDone(true)
      return
    }
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        window.clearInterval(id)
        setDone(true)
      }
    }, speed)
    return () => window.clearInterval(id)
  }, [text, speed])

  const complete = useCallback(() => {
    setDisplayed(text)
    setDone(true)
  }, [text])

  return { displayed, done, complete }
}

function BlinkingCursor({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block w-[0.55ch] translate-y-[0.1em] bg-primary cursor-blink text-glow ${className}`}
    >
      &nbsp;
    </span>
  )
}

export function RebusPage() {
  const { tasks, loading, submitAnswer, refetch } = useRebus()
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [viewKey, setViewKey] = useState(0)

  const [introDone, setIntroDone] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INTRO_SEEN_KEY) === '1'
    } catch {
      return false
    }
  })

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

  // Intro plays once, before any task has been submitted/approved/completed.
  const shouldPlayIntro =
    !introDone &&
    !loading &&
    totalCount > 0 &&
    completedCount === 0 &&
    !submittedTask &&
    !approvedTask &&
    !!activeTask

  const finishIntro = () => {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
    setIntroDone(true)
  }

  return (
    <FullScreenShell>
      {loading ? (
        <CenteredMessage>
          <div className="font-mono text-muted-foreground tracking-widest animate-pulse uppercase text-sm">
            kobler til...
          </div>
        </CenteredMessage>
      ) : shouldPlayIntro ? (
        <IntroSequence onComplete={finishIntro} />
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
            Oppdrag fullfort!
          </h1>
          <p className="font-mono text-sm tracking-widest uppercase text-muted-foreground max-w-sm mx-auto">
            Alle oppgaver avklart. Godt jobbet, Mats.
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
      {totalCount > 0 && !allDone && !shouldPlayIntro && (
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
    <div className="fixed inset-0 bg-background bg-grid bg-scanlines overflow-hidden flex flex-col">
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

/** Plays the intro message sequence. One message at a time, typed out
 *  character by character. Auto-advances after a short pause; click anywhere
 *  to complete the current line or move to the next. */
function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0)
  const current = INTRO_MESSAGES[index]
  const isLast = index === INTRO_MESSAGES.length - 1
  const { displayed, done, complete } = useTypewriter(current, 55)

  const advance = useCallback(() => {
    if (isLast) {
      onComplete()
    } else {
      setIndex((i) => i + 1)
    }
  }, [isLast, onComplete])

  // Auto-advance shortly after the message is fully typed.
  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(advance, isLast ? 1800 : 1500)
    return () => window.clearTimeout(t)
  }, [done, advance, isLast])

  const handleClick = () => {
    if (!done) complete()
    else advance()
  }

  return (
    <div
      onClick={handleClick}
      className="fixed inset-0 flex items-center justify-center cursor-pointer select-none p-6 sm:p-10"
    >
      {/* Top status bar */}
      <div className="absolute top-4 sm:top-6 left-0 right-0 flex justify-between items-center px-4 sm:px-8 font-mono text-[9px] sm:text-[11px] tracking-[0.3em] uppercase text-primary/60">
        <span>// innkommende overforing</span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          kryptert kanal
        </span>
      </div>

      {/* Message frame */}
      <div className="relative w-full max-w-2xl corner-frame glass-panel px-6 py-10 sm:px-10 sm:py-14 animate-fade-in">
        <span className="corner-tr" />
        <span className="corner-bl" />

        <div className="font-mono text-[10px] sm:text-xs tracking-[0.28em] text-primary/70 uppercase mb-6 flex justify-between">
          <span>melding {String(index + 1).padStart(2, '0')} / {String(INTRO_MESSAGES.length).padStart(2, '0')}</span>
          <span>// avsender: ukjent</span>
        </div>

        <p className="font-mono text-lg sm:text-2xl md:text-3xl text-foreground leading-relaxed min-h-[8rem] sm:min-h-[9rem] whitespace-pre-wrap">
          {displayed}
          <BlinkingCursor />
        </p>

        {/* Progress dots */}
        <div className="mt-8 flex justify-center gap-2">
          {INTRO_MESSAGES.map((_, i) => (
            <span
              key={i}
              className={
                'h-1 rounded-full transition-all duration-300 ' +
                (i < index
                  ? 'w-6 bg-primary/70'
                  : i === index
                    ? 'w-10 bg-primary shadow-[0_0_8px_oklch(0.82_0.16_195/0.6)]'
                    : 'w-6 bg-border/40')
              }
            />
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-6 left-0 right-0 text-center font-mono text-[9px] sm:text-[11px] tracking-[0.3em] uppercase text-muted-foreground/60">
        trykk for a fortsette
      </div>
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
  // Chain the reveals: title first, then description. The status-specific
  // content (form, waiting, approved-screen) only shows after both are done.
  const titleType = useTypewriter(task.title, 40)
  const descType = useTypewriter(titleType.done ? task.description : '', 22)
  const revealed = titleType.done && descType.done

  // Allow click-to-skip the typing on the task view too.
  const skipRef = useRef({ titleType, descType })
  skipRef.current = { titleType, descType }
  const handleSkip = () => {
    const { titleType: t, descType: d } = skipRef.current
    if (!t.done) t.complete()
    else if (!d.done) d.complete()
  }

  return (
    <div
      className="w-full max-w-xl mx-auto space-y-7 animate-fade-up"
      onClick={revealed ? undefined : handleSkip}
    >
      {/* Mission header bar */}
      <div className="flex justify-between items-center font-mono text-[10px] sm:text-xs tracking-[0.3em] uppercase text-primary/70">
        <span>// oppdrag {String(task.sort_order).padStart(2, '0')}</span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          aktiv
        </span>
      </div>

      {/* Title — typed out */}
      <div className="relative corner-frame glass-panel px-5 py-6 sm:px-8 sm:py-8">
        <span className="corner-tr" />
        <span className="corner-bl" />
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-foreground tracking-wide leading-tight text-glow min-h-[2.5em]">
          {titleType.displayed}
          {!titleType.done && <BlinkingCursor />}
        </h1>

        {/* Description */}
        {titleType.done && (
          <p className="mt-5 font-mono text-sm sm:text-base text-muted-foreground whitespace-pre-wrap leading-relaxed min-h-[3rem]">
            {descType.displayed}
            {!descType.done && <BlinkingCursor />}
          </p>
        )}
      </div>

      {/* State-specific content — only reveal after the text has finished */}
      {revealed && (
        <div className="pt-2 animate-fade-up">
          {task.status === 'active' && task.task_type === 'answer' && (
            <form onSubmit={onSubmit} className="space-y-4 max-w-sm mx-auto">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary/60 text-center">
                // svar kreves
              </div>
              <Input
                placeholder="> skriv svaret ditt..."
                value={answer}
                onChange={(e) => onAnswerChange(e.target.value)}
                autoFocus
                className="text-center text-lg h-12 neon-border bg-card/40 font-mono"
              />
              {error && <p className="font-mono text-sm text-destructive text-center">{error}</p>}
              <Button type="submit" className="w-full h-12 text-base font-mono tracking-widest uppercase" disabled={submitting || !answer.trim()}>
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'sender...' : 'send svar'}
              </Button>
            </form>
          )}

          {task.status === 'active' && task.task_type === 'activity' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center">
                <Clock className="h-12 w-12 text-muted-foreground animate-pulse" />
              </div>
              <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
                // gjennomfor oppdrag og vent pa bekreftelse
              </p>
            </div>
          )}

          {task.status === 'submitted' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full glass-panel animate-pulse-glow">
                <Clock className="h-10 w-10 text-primary" />
              </div>
              <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
                // verifiserer respons...
              </p>
              {task.submitted_answer && (
                <p className="font-mono text-sm">
                  respons: <span className="font-bold text-primary text-glow">{task.submitted_answer}</span>
                </p>
              )}
            </div>
          )}

          {task.status === 'approved' && (
            <div className="text-center space-y-5 animate-fade-up">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 neon-border">
                <CheckCircle className="h-10 w-10 text-primary" />
              </div>
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary/70">
                // respons bekreftet
              </div>
              <h2 className="font-display text-2xl sm:text-3xl text-primary tracking-wider text-glow">
                Nytt koordinatsett mottatt
              </h2>
              {task.destination_name && (
                <p className="font-mono text-lg sm:text-xl font-semibold text-foreground">{task.destination_name}</p>
              )}
              {task.destination_coords && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="font-mono text-sm">{task.destination_coords}</span>
                  </div>
                  <Button
                    size="lg"
                    className="font-mono tracking-widest uppercase"
                    onClick={() => {
                      const coords = task.destination_coords!
                      window.open(
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`,
                        '_blank'
                      )
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    apne i kart
                  </Button>
                </div>
              )}
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground pt-2">
                // proceed to coordinates — nytt oppdrag laster ved ankomst
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
