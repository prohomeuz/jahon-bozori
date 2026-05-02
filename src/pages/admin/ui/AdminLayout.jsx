import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { getUser, getToken, removeToken, apiFetch } from '@/shared/lib/auth'
import { startInactivityWatcher } from '@/shared/lib/inactivity'
import { LayoutDashboard, Users, ClipboardList, LogOut, Home, PanelLeftClose, PanelLeftOpen, KeyRound, CheckCircle, Tag, MapPin, WifiOff, Wifi, ShieldOff, Radio } from 'lucide-react'
import { useBlockedState } from '@/shared/hooks/useBlockedState'
import { BlockedOverlay } from '@/shared/ui/BlockedOverlay'

const NAV = [
  { to: '/admin',              label: 'Dashboard',          icon: LayoutDashboard, end: true },
  { to: '/admin/bookings',     label: 'Bitimlar',            icon: ClipboardList },
  { to: '/admin/joylar',       label: 'Joylar',              icon: MapPin },
  { to: '/admin/managers',     label: 'Salesmanagerlar',     icon: Users,           adminOnly: true },
  { to: '/admin/prices',       label: 'Narxlar',             icon: Tag,             adminOnly: true },
  { to: '/admin/sales-lock',   label: "Sotuvni to'xtatish",  icon: ShieldOff,       adminOnly: true },
  { to: '/admin/sources',      label: 'Manbaalar',           icon: Radio,           adminOnly: true },
]

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫']

