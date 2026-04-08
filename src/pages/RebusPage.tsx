import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useRebus, type RebusTask } from '@/hooks/use-rebus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RebusMap } from '@/components/RebusMap'
import {
  parseLatLon,
  haversineMeters,
  bearingDegrees,
  compassDirection,
  formatDistance,
  estimateDriveMinutes,
  formatDuration,
} from '@/lib/geo'
import { MapPin, Send, CheckCircle, Clock, Sparkles, Navigation, Route, Car, Trophy, AlertOctagon, Wine } from 'lucide-react'

const INTRO_SEEN_KEY = 'rebus-intro-seen-v1'

const FINALE_MESSAGES = [
  'Du har klart å ta deg frem til hytta... GRATULERER!',
  'Men ikke tro du kan få hvile enda.....',
  'Det er nå det hele begynner....',
  'Resten av helgen skal livet settes på prøve...',
  'Nå begynner...... MATS GAMES',
]

const INTRO_MESSAGES = [
  'Hei Mats...',
  'Du trodde du skulle få hvile deg denne helgen...',
  'Men du tok feil...',
  'Den siste friske delen som er igjen av leveren din skal ofres....',
  'Det er bare en måte du kan overleve denne helgen på...',
  '...og det er at du gjør akkurat som du får beskjed om...',
  'Jeg har en rekke oppdrag som jeg trenger at du skal utføre....',
  '... Her kommer første oppdrag...',
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
      className={`inline-block w-[0.55ch] translate-y-[0.1em] bg-foreground cursor-blink ${className}`}
    >
      &nbsp;
    </span>
  )
}

export function RebusPage() {
  const { tasks, settings, loading, submitAnswer, retryTask, refetch } = useRebus()
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
  const rejectedTask = tasks.find((t) => t.status === 'rejected')
  const currentTask = approvedTask ?? submittedTask ?? rejectedTask ?? activeTask

  const totalCount = tasks.length
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const allDone = totalCount > 0 && completedCount === totalCount

  // The "from" coordinates for the map are the destination of the previous
  // task in the route (which is by definition completed by the time the
  // current task is approved), or the global start coordinates if the
  // current task is the very first one. Falling back to start when the
  // previous task didn't have coordinates set keeps the map functional even
  // if the admin only provided coords on some legs.
  const previousFromCoords = useMemo<string | null>(() => {
    if (!currentTask) return null
    const prev = [...tasks]
      .filter((t) => t.sort_order < currentTask.sort_order && t.destination_coords)
      .sort((a, b) => b.sort_order - a.sort_order)[0]
    if (prev?.destination_coords) return prev.destination_coords
    return settings.start_coords
  }, [currentTask, tasks, settings])

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
      setError('Noe gikk galt. Prøv igjen.')
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
    !rejectedTask &&
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
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-display text-3xl tracking-tight mb-2">Rebus Run</h1>
          <p className="text-muted-foreground">Kommer snart...</p>
        </CenteredMessage>
      ) : allDone ? (
        <FinaleSequence key="done" />
      ) : rejectedTask ? (
        <RejectedView
          key={`rejected-${rejectedTask.id}`}
          onRetry={() => retryTask(rejectedTask.id).catch(() => {})}
        />
      ) : currentTask ? (
        <StoryView
          key={viewKey}
          task={currentTask}
          answer={answer}
          onAnswerChange={setAnswer}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
          previousFromCoords={previousFromCoords}
        />
      ) : null}

      {/* Subtle progress bar at bottom */}
      {totalCount > 0 && !allDone && !shouldPlayIntro && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border z-20">
          <div
            className="h-full bg-foreground transition-all duration-1000 ease-out"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      )}
    </FullScreenShell>
  )
}

function FullScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-background overflow-hidden flex flex-col">
      <div className="relative flex-1 flex items-center justify-center p-6 overflow-y-auto">
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
      <div className="absolute top-4 sm:top-6 left-0 right-0 flex justify-between items-center px-4 sm:px-8 font-mono text-[9px] sm:text-[11px] tracking-[0.3em] uppercase text-muted-foreground">
        <span>// innkommende overføring</span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
          kryptert kanal
        </span>
      </div>

      {/* Message frame */}
      <div className="relative w-full max-w-2xl corner-frame bg-card border border-border rounded-2xl px-6 py-10 sm:px-10 sm:py-14 animate-fade-in">
        <span className="corner-tr" />
        <span className="corner-bl" />

        <div className="font-mono text-[10px] sm:text-xs tracking-[0.28em] text-muted-foreground uppercase mb-6 flex justify-between">
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
                  ? 'w-6 bg-foreground/70'
                  : i === index
                    ? 'w-10 bg-foreground'
                    : 'w-6 bg-border')
              }
            />
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-6 left-0 right-0 text-center font-mono text-[9px] sm:text-[11px] tracking-[0.3em] uppercase text-muted-foreground">
        trykk for å fortsette
      </div>
    </div>
  )
}

/** Plays the finale message sequence after every rebus task is completed.
 *  Same typewriter feel as IntroSequence, but the last message stays on
 *  screen and a "go to leaderboard" button fades in beneath it. */
