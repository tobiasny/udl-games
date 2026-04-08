import { useState } from 'react'
import { useEvents, type Event } from '@/hooks/use-events'
import { useContestants } from '@/hooks/use-contestants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Plus, Trash2, Pencil, Check, X } from 'lucide-react'

// Admin-only page for point-award events. Each event is a flat "X gets N
// Mats Munny" entry that shows up immediately on the leaderboard and in the
// public activity list. This page is the only place they're created/edited/
// deleted; they're hidden from /admin/activities to keep that list focused on
// real competitions.
export function EventsPage() {
  const { events, loading, addEvent, updateEvent, deleteEvent } = useEvents()
  const { contestants } = useContestants()

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [contestantId, setContestantId] = useState<string>('')
  const [pointsInput, setPointsInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const contestantMap = new Map(contestants.map((c) => [c.id, c]))
  function getContestantName(id: string): string {
    return contestantMap.get(id)?.name ?? 'Ukjent'
  }

  function resetForm() {
    setTitle('')
    setContestantId('')
    setPointsInput('')
    setEditingId(null)
    setError('')
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(event: Event) {
    setTitle(event.title)
    setContestantId(event.contestant_id)
    setPointsInput(String(event.points))
    setEditingId(event.id)
    setShowForm(true)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseInt(pointsInput, 10)
    if (!title.trim() || !contestantId || isNaN(parsed)) {
      setError('Fyll inn tittel, deltaker og poeng')
      return
    }
    setError('')
    try {
      if (editingId) {
        await updateEvent(editingId, title.trim(), contestantId, parsed)
      } else {
        await addEvent(title.trim(), contestantId, parsed)
      }
      resetForm()
      setShowForm(false)
    } catch {
      setError('Kunne ikke lagre event')
    }
  }

  async function handleDelete(event: Event) {
    if (!window.confirm(`Slette event "${event.title}"? Poengene fjernes fra ledertavlen.`)) return
    try {
      await deleteEvent(event.id)
    } catch {
      setError('Kunne ikke slette event')
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Laster...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <h1 className="text-xl font-display tracking-wider">Events</h1>
        </div>
        {!showForm && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Nytt event</span>
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Del ut bonuspoeng som ikke hører til en vanlig aktivitet. Eventet dukker
        opp på ledertavlen og i aktivitetsoversikten umiddelbart.
      </p>

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                placeholder="Tittel (f.eks. 'Danset best på festen')"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />

              <div>
                <label className="text-sm font-medium mb-1 block">Deltaker</label>
                <div className="flex flex-wrap gap-1">
                  {contestants.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      size="sm"
                      variant={contestantId === c.id ? 'default' : 'outline'}
                      onClick={() => setContestantId(c.id)}
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Poeng (MM)</label>
                <Input
                  type="number"
                  className="w-28"
                  placeholder="f.eks. 5"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Bruk et negativt tall for å trekke fra poeng.
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  <Check className="h-4 w-4 mr-1" />
                  {editingId ? 'Oppdater' : 'Opprett'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setShowForm(false)
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {events.map((event) => (
          <Card key={event.id}>
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="font-medium truncate">{event.title}</div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {getContestantName(event.contestant_id)}
                  </Badge>
                  <Badge
                    variant={event.points >= 0 ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {event.points >= 0 ? `+${event.points}` : event.points} MM
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => openEdit(event)}
                  aria-label="Rediger event"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(event)}
                  aria-label="Slett event"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {events.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Ingen events ennå. Lag et ovenfor!
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