function CodeDots({ value }) {
  const groups = [0,1].map(g => [0,1,2,3].map(i => g*4+i))
  return (
    <div className="flex items-center gap-2 justify-center">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-1">
          {gi > 0 && <span className="text-muted-foreground/40 text-base select-none mx-0.5">—</span>}
          {group.map(idx => {
            const filled = idx < value.length
            return (
              <div key={idx} className={`w-7 h-9 flex items-center justify-center rounded-md border-2 transition-all ${
                filled ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
              }`}>
                {filled
                  ? <span className="text-base text-primary">•</span>
                  : <span className="text-muted-foreground/30 text-sm">·</span>
                }
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function CodeNumpad({ value, onChange }) {
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function press(k) {
    if (k === '⌫') { onChange(v => v.slice(0, -1)); return }
    if (value.length >= 8) return
    onChange(v => v + k)
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
    onChange(v => (v + incoming.join('')).slice(0, 8))
  }

  return (
    <div className="grid grid-cols-3 gap-2.5" onClick={() => inputRef.current?.focus()}>
      <input ref={inputRef} className="sr-only" readOnly
        onKeyDown={handleKeyDown} onPaste={handlePaste} />
      {PAD.map((k, i) =>
        k === '' ? <div key={i} /> :
        k === '⌫' ? (
          <button key={i} type="button"
            onPointerDown={e => { e.preventDefault(); press('⌫') }}
            className="h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center active:scale-95 transition-transform select-none touch-manipulation">
            <svg width="20" height="15" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9L3 9z"/>
              <line x1="13" y1="7" x2="17" y2="11"/><line x1="17" y1="7" x2="13" y2="11"/>
            </svg>
          </button>
        ) : (
          <button key={i} type="button"
            onPointerDown={e => { e.preventDefault(); press(k) }}
            className="h-12 rounded-2xl bg-muted/60 text-foreground text-xl font-semibold flex items-center justify-center active:scale-95 transition-transform select-none touch-manipulation hover:bg-muted">
            {k}
          </button>
        )
      )}
    </div>
  )
}

function ChangePasswordModal({ onClose }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (next.length !== 8 || loading) return
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error?.includes('Joriy')) { setStep(1); setCurrent(''); setNext('') }
        setError(data.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setSuccess(true)
      setTimeout(onClose, 1600)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle size={48} className="text-green-500" />
            <p className="text-base font-semibold text-center">Parol muvaffaqiyatli o'zgartirildi</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Parolni o'zgartirish</h3>
              <div className="flex gap-1.5">
                <div className={`w-6 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`w-6 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {step === 1 ? 'Joriy parolni kiriting' : 'Yangi parolni kiriting'}
            </p>

            <CodeDots value={step === 1 ? current : next} />
            {error && <p className="text-sm text-red-500 text-center -mt-2">{error}</p>}

            <CodeNumpad
              key={step}
              value={step === 1 ? current : next}
              onChange={step === 1 ? setCurrent : setNext}
            />

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors touch-manipulation">
                Bekor
              </button>
              {step === 1 ? (
                <button type="button"
                  onClick={() => { setError(''); setStep(2) }}
                  disabled={current.length !== 8}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity touch-manipulation">
                  Keyingi →
                </button>
              ) : (
                <button type="button" onClick={submit}
                  disabled={next.length !== 8 || loading}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity touch-manipulation">
                  {loading ? 'Saqlanmoqda...' : 'O\'zgartirish'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function tashkentHour() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' })).getHours()
}
function isOutside() { const h = tashkentHour(); return h < 8 || h >= 20 }

function useWorkingHours(isAdmin) {
  const [outsideHours, setOutsideHours] = useState(() => !isAdmin && isOutside())

  useEffect(() => {
    if (isAdmin) return
    // Hozir ish vaqtida bo'lsak — aniq 20:00 gacha bir martalik timer
    // Tashqarida bo'lsak — darhol ko'rsatilgan, qo'shimcha timer kerak emas
    if (isOutside()) return
    const now    = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }))
    const target = new Date(now)
    target.setHours(20, 0, 0, 0)
    const ms = Math.max(0, target - now)
    const id = setTimeout(() => setOutsideHours(true), ms)
    return () => clearTimeout(id)
  }, [isAdmin])

  return outsideHours
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const outsideHours = useWorkingHours(isAdmin)
  const [collapsed, setCollapsed] = useState(
    () => document.cookie.split(';').some(c => c.trim() === 'sidebar=collapsed')
  )

  function toggleCollapsed() {
    setCollapsed(v => {
      const next = !v
      document.cookie = `sidebar=${next ? 'collapsed' : 'open'};path=/;max-age=31536000`
      return next
    })
  }
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [forcedOut, setForcedOut] = useState(false)
  const isBlocked = useBlockedState({ hasRealtimeApts: true })
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    function handleOffline() { setIsOnline(false); setShowReconnected(false) }
    function handleOnline()  { setIsOnline(true);  setShowReconnected(true); setTimeout(() => setShowReconnected(false), 3000) }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online',  handleOnline)
    return () => { window.removeEventListener('offline', handleOffline); window.removeEventListener('online', handleOnline) }
  }, [])

  useEffect(() => {
    if (!user) navigate('/admin/login', { replace: true })
  }, [])


  useEffect(() => {
    if (!user) return
    return startInactivityWatcher()
  }, [])

  useEffect(() => {
    if (isAdmin) return
    const token = getToken()
    if (!token) return

    let stopped = false
    const controller = new AbortController()

    async function connect() {
      try {
        const res = await fetch('/api/events', {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || !res.body) return
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop()
          for (const part of parts) {
            const eventLine = part.match(/^event: (.+)/m)
            const dataLine = part.match(/^data: (.+)/m)
            if (!dataLine) continue
            const event = eventLine?.[1] ?? 'message'
            if (event === 'user_invalidated') {
              const detail = JSON.parse(dataLine[1])
              const { id, blocked } = detail
              if (id === user?.sub) {
                if (blocked === true || blocked === false) {
                  // useBlockedState window event orqali boshqaradi
                  window.dispatchEvent(new CustomEvent('user-invalidated', { detail }))
                } else {
                  // Ma'lumot o'zgardi yoki o'chirildi — chiqarish
                  setForcedOut(true)
                  setTimeout(() => { removeToken(); navigate('/admin/login', { replace: true }) }, 3000)
                }
                return
              }
            }
            if (event === 'working_hours_ended') {
              removeToken()
              window.location.href = '/admin/login?reason=outside_hours'
              return
            }
          }
        }
      } catch {}
    }

    async function loop() {
      while (!stopped) {
        await connect()
        if (!stopped) await new Promise(r => setTimeout(r, 3000))
      }
    }
    loop()

    return () => { stopped = true; controller.abort() }
  }, [isAdmin, user?.id])

  function logout() {
    removeToken()
    navigate('/admin/login', { replace: true })
  }

  if (!user) return null

  return (
    <div className="fixed inset-0 flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-14' : 'w-52'} shrink-0 border-r border-border flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden`}>
        {/* Header */}
        <div className={`h-15 border-b border-border flex items-center shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate">Jahon Bozori</p>
              <p className="text-xs text-muted-foreground">Boshqaruv paneli</p>
            </div>
          )}
          <button onClick={toggleCollapsed}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title={collapsed ? 'Kengaytirish' : 'Yig\'ish'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
          {NAV.filter(n => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl text-sm font-medium transition-colors
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
                ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`
              }>
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="p-2 border-t border-border flex flex-col gap-1">
          {!isAdmin && (
            <button onClick={() => setShowChangePw(true)}
              title={collapsed ? 'Parolni o\'zgartirish' : undefined}
              className={`flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5 text-left'}`}>
              <KeyRound size={16} className="shrink-0" />
              {!collapsed && <span>Parolni o'zgartirish</span>}
            </button>
          )}
          <NavLink to="/" title={collapsed ? 'Bosh sahifa' : undefined}
            className={`flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors
              ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}`}>
            <Home size={16} className="shrink-0" />
            {!collapsed && <span>Bosh sahifa</span>}
          </NavLink>
          <button onClick={() => setShowLogoutConfirm(true)}
            title={collapsed ? 'Chiqish' : undefined}
            className={`flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full
              ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5 text-left'}`}>
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Chiqish</span>}
          </button>
        </div>

        {/* User info */}
        <div className={`border-t border-border flex items-center gap-2 shrink-0 ${collapsed ? 'justify-center px-0 py-3' : 'px-3 py-3'}`}>
          {collapsed ? (
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0" title={user.name}>
              {user.name?.[0]?.toUpperCase()}
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? 'Admin' : 'Salesmanager'}</p>
            </div>
          )}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto min-w-0 relative">
        <Outlet />
        {/* Ish vaqtidan tashqarida — salesmanager uchun overlay */}
        {outsideHours && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 bg-background border border-border rounded-3xl shadow-2xl px-10 py-10 max-w-sm w-full text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Ish vaqti tugadi</p>
                <p className="text-sm text-muted-foreground mt-1">Tizim faqat <span className="font-semibold text-foreground">08:00 – 20:00</span> orasida ishlaydi</p>
              </div>
              <p className="text-xs text-muted-foreground">Ertaga 08:00 dan davom etishingiz mumkin</p>
              <button onClick={() => { removeToken(); navigate('/admin/login', { replace: true }) }}
                className="mt-1 w-full py-2.5 rounded-xl bg-muted hover:bg-muted/70 text-sm font-medium transition-all">
                Chiqish
              </button>
            </div>
          </div>
        )}
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={e => e.target === e.currentTarget && setShowLogoutConfirm(false)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Chiqishni tasdiqlang</h3>
            <p className="text-sm text-muted-foreground mb-6">Tizimdan chiqmoqchimisiz?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Bekor
              </button>
              <button onClick={logout}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">
                Chiqish
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

      {forcedOut && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center pb-10 pointer-events-none">
          <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-medium max-w-sm text-center animate-in slide-in-from-bottom-4 duration-300">
            Sizning ma'lumotlaringiz o'zgartirildi. Tizimdan chiqarilmoqdasiz...
          </div>
        </div>
      )}

      {isBlocked && <BlockedOverlay />}

      {/* Offline overlay — blocks all interaction */}
      {!isOnline && (
        <div className="fixed inset-0 z-70 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <WifiOff size={26} strokeWidth={1.5} className="text-zinc-500" />
            </div>
            <p className="text-base font-semibold text-foreground">Internet aloqasi uzildi</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">Ulanish tiklanishi kutilmoqda...</p>
          </div>
        </div>
      )}

      {/* Reconnected toast */}
      {showReconnected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-70 pointer-events-none">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold bg-emerald-500 text-white">
            <Wifi size={15} strokeWidth={2} className="shrink-0" />
            Internet aloqasi tiklandi
          </div>
        </div>
      )}
    </div>
  )
}