function FinaleSequence() {
  const [index, setIndex] = useState(0)
  const current = FINALE_MESSAGES[index]
  const isLast = index === FINALE_MESSAGES.length - 1
  const { displayed, done, complete } = useTypewriter(current, 65)

  const advance = useCallback(() => {
    if (!isLast) setIndex((i) => i + 1)
  }, [isLast])

  // Auto-advance shortly after each non-final line is fully typed.
  // The final line stays put and reveals the button instead.
  useEffect(() => {
    if (!done || isLast) return
    const t = window.setTimeout(advance, 1700)
    return () => window.clearTimeout(t)
  }, [done, advance, isLast])

  const handleClick = () => {
    if (!done) complete()
    else advance()
  }

  const showButton = isLast && done

  return (
    <div
      onClick={showButton ? undefined : handleClick}
      className={
        'fixed inset-0 flex items-center justify-center select-none p-6 sm:p-10 ' +
        (showButton ? '' : 'cursor-pointer')
      }
    >
      {/* Top status bar */}
      <div className="absolute top-4 sm:top-6 left-0 right-0 flex justify-between items-center px-4 sm:px-8 font-mono text-[9px] sm:text-[11px] tracking-[0.3em] uppercase text-muted-foreground">
        <span>// oppdrag fullført</span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
          siste overføring
        </span>
      </div>

      {/* Message frame */}
      <div className="relative w-full max-w-2xl corner-frame bg-card border border-border rounded-2xl px-6 py-10 sm:px-10 sm:py-14 animate-fade-in">
        <span className="corner-tr" />
        <span className="corner-bl" />

        <div className="font-mono text-[10px] sm:text-xs tracking-[0.28em] text-muted-foreground uppercase mb-6 flex justify-between">
          <span>melding {String(index + 1).padStart(2, '0')} / {String(FINALE_MESSAGES.length).padStart(2, '0')}</span>
          <span>// avsender: ukjent</span>
        </div>

        <p className="font-mono text-lg sm:text-2xl md:text-3xl text-foreground leading-relaxed min-h-[8rem] sm:min-h-[9rem] whitespace-pre-wrap">
          {displayed}
          {!showButton && <BlinkingCursor />}
        </p>

        {/* Progress dots */}
        <div className="mt-8 flex justify-center gap-2">
          {FINALE_MESSAGES.map((_, i) => (
            <span
              key={i}
              className={
                'h-1 rounded-full transition-all duration-300 ' +
                (i < index
                  ? 'w-6 bg-foreground/70'
                  : i === index
                    ? 'w-10 bg-foreground'
                    : 'w-6 bg-border')
              }
            />
          ))}
        </div>

        {/* Final reveal: button to the leaderboard */}
        {showButton && (
          <div className="mt-10 flex justify-center animate-fade-up">
            <Link to="/">
              <Button size="lg" className="h-12 px-8 font-mono tracking-widest uppercase">
                <Trophy className="h-4 w-4 mr-2" />
                til turneringen
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Bottom hint — only while typing through messages */}
      {!showButton && (
        <div className="absolute bottom-6 left-0 right-0 text-center font-mono text-[9px] sm:text-[11px] tracking-[0.3em] uppercase text-muted-foreground">
          trykk for å fortsette
        </div>
      )}
    </div>
  )
}

/** Fullscreen takeover shown when the admin rejects a submitted answer.
 *  Hard red flash + screen shake, then a typewritten "wrong answer, take a
 *  shot" message and a retry button. The button only enables after a short
 *  cooldown so the bachelor can't dismiss it instantly. */
function RejectedView({ onRetry }: { onRetry: () => void }) {
  const message = 'FEIL SVAR, ta en shot før du kan svare igjen.'
  const { displayed, done, complete } = useTypewriter(message, 45)
  const [canRetry, setCanRetry] = useState(false)

  // 4-second mandatory cooldown before the retry button enables, regardless
  // of how quickly the message finishes typing.
  useEffect(() => {
    const t = window.setTimeout(() => setCanRetry(true), 4000)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6 sm:p-10 rebus-reject-bg overflow-hidden"
      onClick={done ? undefined : complete}
    >
      {/* Red flash overlay */}
      <div className="absolute inset-0 bg-destructive/15 pointer-events-none rebus-reject-flash" />

      {/* Top status bar */}
      <div className="absolute top-4 sm:top-6 left-0 right-0 flex justify-between items-center px-4 sm:px-8 font-mono text-[9px] sm:text-[11px] tracking-[0.3em] uppercase text-destructive">
        <span>// avvist</span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
          respons forkastet
        </span>
      </div>

      {/* Main content frame */}
      <div className="relative w-full max-w-2xl corner-frame border-2 border-destructive bg-card rounded-2xl px-6 py-10 sm:px-10 sm:py-14 rebus-reject-shake">
        <span className="corner-tr" />
        <span className="corner-bl" />

        {/* Big alert icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <AlertOctagon className="h-20 w-20 sm:h-24 sm:w-24 text-destructive rebus-reject-pulse" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl tracking-tight text-center text-destructive mb-6 rebus-reject-glitch">
          FEIL SVAR
        </h1>

        {/* Typed message */}
        <p className="font-mono text-base sm:text-xl md:text-2xl text-foreground leading-relaxed min-h-[4rem] text-center whitespace-pre-wrap">
          {displayed}
          {!done && <BlinkingCursor />}
        </p>

        {/* Retry button — only enabled after cooldown + message done */}
        <div className="mt-10 flex justify-center">
          <Button
            size="lg"
            variant="destructive"
            disabled={!canRetry || !done}
            onClick={onRetry}
            className="h-12 px-8 font-mono tracking-widest uppercase"
          >
            <Wine className="h-4 w-4 mr-2" />
            {canRetry && done ? 'shot tatt - prøv igjen' : 'drikker...'}
          </Button>
        </div>
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
  previousFromCoords,
}: {
  task: RebusTask
  answer: string
  onAnswerChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
  error: string
  previousFromCoords: string | null
}) {
  // Chain the reveals: title first, then description. The status-specific
  // content (form, waiting, approved-screen) only shows after both are done.
  // Once the task is approved we hide the title/description entirely and
  // jump straight to the navigation view, so the typewriter is bypassed.
  const isApproved = task.status === 'approved'
  const titleType = useTypewriter(isApproved ? '' : task.title, 40)
  const descType = useTypewriter(!isApproved && titleType.done ? task.description : '', 22)
  const revealed = isApproved || (titleType.done && descType.done)

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
      <div className="flex justify-between items-center font-mono text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground">
        <span>// oppdrag {String(task.sort_order).padStart(2, '0')}</span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
          {isApproved ? 'navigerer' : 'aktiv'}
        </span>
      </div>

      {/* Title — typed out. Hidden once the task has been approved so the
          map and route stats can take over the screen. */}
      {!isApproved && (
        <div className="relative corner-frame bg-card border border-border rounded-2xl px-5 py-6 sm:px-8 sm:py-8">
          <span className="corner-tr" />
          <span className="corner-bl" />
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-foreground tracking-tight leading-tight min-h-[2.5em]">
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
      )}

      {/* State-specific content — only reveal after the text has finished */}
      {revealed && (
        <div className="pt-2 animate-fade-up">
          {task.status === 'active' && task.task_type === 'answer' && (
            <form onSubmit={onSubmit} className="space-y-4 max-w-sm mx-auto">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground text-center">
                // svar kreves
              </div>
              <Input
                placeholder="> skriv svaret ditt..."
                value={answer}
                onChange={(e) => onAnswerChange(e.target.value)}
                autoFocus
                className="text-center text-lg h-12 font-mono"
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
                <Clock className="h-10 w-10 text-muted-foreground animate-pulse" />
              </div>
              <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
                // gjennomfør oppdrag og vent på bekreftelse
              </p>
            </div>
          )}

          {task.status === 'submitted' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-card border border-border animate-pulse-glow">
                <Clock className="h-8 w-8 text-foreground" />
              </div>
              <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
                // verifiserer respons...
              </p>
              {task.submitted_answer && (
                <p className="font-mono text-sm">
                  respons: <span className="font-semibold">{task.submitted_answer}</span>
                </p>
              )}
            </div>
          )}

          {task.status === 'approved' && (
            <ApprovedView task={task} previousFromCoords={previousFromCoords} />
          )}
        </div>
      )}
    </div>
  )
}

