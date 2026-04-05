import { useState } from 'react'
import { useContestants } from '@/hooks/use-contestants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Users, Plus, Trash2, Pencil, Check, X } from 'lucide-react'

export function ContestantsPage() {
  const { contestants, loading, addContestant, updateContestant, deleteContestant } = useContestants()
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    try {
      await addContestant(newName.trim())
      setNewName('')
    } catch (err) {
      setError('Failed to add contestant')
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return
    try {
      await updateContestant(id, editName.trim())
      setEditId(null)
    } catch {
      setError('Failed to update')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteContestant(id)
    } catch {
      setError('Failed to delete')
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        <h1 className="text-xl font-bold">Contestants</h1>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          placeholder="New contestant name"
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
            <CardContent className="flex items-center justify-between py-2 px-4">
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
                  <span className="font-medium">{c.name}</span>
                  <div className="flex gap-1">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
