import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useActivities } from '@/hooks/use-activities'
import { useContestants } from '@/hooks/use-contestants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Gamepad2, Plus, ChevronRight, Trash2 } from 'lucide-react'
import {
  VALID_FORMATS,
  SELECTABLE_ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_FORMAT_LABELS,
  STATUS_LABELS,
  TEAM_SIZES,
  MULTI_TEAM_COUNT,
} from '@/lib/constants'
import { countAllRoundRobinMatches } from '@/lib/algorithms/round-robin'
import type { ActivityType, ActivityFormat } from '@/lib/types'

export function ActivitiesPage() {
  const { activities, loading, addActivity, deleteActivity } = useActivities()
  const { contestants } = useContestants()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<ActivityType>('free_for_all')
  const [format, setFormat] = useState<ActivityFormat>('free_for_all')
  const [selectedContestants, setSelectedContestants] = useState<string[]>([])
  // Empty string means "use the default" (alle for round_robin, 1 for team_battle).
  const [roundCountInput, setRoundCountInput] = useState('')
  const [error, setError] = useState('')

  const availableFormats = VALID_FORMATS[type]

  // For round_robin: show how many matches the algorithm would emit if we
  // didn't cap it. Recomputed whenever the roster size or team size changes.
  const allRoundRobinCount = useMemo(() => {
    if (format !== 'round_robin') return 0
    return countAllRoundRobinMatches(selectedContestants.length, TEAM_SIZES[type])
  }, [format, type, selectedContestants.length])

  const showRoundCount =
    format === 'round_robin' || format === 'team_battle' || format === 'multi_team_battle'

  // Minimum participant count per format. The form just blocks submission
  // below this; it doesn't reshuffle the roster for you.
  const minParticipants = format === 'multi_team_battle' ? MULTI_TEAM_COUNT * TEAM_SIZES[type] : 1

  // Hide events from the admin activity list -- they live on /admin/events.
  const visibleActivities = activities.filter((a) => a.type !== 'event')
  // Group by status so the admin sees ongoing work first, drafts in the
  // middle, and completed at the bottom (out of the way once awarded).
  const inProgressActivities = visibleActivities.filter((a) => a.status === 'in_progress')
  const draftActivities = visibleActivities.filter((a) => a.status === 'draft')
  const completedActivities = visibleActivities.filter((a) => a.status === 'completed')

  function handleTypeChange(newType: ActivityType) {
    setType(newType)
    const formats = VALID_FORMATS[newType]
    if (!formats.includes(format)) {
      setFormat(formats[0])
    }
  }

  // Resolve the user's round-count input into the integer we actually persist
  // on the activity. For round_robin a blank field means "alle". For
  // team_battle a blank or invalid value falls back to 1. For other formats
  // num_rounds is unused, so we just keep it at 1.
  function resolveNumRounds(): number {
    const parsed = parseInt(roundCountInput, 10)
    if (format === 'round_robin') {
      if (!roundCountInput.trim() || isNaN(parsed) || parsed <= 0) {
        return allRoundRobinCount || 1
      }
      return Math.min(parsed, allRoundRobinCount || parsed)
    }
    if (format === 'team_battle' || format === 'multi_team_battle') {
      if (!roundCountInput.trim() || isNaN(parsed) || parsed <= 0) return 1
      return parsed
    }
    return 1
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || selectedContestants.length === 0) return
    if (selectedContestants.length < minParticipants) {
      setError(`Trenger minst ${minParticipants} deltakere for dette formatet`)
      return
    }
    setError('')
    try {
      await addActivity(name.trim(), type, format, selectedContestants, resolveNumRounds())
      setName('')
      setShowForm(false)
      setSelectedContestants([])
      setRoundCountInput('')
    } catch {
      setError('Kunne ikke opprette aktivitet')
    }
  }

  function toggleContestant(id: string) {
    setSelectedContestants((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  function toggleAllContestants() {
    if (selectedContestants.length === contestants.length) {
      setSelectedContestants([])
    } else {
      setSelectedContestants(contestants.map((c) => c.id))
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Slette "${name}"? Alle kamper og poeng for denne aktiviteten forsvinner.`)) return
    try {
      await deleteActivity(id)
    } catch {
      setError('Kunne ikke slette aktivitet')
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Laster...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5" />
          <h1 className="text-xl font-display tracking-wider">Aktiviteter</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Legg til</span>
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <form onSubmit={handleAdd} className="space-y-3">
              <Input
                placeholder="Aktivitetsnavn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />

              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <div className="flex flex-wrap gap-1">
                  {SELECTABLE_ACTIVITY_TYPES.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={type === t ? 'default' : 'outline'}
                      onClick={() => handleTypeChange(t)}
                    >
                      {ACTIVITY_TYPE_LABELS[t]}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Format</label>
                <div className="flex flex-wrap gap-1">
                  {availableFormats.map((f) => (
                    <Button
                      key={f}
                      type="button"
                      size="sm"
                      variant={format === f ? 'default' : 'outline'}
                      onClick={() => setFormat(f)}
                    >
                      {ACTIVITY_FORMAT_LABELS[f]}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">
                    Deltakere ({selectedContestants.length} valgt)
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={toggleAllContestants}
                  >
                    {selectedContestants.length === contestants.length && contestants.length > 0
                      ? 'Fjern alle'
                      : 'Velg alle'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {contestants.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      size="sm"
                      variant={selectedContestants.includes(c.id) ? 'default' : 'outline'}
                      onClick={() => toggleContestant(c.id)}
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
              </div>

              {showRoundCount && (
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {format === 'round_robin' ? 'Maks kamper' : 'Antall omganger'}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    className="w-28"
                    placeholder={
                      format === 'round_robin'
                        ? allRoundRobinCount > 0
                          ? `${allRoundRobinCount} (alle)`
                          : 'Alle'
                        : '1'
                    }
                    value={roundCountInput}
                    onChange={(e) => setRoundCountInput(e.target.value)}
                  />
                  {format === 'team_battle' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Spillerne deles tilfeldig i to lag som spiller mot hverandre.
                    </p>
                  )}
                  {format === 'multi_team_battle' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Spillerne deles tilfeldig i 4 lag (2 per lag). Alle lag konkurrerer
                      mot hverandre hver runde. Trenger minst {MULTI_TEAM_COUNT * TEAM_SIZES[type]} deltakere.
                    </p>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit" size="sm">Opprett</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {visibleActivities.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Ingen aktiviteter ennå. Opprett en ovenfor!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <ActivitySection
            title="Pågår"
            activities={inProgressActivities}
            onDelete={handleDelete}
            emptyText="Ingen pågående aktiviteter."
          />
          <ActivitySection
            title="Utkast"
            activities={draftActivities}
            onDelete={handleDelete}
            emptyText="Ingen utkast."
          />
          <ActivitySection
            title="Fullført"
            activities={completedActivities}
            onDelete={handleDelete}
            emptyText="Ingen fullførte aktiviteter ennå."
          />
        </div>
      )}
    </div>
  )
}

function ActivitySection({
  title,
  activities,
  onDelete,
  emptyText,
}: {
  title: string
  activities: { id: string; name: string; type: ActivityType; format: ActivityFormat; status: 'draft' | 'in_progress' | 'completed' }[]
  onDelete: (e: React.MouseEvent, id: string, name: string) => void
  emptyText: string
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-display tracking-widest text-muted-foreground px-1">
        {title} ({activities.length})
      </h2>
      {activities.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 italic">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <Link key={a.id} to={`/admin/activities/${a.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="space-y-1">
                    <div className="font-medium">{a.name}</div>
                    <div className="flex gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {ACTIVITY_TYPE_LABELS[a.type]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {ACTIVITY_FORMAT_LABELS[a.format]}
                      </Badge>
                      <Badge
                        variant={a.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {STATUS_LABELS[a.status] ?? a.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => onDelete(e, a.id, a.name)}
                      aria-label="Slett aktivitet"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
