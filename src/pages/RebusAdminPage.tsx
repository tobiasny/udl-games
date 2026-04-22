import { useState, useEffect } from 'react'
import { useRebus, type RebusTask } from '@/hooks/use-rebus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Trash2, RotateCcw, CheckCircle, XCircle, MapPin, Pencil,
  X, Save, ChevronDown, ChevronUp, Flag, RefreshCw, Eye, QrCode, Copy, Check,
} from 'lucide-react'
import { parseLatLon } from '@/lib/geo'
import QRCodeLib from 'qrcode'

const REBUS_URL = 'https://udl-games.vercel.app/rebus/run'

export function RebusAdminPage() {
  const {
    tasks, settings, loading, refetch,
    approveTask, rejectAnswer, markArrived, addTask, updateTask, deleteTask,
    resetAll, resetTask, reorderTasks, setStart,
  } = useRebus()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [taskOrder, setTaskOrder] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const orderedTasks = taskOrder
    ? [...tasks].sort((a, b) => taskOrder.indexOf(a.id) - taskOrder.indexOf(b.id))
    : tasks

  async function moveTask(id: string, dir: 'up' | 'down') {
    const ids = orderedTasks.map((t) => t.id)
    const idx = ids.indexOf(id)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === ids.length - 1) return
    const swapWith = dir === 'up' ? idx - 1 : idx + 1
    const newIds = [...ids]
    ;[newIds[idx], newIds[swapWith]] = [newIds[swapWith], newIds[idx]]
    setTaskOrder(newIds)
    try {
      await reorderTasks(newIds)
    } catch {
      setError('Kunne ikke endre rekkefølge')
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  async function handleShowQR() {
    setShowQR(true)
    if (!qrDataUrl) {
      const url = await QRCodeLib.toDataURL(REBUS_URL, {
        width: 280,
        margin: 2,
        color: { dark: '#ffffff', light: '#0a0a0a' },
      })
      setQrDataUrl(url)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(REBUS_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Laster...</div>
  }

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-display tracking-wider shrink-0">Rebus Admin</h1>
        <div className="flex flex-wrap gap-2 justify-end">
          <a href={REBUS_URL} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <Eye className="h-4 w-4 mr-1" /> Vis
            </Button>
          </a>
          <Button size="sm" variant="outline" onClick={handleShowQR}>
            <QrCode className="h-4 w-4 mr-1" /> QR
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Oppdater
          </Button>
          <Button size="sm" variant="outline" onClick={() => { if (confirm('Tilbakestill alle oppgaver?')) resetAll() }}>
            <RotateCcw className="h-4 w-4 mr-1" /> Nullstill
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> Legg til
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <StartCoordsCard
        startCoords={settings.start_coords}
        onSave={async (coords) => {
          try {
            await setStart(coords)
          } catch {
            setError('Kunne ikke lagre startpunkt')
          }
        }}
      />

      {showForm && (
        <TaskForm
          onSave={async (data) => {
            try {
              await addTask(data.title, data.description, data.task_type, data.correct_answer, data.destination_coords)
              setShowForm(false)
            } catch { setError('Kunne ikke legge til oppgave') }
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {orderedTasks.map((task, i) => (
          <div key={task.id}>
            {editId === task.id ? (
              <TaskForm
                initial={task}
                onSave={async (data) => {
                  try {
                    await updateTask(task.id, data.title, data.description, data.task_type, data.correct_answer, data.destination_coords)
                    setEditId(null)
                  } catch { setError('Kunne ikke oppdatere') }
                }}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <TaskCard
                task={task}
                isFirst={i === 0}
                isLast={i === orderedTasks.length - 1}
                onMoveUp={() => moveTask(task.id, 'up')}
                onMoveDown={() => moveTask(task.id, 'down')}
                onApprove={() => approveTask(task.id).catch(() => setError('Feilet'))}
                onReject={() => rejectAnswer(task.id).catch(() => setError('Feilet'))}
                onArrived={() => markArrived(task.id).catch(() => setError('Feilet'))}
                onReset={() => resetTask(task.id).catch(() => setError('Feilet'))}
                onEdit={() => setEditId(task.id)}
                onDelete={() => { if (confirm('Slette denne oppgaven?')) deleteTask(task.id).catch(() => setError('Feilet')) }}
              />
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Ingen oppgaver ennå. Legg til en ovenfor!
            </CardContent>
          </Card>
        )}
      </div>
    </div>

    {/* QR modal */}
    {showQR && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        onClick={() => setShowQR(false)}
      >
        <div
          className="bg-card border border-border rounded-2xl p-6 space-y-4 w-80 animate-fade-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display tracking-wider">Rebus-lenke</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowQR(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR code" className="w-full rounded-lg" />
          ) : (
            <div className="w-full aspect-square bg-secondary rounded-lg animate-pulse" />
          )}
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
            <span className="flex-1 font-mono text-xs text-muted-foreground truncate">{REBUS_URL}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

const STATUS_COLORS: Record<string, string> = {
  locked: 'secondary',
  active: 'default',
  submitted: 'outline',
  rejected: 'outline',
  approved: 'default',
  completed: 'secondary',
}

const STATUS_LABELS: Record<string, string> = {
  locked: 'Låst',
  active: 'Aktiv',
  submitted: 'Innsendt',
  rejected: 'Avvist',
  approved: 'Godkjent',
  completed: 'Fullført',
}

function TaskCard({
  task, isFirst, isLast, onMoveUp, onMoveDown,
  onApprove, onReject, onArrived, onReset, onEdit, onDelete,
}: {
  task: RebusTask
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onApprove: () => void
  onReject: () => void
  onArrived: () => void
  onReset: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className={task.status === 'submitted' ? 'border-primary/50' : ''}>
      <CardContent className="py-3 px-4 space-y-2">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col shrink-0">
            <Button size="icon" variant="ghost" className="h-4 w-5 text-muted-foreground" disabled={isFirst} onClick={onMoveUp}>
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-4 w-5 text-muted-foreground" disabled={isLast} onClick={onMoveDown}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          <span className="font-medium flex-1 text-sm">{task.title}</span>
          <Badge variant={STATUS_COLORS[task.status] as 'default' | 'secondary' | 'outline'} className="text-xs">
            {STATUS_LABELS[task.status] ?? task.status}
          </Badge>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Submitted answer alert */}
        {task.status === 'submitted' && task.submitted_answer && (
          <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-2 text-sm">
            <span className="text-muted-foreground">Svar: </span>
            <span className="font-bold">{task.submitted_answer}</span>
            {task.correct_answer && (
              <span className="text-muted-foreground ml-2">
                (Forventet: <span className="font-mono">{task.correct_answer}</span>)
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5">
          {(task.status === 'active' || task.status === 'submitted') && (
            <Button size="sm" onClick={onApprove} className="text-xs h-7">
              <CheckCircle className="h-3 w-3 mr-1" /> Godkjenn
            </Button>
          )}
          {task.status === 'submitted' && task.task_type === 'answer' && (
            <Button size="sm" variant="destructive" onClick={onReject} className="text-xs h-7">
              <XCircle className="h-3 w-3 mr-1" /> Avvis
            </Button>
          )}
          {task.status === 'approved' && (
            <Button size="sm" onClick={onArrived} className="text-xs h-7">
              <MapPin className="h-3 w-3 mr-1" /> Ankommet
            </Button>
          )}
          {task.status !== 'locked' && task.status !== 'active' && (
            <Button size="sm" variant="outline" onClick={onReset} className="text-xs h-7">
              <RotateCcw className="h-3 w-3 mr-1" /> Nullstill
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit} className="text-xs h-7">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-xs h-7 text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
            <p><span className="font-medium">Type:</span> {task.task_type === 'answer' ? 'Svar' : 'Aktivitet'}</p>
            <p><span className="font-medium">Beskrivelse:</span> {task.description}</p>
            {task.correct_answer && <p><span className="font-medium">Svar:</span> {task.correct_answer}</p>}
            {task.destination_coords && <p><span className="font-medium">Koordinater:</span> {task.destination_coords}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface TaskFormData {
  title: string
  description: string
  task_type: 'answer' | 'activity'
  correct_answer?: string
  destination_coords?: string
}

function TaskForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: RebusTask
  onSave: (data: TaskFormData) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [taskType, setTaskType] = useState<'answer' | 'activity'>(initial?.task_type ?? 'answer')
  const [correctAnswer, setCorrectAnswer] = useState(initial?.correct_answer ?? '')
  const [coords, setCoords] = useState(initial?.destination_coords ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      description: description.trim(),
      task_type: taskType,
      correct_answer: correctAnswer.trim() || undefined,
      destination_coords: coords.trim() || undefined,
    })
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{initial ? 'Rediger oppgave' : 'Ny oppgave'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input placeholder="Tittel" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <textarea
            placeholder="Beskrivelse (vises til utdrikningslaget)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
          />
          <div>
            <label className="text-sm font-medium mb-1 block">Type</label>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant={taskType === 'answer' ? 'default' : 'outline'} onClick={() => setTaskType('answer')}>
                Svar
              </Button>
              <Button type="button" size="sm" variant={taskType === 'activity' ? 'default' : 'outline'} onClick={() => setTaskType('activity')}>
                Aktivitet
              </Button>
            </div>
          </div>
          {taskType === 'answer' && (
            <Input placeholder="Riktig svar (for admin-referanse)" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
          )}
          <Input placeholder="Koordinater (f.eks. 59.9139,10.7522)" value={coords} onChange={(e) => setCoords(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? 'Lagrer...' : 'Lagre'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" /> Avbryt
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Form for the global start coordinates of the rebus run. Used as the
// "from" point for the very first leg of the route, before any task has
// been completed. Saved value lives in rebus_settings (singleton row).
function StartCoordsCard({
  startCoords,
  onSave,
}: {
  startCoords: string | null
  onSave: (coords: string) => Promise<void>
}) {
  const [coords, setCoords] = useState(startCoords ?? '')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')

  // Sync local form state when the persisted settings load/refresh.
  useEffect(() => { setCoords(startCoords ?? '') }, [startCoords])

  const parsed = parseLatLon(coords)
  const isValid = parsed !== null
  const isDirty = (coords ?? '') !== (startCoords ?? '')

  async function handleSave() {
    if (!isValid) {
      setLocalError('Ugyldige koordinater. Bruk formatet "lat,lon".')
      return
    }
    setLocalError('')
    setSaving(true)
    try {
      await onSave(coords.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          Startpunkt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Brukes som "fra"-punkt på kartet for det første oppdraget.
        </p>
        <Input
          placeholder="Koordinater (f.eks. 59.9139,10.7522)"
          value={coords}
          onChange={(e) => setCoords(e.target.value)}
        />
        {localError && <p className="text-xs text-destructive">{localError}</p>}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving || !isDirty || !isValid}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Lagrer...' : 'Lagre startpunkt'}
          </Button>
          {startCoords && !isDirty && (
            <span className="text-xs text-muted-foreground font-mono">{startCoords}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
