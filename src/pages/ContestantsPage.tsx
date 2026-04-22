import { useState } from 'react'
import { useContestants } from '@/hooks/use-contestants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Users, Plus, Trash2, Pencil, Check, X, ImagePlus, User, Key } from 'lucide-react'

export function ContestantsPage() {
  const { contestants, loading, addContestant, updateContestant, updateAvatar, deleteContestant, setPlayerPin } = useContestants()
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [avatarEditId, setAvatarEditId] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [error, setError] = useState('')
  const [pinEditId, setPinEditId] = useState<string | null>(null)
  const [pinValue, setPinValue] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    try {
      await addContestant(newName.trim())
      setNewName('')
    } catch {
      setError('Kunne ikke legge til deltaker')
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return
    try {
      await updateContestant(id, editName.trim())
      setEditId(null)
    } catch {
      setError('Kunne ikke oppdatere')
    }
  }

  async function handleAvatarSave(id: string) {
    try {
      await updateAvatar(id, avatarUrl.trim())
      setAvatarEditId(null)
      setAvatarUrl('')
    } catch {
      setError('Kunne ikke oppdatere bilde')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteContestant(id)
    } catch {
      setError('Kunne ikke slette')
    }
  }

  async function handlePinSave(id: string) {
    if (pinValue.length !== 4) return
    setError('')
    try {
      await setPlayerPin(id, pinValue.trim())
      setPinEditId(null)
      setPinValue('')
    } catch {
      setError('Kunne ikke sette PIN')
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Laster...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        <h1 className="text-xl font-display tracking-wider">Deltakere</h1>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          placeholder="Navn på ny deltaker"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {contestants.map((c) => (
          <Card key={c.id}>
            <CardContent className="py-2 px-4 space-y-2">
              <div className="flex items-center justify-between">
                {editId === c.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(c.id)}
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleUpdate(c.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      {c.avatar_url ? (
                        <img
                          src={c.avatar_url}
                          alt={c.name}
                          className="w-9 h-9 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setAvatarEditId(avatarEditId === c.id ? null : c.id)
                          setAvatarUrl(c.avatar_url ?? '')
                        }}
                        title="Endre bilde"
                      >
                        <ImagePlus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditId(c.id); setEditName(c.name) }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Avatar URL editor */}
              {avatarEditId === c.id && (
                <div className="flex gap-2 items-center pl-12">
                  <Input
                    placeholder="Bilde-URL (https://...)"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="flex-1 text-xs"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAvatarSave(c.id)}
                  />
                  {avatarUrl.trim() && (
                    <img
                      src={avatarUrl}
                      alt="Forhåndsvisning"
                      className="w-8 h-8 rounded-full object-cover border border-border"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleAvatarSave(c.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAvatarEditId(null); setAvatarUrl('') }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* PIN editor */}
              {pinEditId === c.id ? (
                <div className="flex gap-2 items-center pl-12">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4-sifret PIN"
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onKeyDown={(e) => e.key === 'Enter' && handlePinSave(c.id)}
                    autoFocus
                    className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm font-mono tracking-widest text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="sm" variant="ghost" onClick={() => handlePinSave(c.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPinEditId(null); setPinValue('') }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pl-12">
                  <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground flex-1">
                    {c.pin_hash ? '••••' : 'Ingen PIN'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => { setPinEditId(c.id); setPinValue('') }}
                  >
                    {c.pin_hash ? 'Endre' : 'Sett'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
