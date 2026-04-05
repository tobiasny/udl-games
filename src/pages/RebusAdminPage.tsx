import { useState } from 'react'
import { useRebus, type RebusTask } from '@/hooks/use-rebus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Trash2, RotateCcw, CheckCircle, MapPin, Pencil,
  X, Save, ChevronDown, ChevronUp,
} from 'lucide-react'

export function RebusAdminPage() {
  const {
    tasks, loading,
    approveTask, markArrived, addTask, updateTask, deleteTask,
    resetAll, resetTask,
  } = useRebus()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Rebus Admin</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { if (confirm('Reset all tasks?')) resetAll() }}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {showForm && (
        <TaskForm
          onSave={async (data) => {
            try {
              await addTask(data.title, data.description, data.task_type, data.correct_answer, data.destination_coords, data.destination_name)
              setShowForm(false)
            } catch { setError('Failed to add task') }
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id}>
            {editId === task.id ? (
              <TaskForm
                initial={task}
                onSave={async (data) => {
                  try {
                    await updateTask(task.id, data.title, data.description, data.task_type, data.correct_answer, data.destination_coords, data.destination_name)
                    setEditId(null)
                  } catch { setError('Failed to update') }
                }}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <TaskCard
                task={task}
                onApprove={() => approveTask(task.id).catch(() => setError('Failed'))}
                onArrived={() => markArrived(task.id).catch(() => setError('Failed'))}
                onReset={() => resetTask(task.id).catch(() => setError('Failed'))}
                onEdit={() => setEditId(task.id)}
                onDelete={() => { if (confirm('Delete this task?')) deleteTask(task.id).catch(() => setError('Failed')) }}
              />
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No tasks yet. Add one above!
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  locked: 'secondary',
  active: 'default',
  submitted: 'outline',
  approved: 'default',
  completed: 'secondary',
}

function TaskCard({
  task, onApprove, onArrived, onReset, onEdit, onDelete,
}: {
  task: RebusTask
  onApprove: () => void
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
          <span className="text-xs text-muted-foreground font-mono w-5">#{task.sort_order}</span>
          <span className="font-medium flex-1 text-sm">{task.title}</span>
          <Badge variant={STATUS_COLORS[task.status] as 'default' | 'secondary' | 'outline'} className="text-xs">
            {task.status}
          </Badge>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Submitted answer alert */}
        {task.status === 'submitted' && task.submitted_answer && (
          <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-2 text-sm">
            <span className="text-muted-foreground">Answer: </span>
            <span className="font-bold">{task.submitted_answer}</span>
            {task.correct_answer && (
              <span className="text-muted-foreground ml-2">
                (Expected: <span className="font-mono">{task.correct_answer}</span>)
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5">
          {(task.status === 'active' || task.status === 'submitted') && (
            <Button size="sm" onClick={onApprove} className="text-xs h-7">
              <CheckCircle className="h-3 w-3 mr-1" /> Approve
            </Button>
          )}
          {task.status === 'approved' && (
            <Button size="sm" onClick={onArrived} className="text-xs h-7">
              <MapPin className="h-3 w-3 mr-1" /> Arrived
            </Button>
          )}
          {task.status !== 'locked' && task.status !== 'active' && (
            <Button size="sm" variant="outline" onClick={onReset} className="text-xs h-7">
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
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
            <p><span className="font-medium">Type:</span> {task.task_type}</p>
            <p><span className="font-medium">Description:</span> {task.description}</p>
            {task.correct_answer && <p><span className="font-medium">Answer:</span> {task.correct_answer}</p>}
            {task.destination_coords && <p><span className="font-medium">Coords:</span> {task.destination_coords}</p>}
            {task.destination_name && <p><span className="font-medium">Destination:</span> {task.destination_name}</p>}
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
  destination_name?: string
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
  const [destName, setDestName] = useState(initial?.destination_name ?? '')
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
      destination_name: destName.trim() || undefined,
    })
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{initial ? 'Edit Task' : 'New Task'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <textarea
            placeholder="Description (shown to bachelor)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
          />
          <div>
            <label className="text-sm font-medium mb-1 block">Type</label>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant={taskType === 'answer' ? 'default' : 'outline'} onClick={() => setTaskType('answer')}>
                Answer
              </Button>
              <Button type="button" size="sm" variant={taskType === 'activity' ? 'default' : 'outline'} onClick={() => setTaskType('activity')}>
                Activity
              </Button>
            </div>
          </div>
          {taskType === 'answer' && (
            <Input placeholder="Correct answer (for admin reference)" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
          )}
          <Input placeholder="Destination coords (e.g. 59.9139,10.7522)" value={coords} onChange={(e) => setCoords(e.target.value)} />
          <Input placeholder="Destination name (optional)" value={destName} onChange={(e) => setDestName(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
