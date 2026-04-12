import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { setToken } from '@/shared/lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from ?? '/'
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error)
      setToken(data.token)
      navigate(from, { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="w-full max-w-sm mx-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Jahon Bozori</h1>
          <p className="text-muted-foreground text-sm mt-1">Boshqaruv paneli</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-lg flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
            <input
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="admin"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Parol</label>
            <input
              type="password"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-opacity disabled:opacity-50"
          >
            {loading ? 'Kirilmoqda...' : 'Kirish'}
          </button>
        </form>
      </div>
    </div>
  )
}
