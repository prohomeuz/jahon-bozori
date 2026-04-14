import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'
import { UserPlus, Pencil, Trash2 } from 'lucide-react'

function UserModal({ user, onClose, onDone }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    name:     user?.name     ?? '',
    username: user?.username ?? '',
    password: '',
  })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await apiFetch(
      isEdit ? `/api/users/${user.id}` : '/api/users',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }
    )
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    onDone()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-5">
          {isEdit ? 'Tahrirlash' : 'Yangi Salesmanager'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">F.I.O.</label>
            <input
              type="text"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              placeholder="Abdulloh Karimov"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Username</label>
            <input
              type="text"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              placeholder="a.karimov"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Parol
              {isEdit && <span className="ml-1 text-xs text-muted-foreground">(bo'sh qolsa o'zgarmaydi)</span>}
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required={!isEdit}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Bekor
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirm({ user, onClose, onDone }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' })
    setLoading(false)
    onDone()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-2">O'chirishni tasdiqlang</h3>
        <p className="text-sm text-muted-foreground mb-6">
          <span className="font-semibold text-foreground">{user.name}</span> o'chiriladi. Bu amalni qaytarib bo'lmaydi.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Bekor
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
          >
            {loading ? 'O\'chirilmoqda...' : 'O\'chirish'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ManagersPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null) // null | { type: 'create' | 'edit' | 'delete', user? }

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch('/api/users').then(r => r.json()),
  })
  const users = Array.isArray(data) ? data : []

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Salesmanagerlar</h1>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90"
        >
          <UserPlus size={15} />
          Qo'shish
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">F.I.O.</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Username</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Qo'shilgan</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3.5 font-medium">{u.name}</td>
                <td className="px-4 py-3.5 font-mono text-muted-foreground">{u.username}</td>
                <td className="px-4 py-3.5 text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString('uz-UZ')}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setModal({ type: 'edit', user: u })}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setModal({ type: 'delete', user: u })}
                      className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Hech kim yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === 'create' && (
        <UserModal onClose={() => setModal(null)} onDone={refresh} />
      )}
      {modal?.type === 'edit' && (
        <UserModal user={modal.user} onClose={() => setModal(null)} onDone={refresh} />
      )}
      {modal?.type === 'delete' && (
        <DeleteConfirm user={modal.user} onClose={() => setModal(null)} onDone={refresh} />
      )}
    </div>
  )
}
