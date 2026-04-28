import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'
import { UserPlus, Pencil, Trash2, Eye, EyeOff, Copy, Check, RefreshCw } from 'lucide-react'

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫']
const REVEAL_MS = 800

function genCode() {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')
}

// OTP-style kredit karta ko'rinishi (4×4)
function CodeDisplay({ digits, revealIdx }) {
  const groups = [0,1].map(g => [0,1,2,3].map(i => g*4+i))
  const complete = digits.length === 16
  return (
    <div className="flex items-center gap-2 justify-center">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-1">
          {gi > 0 && <span className="text-muted-foreground/40 text-base select-none mx-0.5">—</span>}
          {group.map(idx => {
            const filled = idx < digits.length
            const revealed = idx === revealIdx
            return (
              <div key={idx} className={`w-7 h-9 flex items-center justify-center rounded-md border-2 transition-all duration-150 ${
                filled
                  ? complete ? 'border-green-500 bg-green-50' : 'border-primary bg-primary/5'
                  : 'border-border bg-muted/30'
              }`}>
                {filled ? (
                  revealed
                    ? <span className={`text-sm font-bold font-mono ${complete ? 'text-green-600' : 'text-primary'}`}>{digits[idx]}</span>
                    : <span className={`text-base ${complete ? 'text-green-600' : 'text-primary'}`}>•</span>
                ) : (
                  <span className="text-muted-foreground/30 text-sm">·</span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function UserModal({ user, onClose, onDone }) {
  const isEdit = !!user
  const [name, setName] = useState(user?.name ?? '')
  const [digits, setDigits] = useState([])
  const [revealIdx, setRevealIdx] = useState(-1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const revealTimer = useRef(null)
  const inputRef = useRef(null)

  const password = digits.join('')
  const pwComplete = digits.length === 8
  const canSave = name.trim() && (isEdit ? true : pwComplete)

  function press(k) {
    if (k === '⌫') {
      setDigits(d => d.slice(0, -1))
      setRevealIdx(-1)
      clearTimeout(revealTimer.current)
      return
    }
    if (digits.length >= 8) return
    const idx = digits.length
    setDigits(d => [...d, k])
    setRevealIdx(idx)
    clearTimeout(revealTimer.current)
    revealTimer.current = setTimeout(() => setRevealIdx(-1), REVEAL_MS)
  }

  function handleKeyDown(e) {
    if (e.key === 'Backspace') { press('⌫'); return }
    if (/^\d$/.test(e.key)) press(e.key)
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const incoming = text.replace(/\D/g, '').split('')
    if (!incoming.length) return
    setDigits(d => [...d, ...incoming].slice(0, 8))
    setRevealIdx(-1)
  }

  function fillRandom() {
    const code = genCode()
    setDigits(code.split(''))
    setRevealIdx(-1)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave) return
    setLoading(true)
    setError('')
    const body = { name }
    if (password) body.password = password
    const res = await apiFetch(
      isEdit ? `/api/users/${user.id}` : '/api/users',
      { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-5">{isEdit ? 'Tahrirlash' : 'Yangi Salesmanager'}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Ism-familiya</label>
            <input
              type="text"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              placeholder="Abdulloh Karimov"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => { if (name.trim()) inputRef.current?.focus({ preventScroll: true }) }}
              required
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Parol (8 raqam)
                {isEdit && <span className="ml-1 text-xs text-muted-foreground">(o'zgartirmaslik uchun bo'sh qoldiring)</span>}
              </label>
              <button type="button" onClick={fillRandom}
                className="flex items-center gap-1 text-xs text-primary hover:opacity-75 transition-opacity touch-manipulation">
                <RefreshCw size={11} /> Tasodifiy
              </button>
            </div>

            <CodeDisplay digits={digits} revealIdx={revealIdx} />

            <div className="grid grid-cols-3 gap-2" onClick={() => inputRef.current?.focus()}>
              <input ref={inputRef} className="sr-only" readOnly autoFocus
                onKeyDown={handleKeyDown} onPaste={handlePaste} />
              {PAD.map((k, i) =>
                k === '' ? <div key={i} /> :
                k === '⌫' ? (
                  <button key={i} type="button"
                    onPointerDown={e => { e.preventDefault(); press('⌫') }}
                    className="h-11 rounded-xl bg-muted/60 text-muted-foreground flex items-center justify-center active:scale-95 transition-transform select-none touch-manipulation">
                    <svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 3H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9L3 9z"/>
                      <line x1="13" y1="7" x2="17" y2="11"/><line x1="17" y1="7" x2="13" y2="11"/>
                    </svg>
                  </button>
                ) : (
                  <button key={i} type="button"
                    onPointerDown={e => { e.preventDefault(); press(k) }}
                    className="h-11 rounded-xl bg-muted/60 text-foreground text-lg font-semibold flex items-center justify-center active:scale-95 transition-transform select-none touch-manipulation hover:bg-muted">
                    {k}
                  </button>
                )
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors touch-manipulation">
              Bekor
            </button>
            <button type="submit" disabled={!canSave || loading}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity touch-manipulation">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-2">O'chirishni tasdiqlang</h3>
        <p className="text-sm text-muted-foreground mb-6">
          <span className="font-semibold text-foreground">{user.name}</span> o'chiriladi. Bu amalni qaytarib bo'lmaydi.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            Bekor
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors">
            {loading ? 'O\'chirilmoqda...' : 'O\'chirish'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PasswordCell({ password }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!password) return <span className="text-muted-foreground/40 text-xs">—</span>

  // Kredit karta formatida: XXXX-XXXX-XXXX-XXXX
  const formatted = visible
    ? [0,1].map(g => password.slice(g*4, g*4+4)).join('-')
    : '••••-••••'

  function copy() {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono text-sm select-none ${copied ? 'text-green-600' : 'text-foreground'}`}
        onDoubleClick={copy} title="2x bosing — nusxa olish">
        {formatted}
      </span>
      {copied
        ? <Check size={13} className="text-green-600 shrink-0" />
        : (
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setVisible(v => !v)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              title={visible ? 'Yashirish' : 'Ko\'rish'}>
              {visible ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button type="button" onClick={copy}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title="Nusxa olish">
              <Copy size={13} />
            </button>
          </div>
        )
      }
    </div>
  )
}

function ActiveToggle({ user, onDone }) {
  const cooldownRef = useRef(false)
  const { mutate, isPending } = useMutation({
    mutationFn: () => apiFetch(`/api/users/${user.id}/active`, { method: 'PATCH' }).then(r => r.json()),
    onSuccess: onDone,
    onSettled: () => { setTimeout(() => { cooldownRef.current = false }, 800) },
  })
  const active = !!user.is_active
  function handleClick() {
    if (isPending || cooldownRef.current) return
    cooldownRef.current = true
    mutate()
  }
  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={active ? 'Deaktivlash' : 'Aktivlash'}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none disabled:opacity-50 ${
        active ? 'bg-emerald-500' : 'bg-muted-foreground/30'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
        active ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

export default function ManagersPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)

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
        <button onClick={() => setModal({ type: 'create' })}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90">
          <UserPlus size={15} />
          Qo'shish
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Ism-familiya</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Parol</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Qo'shilgan</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Holat</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3.5 font-medium">{u.name}</td>
                <td className="px-4 py-3.5"><PasswordCell password={u.plain_password} /></td>
                <td className="px-4 py-3.5 text-muted-foreground">
                  <div>{new Date(u.created_at).toLocaleDateString('uz-UZ')}</div>
                  <div className="text-xs">{new Date(u.created_at).toLocaleTimeString('uz-UZ')}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <ActiveToggle user={u} onDone={refresh} />
                    <span className={`text-xs font-medium w-16 ${u.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {u.is_active ? 'Aktiv' : 'Bloklangan'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setModal({ type: 'edit', user: u })}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setModal({ type: 'delete', user: u })}
                      className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Hech kim yo'q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === 'create' && <UserModal onClose={() => setModal(null)} onDone={refresh} />}
      {modal?.type === 'edit' && <UserModal user={modal.user} onClose={() => setModal(null)} onDone={refresh} />}
      {modal?.type === 'delete' && <DeleteConfirm user={modal.user} onClose={() => setModal(null)} onDone={refresh} />}
    </div>
  )
}
