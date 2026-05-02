import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { setToken, setRefreshToken } from '@/shared/lib/auth'

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫']
const REVEAL_MS = 800

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from
  const [digits, setDigits] = useState([])
  const [revealIdx, setRevealIdx] = useState(-1)
  const reason = new URLSearchParams(location.search).get('reason')
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const [error, setError] = useState(() => {
    if (!isLocalhost && (location.state?.outsideHours || reason === 'outside_hours'))
      return "Ish vaqti tugadi. Tizim faqat 08:00–20:00 orasida ishlaydi."
    return ''
  })
  const [loading, setLoading] = useState(false)
  const revealTimer = useRef(null)

  const code = digits.join('')
  const complete = digits.length === 8

  function press(k) {
    setError('')
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

  // Auto-submit when 8 digits entered
  useEffect(() => {
    if (complete) handleSubmit()
  }, [complete])

  async function handleSubmit() {
    if (!complete || loading) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'OUTSIDE_HOURS' ? data.message : data.error)
        setDigits([])
        setRevealIdx(-1)
        return
      }
      setToken(data.token)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      const defaultDest = data.user?.role === 'salesmanager' ? '/admin/bookings' : '/admin'
      navigate(from ?? defaultDest, { replace: true })
    } finally {
      setLoading(false)
    }
  }

  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleKeyDown(e) {
    if (e.key === 'Backspace') { press('⌫'); return }
    if (/^\d$/.test(e.key)) press(e.key)
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const incoming = text.replace(/\D/g, '').split('')
    if (!incoming.length) return
    setError('')
    setDigits(d => [...d, ...incoming].slice(0, 8))
    setRevealIdx(-1)
  }

  // 2 groups of 4 cells (XXXX—XXXX)
  const groups = [0, 1].map(g => [0, 1, 2, 3].map(i => g * 4 + i))

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center"
      onClick={() => inputRef.current?.focus()}>
      {/* Hidden input — keyboard va paste uchun */}
      <input ref={inputRef} className="sr-only" readOnly
        onKeyDown={handleKeyDown} onPaste={handlePaste} />
      <div className="flex flex-col items-center gap-6 w-full max-w-[260px] px-4">

        {/* Logo */}
        <img src="/logo.png" alt="Jahon Bozori" className="h-36 object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />

        {/* OTP — bir qator */}
        <div className="flex items-center gap-2">
          {groups.map((group, gi) => (
            <div key={gi} className="flex items-center gap-1">
              {gi > 0 && <span className="text-muted-foreground/30 text-sm select-none mx-0.5">—</span>}
              {group.map(idx => {
                const filled = idx < digits.length
                const revealed = idx === revealIdx
                return (
                  <div key={idx} className={`w-7 h-9 flex items-center justify-center rounded-lg border-2 transition-all duration-150 select-none ${
                    filled ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
                  }`}>
                    {filled ? (
                      revealed
                        ? <span className="text-sm font-bold text-primary font-mono">{digits[idx]}</span>
                        : <span className="text-primary">•</span>
                    ) : (
                      <span className="text-muted-foreground/30 text-sm">·</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {loading && <p className="text-xs text-muted-foreground text-center -mt-2">Kirilmoqda...</p>}
        {error && <p className="text-xs text-red-500 text-center -mt-2">{error}</p>}

        {/* Numpad */}
        <div className="w-full grid grid-cols-3 gap-2" style={{ gridTemplateRows: 'repeat(4, 56px)' }}>
          {PAD.map((k, i) =>
            k === '' ? <div key={i} /> :
            k === '⌫' ? (
              <button key={i} type="button"
                onPointerDown={e => { e.preventDefault(); press('⌫') }}
                className="rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center active:scale-95 transition-transform select-none touch-manipulation hover:bg-muted">
                <svg width="20" height="15" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9L3 9z"/>
                  <line x1="13" y1="7" x2="17" y2="11"/><line x1="17" y1="7" x2="13" y2="11"/>
                </svg>
              </button>
            ) : (
              <button key={i} type="button"
                onPointerDown={e => { e.preventDefault(); press(k) }}
                className="rounded-2xl bg-muted/60 text-foreground text-xl font-semibold flex items-center justify-center active:scale-95 active:bg-primary active:text-primary-foreground transition-all select-none touch-manipulation hover:bg-muted">
                {k}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
