import { useState, useEffect } from 'react'

export const INPUT =
  'w-full rounded-xl border border-border bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow uppercase placeholder:uppercase'
export const LABEL = 'block text-sm font-medium text-foreground mb-1.5'

export function formatUzPhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.startsWith('998') && digits.length > 9) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  digits = digits.slice(0, 9)
  let out = '+998'
  if (digits.length > 0) out += ' ' + digits.slice(0, 2)
  if (digits.length > 2) out += ' ' + digits.slice(2, 5)
  if (digits.length > 5) out += ' ' + digits.slice(5, 7)
  if (digits.length > 7) out += ' ' + digits.slice(7, 9)
  return out
}

export function getRawDigits(val) {
  let str = String(val ?? '')
  if (str.startsWith('+998')) str = str.slice(4)
  let d = str.replace(/\D/g, '')
  if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 9)
}

export function formatPassport(raw) {
  const letters = raw.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2)
  const digits  = raw.replace(/[^0-9]/g, '').slice(0, 7)
  if (!letters) return ''
  if (letters.length < 2) return letters
  return letters + (digits ? ' ' + digits : '')
}

export function Field({ label, error, ...props }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input className={INPUT + (error ? ' border-red-400 ring-1 ring-red-300 focus:ring-red-400' : '')} {...props} />
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  )
}

export function PhoneField({ label, value, onOpenNumpad, isOpen, error }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input
        type="tel"
        readOnly
        className={INPUT + (isOpen ? ' ring-2 ring-ring border-ring' : error ? ' border-red-400 ring-1 ring-red-300' : '')}
        style={{ cursor: 'pointer' }}
        value={value}
        placeholder="+998 90 123 45 67"
        onPointerDown={e => { e.preventDefault(); document.activeElement?.blur(); onOpenNumpad() }}
        onFocus={() => onOpenNumpad()}
      />
      {!isOpen && error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  )
}

const PHONE_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function FullPhoneNumpad({ value, onChange, onClose }) {
  const [activeKey, setActiveKey] = useState(null)

  function press(k) {
    const raw = getRawDigits(value)
    if (k === '⌫') {
      const next = raw.slice(0, -1)
      onChange(next ? formatUzPhone(next) : '')
      return
    }
    if (raw.length >= 9) return
    const next = raw + k
    onChange(formatUzPhone(next))
    if (next.length === 9) onClose()
  }

  function flash(k) {
    setActiveKey(k)
    setTimeout(() => setActiveKey(null), 150)
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); flash(e.key); press(e.key) }
      else if (e.key === 'Backspace') { e.preventDefault(); flash('⌫'); press('⌫') }
      else if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full w-full px-3 pt-2 pb-3 gap-5">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-muted-foreground">Telefon raqam</span>
        <button type="button" onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-muted hover:bg-muted-foreground/20 active:scale-90 transition-all text-muted-foreground hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/>
          </svg>
        </button>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-2" style={{ gridTemplateRows: 'repeat(4, 1fr)' }}>
        {PHONE_KEYS.map((k, i) =>
          k === '' ? <div key={i} /> :
          k === '⌫' ? (
            <button key={i} type="button"
              onPointerDown={e => { e.preventDefault(); flash('⌫'); press('⌫') }}
              className={`rounded-xl flex items-center justify-center active:scale-95 transition-all select-none touch-manipulation ${activeKey === '⌫' ? 'bg-red-400 text-white scale-95' : 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'}`}>
              <svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9L3 9z"/>
                <line x1="13" y1="7" x2="17" y2="11"/><line x1="17" y1="7" x2="13" y2="11"/>
              </svg>
            </button>
          ) : (
            <button key={i} type="button"
              onPointerDown={e => { e.preventDefault(); flash(k); press(k) }}
              className={`rounded-xl text-3xl font-bold flex items-center justify-center active:scale-95 transition-all select-none touch-manipulation ${activeKey === k ? 'bg-amber-400 text-white scale-95 border-amber-400' : 'bg-background border border-border text-foreground hover:bg-amber-50 hover:border-amber-300'}`}>
              {k}
            </button>
          )
        )}
      </div>
    </div>
  )
}

export function PassportField({ label, value, onChange }) {
  const [touched, setTouched] = useState(false)
  const invalid = touched && value && !/^[A-Z]{2} \d{7}$/.test(value)

  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input
        className={INPUT + (invalid ? ' border-red-400 ring-1 ring-red-300 focus:ring-red-400' : '')}
        placeholder="AA 1234567"
        value={value}
        onChange={e => onChange(formatPassport(e.target.value))}
        onBlur={() => setTouched(true)}
        maxLength={10}
        autoComplete="off"
        spellCheck={false}
      />
      {invalid && <p className="text-xs text-red-500 mt-1.5">2 harf + 7 raqam bo'lishi kerak</p>}
    </div>
  )
}
