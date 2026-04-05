import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useActivities } from '@/hooks/use-activities'
import { useContestants } from '@/hooks/use-contestants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Gamepad2, Plus, ChevronRight } from 'lucide-react'
import { VALID_FORMATS, ACTIVITY_TYPE_LABELS, ACTIVITY_FORMAT_LABELS } from '@/lib/constants'
import type { ActivityType, ActivityFormat } from '@/lib/types'

export function ActivitiesPage() {
  const { activities, loading, addActivity } = useActivities()
  const { contestants } = useContestants()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<ActivityType>('free_for_all')
  const [format, setFormat] = useState<ActivityFormat>('free_for_all')
  const [selectedContestants, setSelectedContestants] = useState<string[]>([])
  const [numRounds, setNumRounds] = useState(1)
  const [error, setError] = useState('')

  const availableFormats = VALID_FORMATS[type]

  function handleTypeChange(newType: ActivityType) {
    setType(newType)
    const formats = VALID_FORMATS[newType]
    if (!formats.includes(format)) {
      setFormat(formats[0])
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || selectedContestants.length === 0) return
    setError('')
    try {
      await addActivity(name.trim(), type, format, selectedContestants, numRounds)
      setName('')
      setShowForm(false)
      setSelectedContestants([])
      setNumRounds(1)
    } catch {
      setError('Failed to create activity')
    }
  }

  function toggleContestant(id: string) {
    setSelectedContestants((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5" />
          <h1 className="text-xl font-bold">Activities</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Add</span>
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <form onSubmit={handleAdd} className="space-y-3">
              <Input
                placeholder="Activity name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />

              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((t) => (
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

              {(format === 'free_for_all') && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Rounds</label>
                  <Input
                    type="number"
                    min={1}
                    value={numRounds}
                    onChange={(e) => setNumRounds(parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Contestants ({selectedContestants.length} selected)
                </label>
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

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit" size="sm">Create</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
                      {a.status}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {activities.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No activities yet. Create one above!
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
