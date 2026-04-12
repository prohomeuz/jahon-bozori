import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'
import { UserPlus } from 'lucide-react'

function UserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', telegram_id: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    onCreated?.()
    onClose()
  }

  const FIELDS = [
    { key: 'name',        label: "F.I.O.",        placeholder: 'Abdulloh Karimov', type: 'text',     required: true  },
    { key: 'username',    label: 'Username',       placeholder: 'a.karimov',        type: 'text',     required: true  },
    { key: 'password',    label: 'Parol',          placeholder: '••••••••',         type: 'password', required: true  },
    { key: 'telegram_id', label: 'Telegram ID',    placeholder: '123456789',        type: 'text',     required: true  },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-5">Yangi Salesmanager</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {FIELDS.map(({ key, label, placeholder, type, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1.5">
                {label}
                {!required && <span className="ml-1 text-xs text-muted-foreground">(ixtiyoriy)</span>}
              </label>
              <input
                type={type}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={required}
              />
            </div>
          ))}
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

export default function ManagersPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch('/api/users').then(r => r.json()),
  })
  const users = Array.isArray(data) ? data : []

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Salesmanagerlar</h1>
        <button
          onClick={() => setShowModal(true)}
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
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Telegram ID</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Qo'shilgan</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3.5 font-medium">{u.name}</td>
                <td className="px-4 py-3.5 font-mono text-muted-foreground">{u.username}</td>
                <td className="px-4 py-3.5 font-mono text-muted-foreground">
                  {u.telegram_id ?? <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString('uz-UZ')}
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

      {showModal && (
        <UserModal
          onClose={() => setShowModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
        />
      )}
    </div>
  )
}
