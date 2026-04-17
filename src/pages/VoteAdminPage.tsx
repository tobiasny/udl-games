import { useState } from 'react'
import { Vote, Plus, X, Square, Trash2 } from 'lucide-react'
import { useVoteSessions } from '@/hooks/use-voting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function VoteAdminPage() {
  const { sessions, loading, createSession, closeSession, deleteSession } = useVoteSessions()
  const [showForm, setShowForm] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function addOption() {
    if (options.length < 8) setOptions([...options, ''])
  }

  function removeOption(i: number) {
    if (options.length <= 2) return
    setOptions(options.filter((_, idx) => idx !== i))
  }

  function setOption(i: number, val: string) {
    setOptions(options.map((o, idx) => (idx === i ? val : o)))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const labels = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim() || labels.length < 2) {
      setError('Spørsmål og minst 2 alternativer kreves')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createSession(question.trim(), labels)
      setQuestion('')
      setOptions(['', ''])
      setShowForm(false)
    } catch {
      setError('Kunne ikke opprette avstemning')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClose(sessionId: string) {
    try {
      await closeSession(sessionId)
    } catch {
      setError('Kunne ikke avslutte')
    }
  }

  async function handleDelete(sessionId: string, q: string) {
    if (!window.confirm(`Slette "${q}"?`)) return
    try {
      await deleteSession(sessionId)
    } catch {
      setError('Kunne ikke slette')
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Laster...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5" />
          <h1 className="text-xl font-display tracking-wider">Avstemninger</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Ny</span>
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <form onSubmit={handleCreate} className="space-y-3">
              <Input
                placeholder="Spørsmål..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                autoFocus
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Alternativer</label>
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder={`Alternativ ${i + 1}`}
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      disabled={options.length <= 2}
                      onClick={() => removeOption(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {options.length < 8 && (
                  <Button type="button" size="sm" variant="outline" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-1" /> Legg til alternativ
                  </Button>
                )}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? 'Oppretter...' : 'Start avstemning'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Ingen avstemninger ennå.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id}>
              <CardContent className="py-4 px-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium">{s.question}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.status === 'open' ? 'default' : 'secondary'}>
                        {s.status === 'open' ? 'Åpen' : 'Lukket'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{s.totalVotes} stemmer</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {s.status === 'open' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleClose(s.id)}
                        title="Avslutt"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(s.id, s.question)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {s.options.map((opt) => {
                    const pct = s.totalVotes > 0 ? Math.round((opt.voteCount / s.totalVotes) * 100) : 0
                    return (
                      <div key={opt.id} className="space-y-0.5">
                        <div className="flex justify-between text-sm">
                          <span>{opt.label}</span>
                          <span className="font-display">{opt.voteCount} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