// Renders the approved-state UI: a compact confirmation header followed by
// the embedded map and three route stats (distance, drive time, bearing).
// The task title/description are intentionally hidden by StoryView once the
// status flips to approved -- the navigation view stands on its own.
function ApprovedView({
  task,
  previousFromCoords,
}: {
  task: RebusTask
  previousFromCoords: string | null
}) {
  const fromLatLon = parseLatLon(previousFromCoords)
  const toLatLon = parseLatLon(task.destination_coords)
  // Distance / drive time / bearing only make sense when we have both
  // endpoints. When the admin hasn't supplied a start coord (and this is
  // the first leg), we gracefully fall back to a coords-only display below.
  const route = fromLatLon && toLatLon
    ? {
        meters: haversineMeters(fromLatLon, toLatLon),
        bearing: bearingDegrees(fromLatLon, toLatLon),
        driveMinutes: estimateDriveMinutes(haversineMeters(fromLatLon, toLatLon)),
      }
    : null

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-card border border-border">
          <CheckCircle className="h-7 w-7 text-foreground" />
        </div>
        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          // respons bekreftet
        </div>
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
          Nytt koordinatsett mottatt
        </h2>
      </div>

      {fromLatLon && toLatLon ? (
        <RebusMap from={fromLatLon} to={toLatLon} fromLabel="Start" toLabel="Mål" />
      ) : toLatLon ? (
        <p className="font-mono text-xs text-center text-muted-foreground py-4">
          // ingen startposisjon registrert - kart utilgjengelig
        </p>
      ) : null}

      {route && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Route className="h-4 w-4" />
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase">
                avstand
              </span>
            </div>
            <div className="font-display text-xl sm:text-2xl tracking-tight mt-1">
              {formatDistance(route.meters)}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Car className="h-4 w-4" />
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase">
                ca. tid
              </span>
            </div>
            <div className="font-display text-xl sm:text-2xl tracking-tight mt-1">
              {formatDuration(route.driveMinutes)}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Navigation
                className="h-4 w-4"
                style={{ transform: `rotate(${route.bearing}deg)` }}
              />
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase">
                retning
              </span>
            </div>
            <div className="font-display text-xl sm:text-2xl tracking-tight mt-1">
              {compassDirection(route.bearing)}
            </div>
          </div>
        </div>
      )}

      {task.destination_coords && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="font-mono text-xs">{task.destination_coords}</span>
        </div>
      )}

      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground text-center pt-2">
        // proceed to coordinates - nytt oppdrag laster ved ankomst
      </p>
    </div>
  )
}
