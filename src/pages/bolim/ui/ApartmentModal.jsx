import { Loader2, RotateCcw, FileText, CheckCircle, Lock, ShoppingBag, Ruler, X, ChevronDown, Calculator } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { apiFetch, getUser } from '@/shared/lib/auth'
import { ContractPDF } from './ContractPDF'

const allBlockImgs = import.meta.glob('@/assets/blocks/**/*.webp', { eager: true })

function loadImg(blockId, floor, bolimNum) {
  const filename = String(bolimNum)
  const entry = Object.entries(allBlockImgs).find(([k]) => {
    const parts = k.replace(/\\/g, '/').split('/')
    const name = parts.pop()?.split('.')[0]
    const floorDir = parts.pop()
    const blockDir = parts.pop()
    return name === filename && floorDir === String(floor) && blockDir === blockId
  })
  return entry?.[1]?.default ?? null
}

async function getAptRect(blockId, floor, bolimNum, address) {
  try {
    const LOADERS = {
      A: [
        () => import('../config/aRectOverlays').then(m => m.A_RECT_OVERLAYS),
        () => import('../config/aFloor2RectOverlays').then(m => m.A_FLOOR2_RECT_OVERLAYS),
      ],
      B: [
        () => import('../config/bRectOverlays').then(m => m.B_RECT_OVERLAYS),
        () => import('../config/bFloor2RectOverlays').then(m => m.B_FLOOR2_RECT_OVERLAYS),
      ],
      C: [
        () => import('../config/cRectOverlays').then(m => m.C_RECT_OVERLAYS),
        () => import('../config/cFloor2RectOverlays').then(m => m.C_FLOOR2_RECT_OVERLAYS),
      ],
    }
    const overlays = await LOADERS[blockId]?.[floor === 2 ? 1 : 0]?.()
    const bolimData = overlays?.[bolimNum]
    if (!bolimData) return null
    const rect = bolimData.rects?.find(r => r.id === address)
    return rect ? { rect, viewBox: bolimData.viewBox } : null
  } catch { return null }
}

// Returns {x, y, width, height} bounding box of an SVG path (M/L commands only)
function pathBBox(d) {
  const nums = d.match(/[-\d.]+/g)?.map(Number) ?? []
  const xs = [], ys = []
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]) }
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

async function drawHighlight(imgSrc, rect, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })

  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  // If no rect/viewBox, return full image as data URL
  if (!rect || !viewBox) return canvas.toDataURL('image/png')

  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth  / vw
  const sy = img.naturalHeight / vh

  // --- Draw highlight ---
  let bboxVb // bounding box in viewBox units
  if (rect.d) {
    ctx.save()
    ctx.scale(sx, sy)
    ctx.fillStyle = 'rgba(239,68,68,0.22)'
    ctx.fill(new Path2D(rect.d))
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = vw / 90
    ctx.stroke(new Path2D(rect.d))
    ctx.restore()
    bboxVb = pathBBox(rect.d)
  } else {
    const lw = Math.max(4, img.naturalWidth / 250)
    const rx = rect.x * sx, ry = rect.y * sy
    const rw = rect.width * sx, rh = rect.height * sy
    ctx.fillStyle = 'rgba(239,68,68,0.22)'
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = lw
    ctx.strokeRect(rx, ry, rw, rh)
    bboxVb = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }

  // --- Crop vertically (Y axis) only — keep full width, cut height to apartment row ---
  const bboxPy = bboxVb.y * sy
  const bboxPh = bboxVb.height * sy
  const padY = bboxPh * 1.2  // 1.2× apartment height as vertical padding
  const cy = Math.max(0, bboxPy - padY)
  const ch = Math.min(img.naturalHeight - cy, bboxPh + padY * 2)

  const cropped = document.createElement('canvas')
  cropped.width  = img.naturalWidth  // full width
  cropped.height = ch
  cropped.getContext('2d').drawImage(canvas, 0, cy, img.naturalWidth, ch, 0, 0, img.naturalWidth, ch)

  return cropped.toDataURL('image/png')
}

async function imgToDataUrl(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch { return null }
}

async function downloadContractPDF({ apartment, floor, blockId, bolimNum, form, type, managerName }) {
  const { pdf } = await import('@react-pdf/renderer')
  const qrImg = await import('@/assets/qrcode.png')
  const qrDataUrl = qrImg.default

  const [logoSrc, rawFloorImg] = await Promise.all([
    imgToDataUrl('/logo.png'),
    Promise.resolve(loadImg(blockId, floor, bolimNum)),
  ])

  // Highlight apartment on floor plan; always convert to data URL for PDF renderer
  let floorImgSrc = null
  if (rawFloorImg) {
    try {
      const overlay = await getAptRect(blockId, floor, bolimNum, apartment.address)
      floorImgSrc = await drawHighlight(rawFloorImg, overlay?.rect ?? null, overlay?.viewBox ?? null)
    } catch { floorImgSrc = null }
  }

  const date = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
  const blob = await pdf(
    <ContractPDF
      apartment={apartment}
      floor={floor}
      blockId={blockId}
      bolimNum={bolimNum}
      form={form}
      type={type}
      date={date}
      floorImgSrc={floorImgSrc}
      managerName={managerName}
      qrDataUrl={qrDataUrl}
      logoSrc={logoSrc}
    />
  ).toBlob()
  return blob
}

const INPUT =
  'w-full rounded-xl border border-border bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow uppercase placeholder:uppercase'
const LABEL = 'block text-sm font-medium text-foreground mb-1.5'
// Faqat o'zbek raqamlar: +998 XX XXX XX XX
function formatUzPhone(raw) {
  // Faqat raqamlar
  let digits = String(raw ?? '').replace(/\D/g, '')
  // Faqat to'liq xalqaro format (12+ raqam) bo'lsa 998 ni olib tashla
  if (digits.startsWith('998') && digits.length > 9) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  // Max 9 raqam (operator + nomer)
  digits = digits.slice(0, 9)
  // +998 XX XXX XX XX
  let out = '+998'
  if (digits.length > 0) out += ' ' + digits.slice(0, 2)
  if (digits.length > 2) out += ' ' + digits.slice(2, 5)
  if (digits.length > 5) out += ' ' + digits.slice(5, 7)
  if (digits.length > 7) out += ' ' + digits.slice(7, 9)
  return out
}

function Field({ label, error, ...props }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input className={INPUT + (error ? ' border-red-400 ring-1 ring-red-300 focus:ring-red-400' : '')} {...props} />
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  )
}

function PhoneField({ label, value, onOpenNumpad, isOpen, error }) {
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

function getRawDigits(val) {
  let str = String(val ?? '')
  if (str.startsWith('+998')) str = str.slice(4)
  let d = str.replace(/\D/g, '')
  if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 9)
}

function FullPhoneNumpad({ value, onChange, onClose }) {
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
    <div className="flex flex-col h-full w-full p-3 gap-2">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-muted-foreground">Telefon raqam</span>
        <button type="button" onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1">✕</button>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-2" style={{ gridTemplateRows: 'repeat(4, 1fr)' }}>
        {PHONE_KEYS.map((k, i) =>
          k === '' ? <div key={i} /> :
          k === '⌫' ? (
            <button key={i} type="button"
              onPointerDown={e => { e.preventDefault(); flash('⌫'); press('⌫') }}
              className={`rounded-2xl text-muted-foreground flex items-center justify-center active:scale-95 transition-all select-none touch-manipulation ${activeKey === '⌫' ? 'bg-primary/20 scale-95' : 'bg-muted/60'}`}>
              <svg width="20" height="15" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9L3 9z"/>
                <line x1="13" y1="7" x2="17" y2="11"/><line x1="17" y1="7" x2="13" y2="11"/>
              </svg>
            </button>
          ) : (
            <button key={i} type="button"
              onPointerDown={e => { e.preventDefault(); flash(k); press(k) }}
              className={`rounded-2xl text-foreground text-xl font-semibold flex items-center justify-center active:scale-95 transition-all select-none touch-manipulation ${activeKey === k ? 'bg-primary text-primary-foreground scale-95' : 'bg-muted/60 hover:bg-muted'}`}>
              {k}
            </button>
          )
        )}
      </div>
    </div>
  )
}

function formatPassport(raw) {
  const letters = raw.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2)
  const digits  = raw.replace(/[^0-9]/g, '').slice(0, 7)
  if (!letters) return ''
  if (letters.length < 2) return letters
  return letters + (digits ? ' ' + digits : '')
}

function PassportField({ label, value, onChange }) {
  const [touched, setTouched] = useState(false)
  const invalid = touched && value && !/^[A-Z]{2} \d{7}$/.test(value)

  function handleChange(e) {
    onChange(formatPassport(e.target.value))
  }

  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input
        className={INPUT + (invalid ? ' border-red-400 ring-1 ring-red-300 focus:ring-red-400' : '')}
        placeholder="AA 1234567"
        value={value}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        maxLength={10}
        autoComplete="off"
        spellCheck={false}
      />
      {invalid && (
        <p className="text-xs text-red-500 mt-1.5">2 harf + 7 raqam bo'lishi kerak</p>
      )}
    </div>
  )
}

function MoneyField({ label, value, onChange }) {
  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '')
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    onChange(formatted)
  }
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          className={INPUT + ' pr-16'}
          value={value}
          onChange={handleChange}
          placeholder="10 000 000"
          required
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold pointer-events-none select-none">
          USD
        </span>
      </div>
    </div>
  )
}

const QUICK_MONTHS = [12, 24, 36, 48]

function MonthsField({ value, onChange }) {
  const num = parseInt(value) || 12
  return (
    <div>
      <label className={LABEL}>Necha oyga</label>
      <div className="flex gap-2">
        {QUICK_MONTHS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(String(m))}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              num === m
                ? 'bg-secondary text-secondary-foreground border-secondary'
                : 'bg-background text-muted-foreground border-border hover:bg-secondary/50'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}

function ConvertToSaleModal({ apartment, booking, onClose, onBooked }) {
  const [form, setForm] = useState({ passport: '', passport_place: '', manzil: '' })
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function fmtDate(str) {
    if (!str) return null
    const d = new Date(str)
    const months = ['yan','fev','mar','apr','may','iyn','iyl','avg','sen','okt','noy','dek']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setConverting(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/bookings/${booking.id}/convert`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passport: form.passport || null,
          passport_place: form.passport_place || null,
          manzil: form.manzil || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Xatolik yuz berdi')
        return
      }
      onBooked?.()
      onClose()
    } catch {
      setError('Internet aloqasi uzildi')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center px-6 border-b border-border shrink-0 h-20 gap-4">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl font-bold text-foreground">{apartment.address}</span>
            {apartment.size > 0 && (
              <span className="text-lg text-muted-foreground font-medium">{apartment.size} m²</span>
            )}
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">
              Sotishga o'tkazish
            </span>
          </div>
          <button onClick={onClose}
            className="w-12 h-12 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0 text-3xl">
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-5 flex flex-col gap-5">

            {/* Bron ma'lumotlari — read only xulosa */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Bron ma'lumotlari</p>
              {booking.ism && (
                <div className="flex justify-between">
                  <span className="text-xs text-amber-800/70">Xaridor</span>
                  <span className="text-sm font-bold text-amber-900">{booking.ism}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-amber-800/70">Menejer</span>
                <span className="text-sm font-semibold text-amber-900">{booking.manager_name ?? '—'}</span>
              </div>
              {booking.created_at && (
                <div className="flex justify-between">
                  <span className="text-xs text-amber-800/70">Bron sanasi</span>
                  <span className="text-sm font-semibold text-amber-900">{fmtDate(booking.created_at)}</span>
                </div>
              )}
            </div>

            {/* Qo'shimcha maydonlar */}
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Qo'shimcha ma'lumotlar <span className="font-normal">(ixtiyoriy)</span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <PassportField label="Passport seriya/raqam" value={form.passport}
                  onChange={(v) => setForm(f => ({ ...f, passport: v }))} />
                <Field label="Passport berilgan joy" placeholder="Toshkent sh. IIB"
                  value={form.passport_place}
                  onChange={e => setForm(f => ({ ...f, passport_place: e.target.value }))} />
              </div>
              <Field label="Manzil" placeholder="Toshkent, Chilonzor"
                value={form.manzil}
                onChange={e => setForm(f => ({ ...f, manzil: e.target.value }))} />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-3 shrink-0 border-t border-border flex flex-col gap-2">
            {error && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 py-4 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
                Bekor qilish
              </button>
              <button type="submit" disabled={converting}
                className="flex-1 py-4 rounded-xl bg-green-600 text-white font-semibold text-base active:scale-[0.98] transition-all hover:bg-green-700 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {converting && <Loader2 size={18} className="animate-spin" />}
                {converting ? 'Saqlanmoqda...' : 'Sotishga o\'tkazish'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function StatusCard({ apartment, isReserved, onClose, onBooked }) {
  const [booking, setBooking] = useState(null)
  const [showConvert, setShowConvert] = useState(false)
  const currentUser = getUser()

  useEffect(() => {
    apiFetch(`/api/apartments/booking?id=${apartment.address}`)
      .then(r => r.json())
      .then(d => setBooking(d))
      .catch(() => {})
  }, [apartment.address])

  const accent = isReserved
    ? { dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Bron' }
    : { dot: 'bg-red-500',   badge: 'bg-red-50 text-red-700 border-red-200',       label: 'Sotilgan' }

  const isOwner = isReserved && booking && currentUser && booking.user_id === currentUser.sub

  function fmtDate(str) {
    if (!str) return null
    const d = new Date(str)
    const months = ['yan','fev','mar','apr','may','iyn','iyl','avg','sen','okt','noy','dek']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  if (showConvert && booking) {
    return (
      <ConvertToSaleModal
        apartment={apartment}
        booking={booking}
        onClose={() => setShowConvert(false)}
        onBooked={onBooked}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="relative bg-background rounded-2xl shadow-2xl border border-border w-full max-w-xs overflow-hidden">
        {/* Header strip */}
        <div className={`px-5 py-4 flex items-center gap-3 ${isReserved ? 'bg-amber-50 border-b border-amber-100' : 'bg-red-50 border-b border-red-100'}`}>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${accent.dot}`} />
          <span className="font-black text-lg text-foreground tracking-tight flex-1">{apartment.address}</span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${accent.badge}`}>{accent.label}</span>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center bg-black/8 text-foreground hover:bg-black/15 transition-colors ml-1">
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Info rows */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {booking ? (
            <>
              {booking.ism && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isReserved ? 'Kim uchun bron' : 'Xaridor'}</span>
                  <span className="text-sm font-bold text-foreground">{booking.ism}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Menejer</span>
                <span className="text-sm font-semibold text-foreground">{booking.manager_name ?? '—'}</span>
              </div>
              {booking.created_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isReserved ? 'Bron sanasi' : 'Sotilgan sana'}</span>
                  <span className="text-sm font-semibold text-foreground">{fmtDate(booking.created_at)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-2">
              <svg className="w-5 h-5 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          )}
          {apartment.size > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">Maydon</span>
              <span className="text-sm font-semibold text-foreground">{apartment.size} m²</span>
            </div>
          )}

          {isOwner && (
            <button type="button" onClick={() => setShowConvert(true)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors mt-1">
              Sotishga o'tkazish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const BRON_EMPTY = { ism: '', familiya: '', telefon: '', boshlangich: '', oylar: '12', umumiy: '', narx_m2: '' }
const SOTISH_EMPTY = { ism: '', familiya: '', telefon: '', boshlangich: '', oylar: '12', umumiy: '', narx_m2: '', passport: '', passport_place: '', manzil: '' }

export function ApartmentModal({ apartment, floor, blockId, bolimNum, onClose, onBooked }) {
  const currentUser = getUser()
  const [tab, setTab] = useState('bron')
  const [bronForm, setBronForm] = useState(BRON_EMPTY)
  const [sotishForm, setSotishForm] = useState(SOTISH_EMPTY)
  const [booked, setBooked] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [managers, setManagers] = useState([])
  const [assignedUserId, setAssignedUserId] = useState(null) // null = o'zi
  const [confirmPending, setConfirmPending] = useState(null) // 'bron' | 'sotish'
  const [showErrors, setShowErrors] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [calc, setCalc] = useState({ narxM2: '', boshlangich: '', oylar: '12', focus: 'narxM2' })
  const [phoneTarget, setPhoneTarget] = useState(null) // null | 'bron' | 'sotish'
  const longPressTimer = useRef(null)
  const longPressFired = useRef(false)
  const calcLoadFromDB = useRef(true)

  function calcLongPressStart(e) {
    e.preventDefault()
    longPressFired.current = false
    if (showCalc) return
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      if (navigator.vibrate) navigator.vibrate(40)
      calcLoadFromDB.current = false
      setCalc({ narxM2: '', boshlangich: '', oylar: '12', focus: 'narxM2' })
      setShowCalc(true)
    }, 1000)
  }

  function calcLongPressEnd() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (!longPressFired.current) {
      if (showCalc) { setShowCalc(false); return }
      calcLoadFromDB.current = true
      setShowCalc(true)
    }
  }

  // Kalkulyator ochilganda narxni bazadan yuklash — faqat bir marta
  useEffect(() => {
    if (!showCalc || !calcLoadFromDB.current) return
    let cancelled = false
    const [block, bolimStr] = apartment.address.split('-')
    apiFetch(`/api/prices?block=${block}&bolim=${parseInt(bolimStr)}&floor=${floor}`)
      .then(r => r.json())
      .then(({ price }) => {
        if (!cancelled && price) setCalc(f => ({ ...f, narxM2: f.narxM2 === '' ? String(price) : f.narxM2 }))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [showCalc]) // eslint-disable-line react-hooks/exhaustive-deps

  function fetchCalcPrice() {
    const [block, bolimStr] = apartment.address.split('-')
    apiFetch(`/api/prices?block=${block}&bolim=${parseInt(bolimStr)}&floor=${floor}`)
      .then(r => r.json())
      .then(({ price }) => { if (price) setCalc(f => ({ ...f, narxM2: String(price) })) })
      .catch(() => {})
  }

  useEffect(() => {
    apiFetch('/api/managers').then(r => r.json()).then(list => {
      if (Array.isArray(list)) setManagers(list)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Boshqa inputga fokus o'tsa numpadni yop
  useEffect(() => {
    if (!phoneTarget) return
    function onFocusIn(e) {
      const el = e.target
      if (el.tagName === 'INPUT' && el.type !== 'tel') setPhoneTarget(null)
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [phoneTarget])

  if (!apartment) return null

  function getErrors(form) {
    const e = {}
    if (!form.ism.trim()) e.ism = "To'ldirilishi shart"
    if (!form.familiya.trim()) e.familiya = "To'ldirilishi shart"
    const phoneDigits = getRawDigits(form.telefon)
    if (phoneDigits.length < 9) e.telefon = phoneDigits.length === 0 ? 'Telefon raqam kiritilishi shart' : "Telefon raqam to'liq emas"
    const boshlVal = Number(String(form.boshlangich || '').replace(/\s/g, ''))
    if (!boshlVal) e.boshlangich = boshlVal === 0 && form.boshlangich ? "Summa noldan katta bo'lishi shart" : "Boshlang'ich to'lov kiritilishi shart"
    return e
  }

  const bronErrors  = showErrors ? getErrors(bronForm)   : {}
  const sotishErrors = showErrors ? getErrors(sotishForm) : {}
  const activeErrors = tab === 'bron' ? bronErrors : sotishErrors
  const hasErrors = Object.keys(activeErrors).length > 0

  const cap = (s) => s ? s.toUpperCase() : s

  const setBronCap = (key) => (e) => setBronForm((f) => ({ ...f, [key]: cap(e.target.value) }))
  const setSotish = (key) => (e) => setSotishForm((f) => ({ ...f, [key]: e.target.value }))
  const setSotishCap = (key) => (e) => setSotishForm((f) => ({ ...f, [key]: cap(e.target.value) }))

  const assignedManager = assignedUserId
    ? managers.find(m => m.id === assignedUserId)
    : null
  const effectiveManagerName = assignedManager?.name ?? currentUser?.name ?? ''

  async function submitBooking(type) {
    if (submitting) return
    setConfirmPending(null)
    setSubmitting(true)
    setSubmitError(null)
    const form = type === 'bron' ? bronForm : sotishForm
    try {
      const res = await apiFetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartment_id: apartment.address,
          type,
          ism: form.ism,
          familiya: form.familiya,
          boshlangich: form.boshlangich,
          oylar: parseInt(form.oylar),
          umumiy: form.umumiy || null,
          narx_m2: form.narx_m2 || null,
          phone: form.telefon || null,
          passport: form.passport || null,
          passport_place: form.passport_place || null,
          manzil: form.manzil || null,
          assigned_user_id: assignedUserId ?? null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSubmitError(data.error || 'Xatolik yuz berdi. Qayta urinib ko\'ring.')
        return
      }
      const booking = await res.json()
      onBooked?.()
      setBooked({ form, type, bookingId: booking.id, managerName: effectiveManagerName })

      // Faqat bron uchun Telegramga PDF yuborish (background)
      if (type === 'bron' && booking.id) {
        const managerName = effectiveManagerName
        downloadContractPDF({ apartment, floor, blockId, bolimNum, form, type, managerName })
          .then(blob => {
            const fd = new FormData()
            fd.append('pdf', blob, `shartnoma-${apartment.address}.pdf`)
            fd.append('booking_id', String(booking.id))
            return apiFetch('/api/bookings/send-pdf', { method: 'POST', body: fd })
          })
          .then(res => res?.ok && console.log('[PDF] Telegramga yuborildi'))
          .catch(e => console.error('[PDF] xato:', e?.message ?? e))
      }
    } catch {
      setSubmitError('Internet aloqasi uzildi. Qayta urinib ko\'ring.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownloadPDF() {
    setPdfLoading(true)
    try {
      const managerName = booked.managerName ?? getUser()?.name ?? ''
      const blob = await downloadContractPDF({ apartment, floor, blockId, bolimNum, form: booked.form, type: booked.type, managerName })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shartnoma-${apartment.address}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPdfLoading(false)
    }
  }

  const [calcActiveKey, setCalcActiveKey] = useState(null)

  useEffect(() => {
    if (!showCalc) return
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        setCalcActiveKey(e.key)
        setTimeout(() => setCalcActiveKey(null), 150)
        setCalc(f => {
          if (f.focus === 'oylar') return f
          const raw = String(f[f.focus]).replace(/\s/g, '')
          if (raw.length >= 12) return f
          const next = raw + e.key
          return { ...f, [f.focus]: Number(next).toLocaleString('ru-RU').replace(/,/g, ' ') }
        })
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setCalcActiveKey('⌫')
        setTimeout(() => setCalcActiveKey(null), 150)
        setCalc(f => {
          if (f.focus === 'oylar') return f
          const raw = String(f[f.focus]).replace(/\s/g, '').slice(0, -1)
          return { ...f, [f.focus]: raw ? Number(raw).toLocaleString('ru-RU').replace(/,/g, ' ') : '' }
        })
      } else if (e.key === 'Delete') {
        e.preventDefault()
        setCalcActiveKey('C')
        setTimeout(() => setCalcActiveKey(null), 150)
        setCalc(f => f.focus === 'oylar' ? f : { ...f, [f.focus]: '' })
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowCalc(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCalc])

  const calcKeypad = (() => {
    const narxVal = Number(String(calc.narxM2).replace(/\s/g, ''))
    const downVal = Number(String(calc.boshlangich).replace(/\s/g, ''))
    const months  = parseInt(calc.oylar) || 12
    const total   = apartment.size * narxVal

    function pressKey(key) {
      setCalcActiveKey(key)
      setTimeout(() => setCalcActiveKey(null), 150)
      setCalc(f => {
        if (f.focus === 'oylar') return f
        const raw = String(f[f.focus]).replace(/\s/g, '')
        let next = raw
        if (key === '⌫') next = raw.slice(0, -1)
        else if (key === 'C') next = ''
        else if (raw.length < 12) next = raw + key
        const formatted = next ? Number(next).toLocaleString('ru-RU').replace(/,/g, ' ') : ''
        return { ...f, [f.focus]: formatted }
      })
    }

    const KEYS = ['7','8','9','4','5','6','1','2','3','C','0','⌫']

    return (
      <div className="flex flex-col gap-3 px-4 py-5 w-full h-full">
        <button type="button"
          onClick={() => setCalc(f => ({ ...f, focus: 'narxM2' }))}
          className={`w-full rounded-2xl border-2 text-left px-4 py-4 transition-colors shrink-0 ${calc.focus === 'narxM2' ? 'border-amber-400 bg-amber-50' : 'border-border bg-background hover:border-amber-200'}`}
        >
          <p className="text-xs text-muted-foreground mb-1">Narx/m²</p>
          <p className={`text-2xl font-bold ${calc.narxM2 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
            {calc.narxM2 ? Number(String(calc.narxM2).replace(/\s/g, '')).toLocaleString('ru-RU') : '0'}
            <span className="text-sm font-normal text-muted-foreground ml-1">USD</span>
          </p>
        </button>
        <div className="grid grid-cols-3 gap-2 w-full flex-1">
          {KEYS.map(k => (
            <button key={k} type="button" onPointerDown={(e) => { e.preventDefault(); pressKey(k) }}
              className={`rounded-xl text-lg font-semibold transition-all active:scale-95 select-none ${
                calcActiveKey === k
                  ? k === '⌫' ? 'bg-red-400 text-white border border-red-400 scale-95'
                    : k === 'C' ? 'bg-muted-foreground/30 text-foreground border border-border scale-95'
                    : 'bg-amber-400 text-white border border-amber-400 scale-95'
                  : k === '⌫' ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'
                  : k === 'C' ? 'bg-muted text-muted-foreground border border-border hover:bg-muted/70'
                  : 'bg-background border border-border text-foreground hover:bg-amber-50 hover:border-amber-300'
              }`}
            >{k}</button>
          ))}
        </div>
      </div>
    )
  })

  const calcLeftPanel = (() => {
    const narxVal = Number(String(calc.narxM2).replace(/\s/g, ''))
    const downVal = Number(String(calc.boshlangich).replace(/\s/g, ''))
    const months  = parseInt(calc.oylar) || 12
    const total   = apartment.size * narxVal
    const monthly = total > 0 ? Math.round((total - downVal) / months) : 0
    const percent = total > 0 && downVal > 0 ? Math.round((downVal / total) * 100) : 0
    const FIELDS  = [
      { key: 'boshlangich', label: "Boshlang'ich",  unit: 'USD', val: calc.boshlangich },
    ]
    function transferToForm() {
      const narxVal = Number(String(calc.narxM2).replace(/\s/g, ''))
      const totalVal = narxVal && apartment.size > 0 ? Math.round(narxVal * apartment.size) : 0
      const setter = tab === 'sotish' ? setSotishForm : setBronForm
      if (calc.narxM2)      setter(f => ({ ...f, narx_m2: calc.narxM2 }))
      if (calc.boshlangich) setter(f => ({ ...f, boshlangich: calc.boshlangich }))
      if (calc.oylar)       setter(f => ({ ...f, oylar: calc.oylar }))
      if (totalVal)         setter(f => ({ ...f, umumiy: String(totalVal) }))
      setShowCalc(false)
    }
    return (
      <div className="flex flex-col gap-4 px-5 py-5 border-r border-border overflow-y-auto" style={{ flex: '0 0 70%' }}>
        {/* Yuqori qator: Umumiy narx (static) + Boshlang'ich (tappable) */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl border-2 border-border bg-muted/40 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Umumiy narx <span className="text-muted-foreground/50">({apartment.size} m²)</span></p>
            <p className={`text-xl font-bold ${total > 0 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
              {total > 0 ? total.toLocaleString('ru-RU') : '—'}
              {total > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">USD</span>}
            </p>
          </div>
          {FIELDS.map(({ key, label, unit, val }) => (
            <button key={key} type="button"
              onClick={() => setCalc(f => ({ ...f, focus: key }))}
              className={`flex-1 rounded-2xl border-2 text-left px-4 py-3 transition-colors ${calc.focus === key ? 'border-amber-400 bg-amber-50' : 'border-border bg-background hover:border-amber-200'}`}
            >
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold ${val ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                {val ? Number(String(val).replace(/\s/g, '')).toLocaleString('ru-RU') : '0'}
                <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
              </p>
            </button>
          ))}
        </div>

        {/* Oylar */}
        <div>
          <p className={LABEL}>Oylar</p>
          <div className="flex gap-2">
            {QUICK_MONTHS.map(m => (
              <button key={m} type="button"
                onClick={() => setCalc(f => ({ ...f, oylar: String(m) }))}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${parseInt(calc.oylar) === m ? 'bg-amber-500 text-white border-amber-500' : 'bg-background text-muted-foreground border-border hover:bg-amber-50'}`}
              >{m}</button>
            ))}
          </div>
        </div>

        {/* Oylik to'lov — flex-1 katta display */}
        <div className="flex-1 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 flex flex-col justify-center">
          <p className="text-xs text-amber-700 font-medium mb-2">Oylik to'lov</p>
          <p className={`text-4xl font-bold leading-tight ${monthly > 0 ? 'text-amber-700' : 'text-amber-300'}`}>
            {monthly > 0 ? monthly.toLocaleString('ru-RU') : '—'}
          </p>
          {monthly > 0 && <p className="text-sm text-amber-600 mt-1">USD / oy</p>}
          {percent > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-300">
              <p className="text-xs text-amber-700 mb-0.5">Kafolat summasi</p>
              <p className="text-2xl font-bold text-amber-700">{percent}% <span className="text-sm font-normal">umumiy to'lovdan</span></p>
            </div>
          )}
        </div>

        {/* Formaga o'tkazish */}
        <button type="button" onClick={transferToForm}
          disabled={!calc.boshlangich}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all shrink-0 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-600 disabled:hover:bg-amber-500 text-white"
        >
          Formaga o'tkazish →
        </button>
      </div>
    )
  })

  const bronFields = (
    <div className="flex flex-1 min-h-0">
      {showCalc ? calcLeftPanel() : (
        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto border-r border-border" style={{ flex: '0 0 70%' }}>
          <Field label="Ism" placeholder="Abdulloh" value={bronForm.ism} onChange={setBronCap('ism')} autoComplete="given-name" error={bronErrors.ism} />
          <Field label="Familiya" placeholder="Karimov" value={bronForm.familiya} onChange={setBronCap('familiya')} autoComplete="family-name" error={bronErrors.familiya} />
          <PhoneField label="Telefon raqam" value={bronForm.telefon}
            isOpen={phoneTarget === 'bron'}
            onOpenNumpad={() => setPhoneTarget('bron')}
            onClose={() => setPhoneTarget(null)}
            error={bronErrors.telefon}
          />
          {(bronForm.boshlangich || bronForm.narx_m2) ? (
            <div className="flex-1 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 flex flex-col justify-between">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-amber-700 mb-1">Kafolat summasi</p>
                  <p className="text-xl font-bold text-foreground">{bronForm.boshlangich || '—'} <span className="text-sm font-normal text-muted-foreground">USD</span></p>
                  {(() => {
                    const down  = Number(String(bronForm.boshlangich || '').replace(/\s/g, ''))
                    const narx  = Number(String(bronForm.narx_m2 || '').replace(/\s/g, ''))
                    const total = narx > 0 ? Math.round(narx * apartment.size) : 0
                    const pct   = total > 0 && down > 0 ? Math.round((down / total) * 100) : 0
                    return pct > 0 ? <p className="text-lg font-bold text-amber-600 mt-1">{pct}% <span className="text-xs font-normal">umumiy to'lovdan</span></p> : null
                  })()}
                </div>
                <div>
                  <p className="text-xs text-amber-700 mb-1">Muddat</p>
                  <p className="text-xl font-bold text-foreground">{bronForm.oylar || '—'} <span className="text-sm font-normal text-muted-foreground">oy</span></p>
                </div>
                <div>
                  <p className="text-xs text-amber-700 mb-1">Narx/m²</p>
                  <p className="text-xl font-bold text-foreground">{bronForm.narx_m2 || '—'} <span className="text-sm font-normal text-muted-foreground">USD</span></p>
                </div>
              </div>
              <button type="button" onClick={() => setShowCalc(true)}
                className="mt-4 self-start text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900"
              >
                Qayta hisoblash →
              </button>
            </div>
          ) : bronErrors.boshlangich ? (
            <button type="button" onClick={() => setShowCalc(true)}
              className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-left w-full hover:bg-red-100 transition-colors">
              <p className="text-sm font-semibold text-red-700">Boshlang'ich to'lov kiritilishi shart</p>
              <p className="text-xs text-red-500 mt-1">Kalkulyatorni ochish →</p>
            </button>
          ) : null}
        </div>
      )}
      <div className="flex items-stretch" style={{ flex: '0 0 30%' }}>
        {showCalc
          ? calcKeypad()
          : phoneTarget === 'bron'
          ? <FullPhoneNumpad
              value={bronForm.telefon}
              onChange={(v) => setBronForm(f => ({ ...f, telefon: v }))}
              onClose={() => setPhoneTarget(null)}
            />
          : null
        }
      </div>
    </div>
  )

  const sotishFields = (
    <div className="flex flex-1 min-h-0">
      {showCalc ? calcLeftPanel() : (
        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto border-r border-border" style={{ flex: '0 0 70%' }}>
          <Field label="Ism" placeholder="Abdulloh" value={sotishForm.ism} onChange={setSotishCap('ism')} autoComplete="given-name" error={sotishErrors.ism} />
          <Field label="Familiya" placeholder="Karimov" value={sotishForm.familiya} onChange={setSotishCap('familiya')} autoComplete="family-name" error={sotishErrors.familiya} />
          <PhoneField label="Telefon raqam" value={sotishForm.telefon}
            isOpen={phoneTarget === 'sotish'}
            onOpenNumpad={() => setPhoneTarget('sotish')}
            onClose={() => setPhoneTarget(null)}
            error={sotishErrors.telefon}
          />
          {(sotishForm.boshlangich || sotishForm.narx_m2) ? (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 flex flex-col justify-between">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-amber-700 mb-1">Kafolat summasi</p>
                  <p className="text-xl font-bold text-foreground">{sotishForm.boshlangich || '—'} <span className="text-sm font-normal text-muted-foreground">USD</span></p>
                  {(() => {
                    const down  = Number(String(sotishForm.boshlangich || '').replace(/\s/g, ''))
                    const narx  = Number(String(sotishForm.narx_m2 || '').replace(/\s/g, ''))
                    const total = narx > 0 ? Math.round(narx * apartment.size) : 0
                    const pct   = total > 0 && down > 0 ? Math.round((down / total) * 100) : 0
                    return pct > 0 ? <p className="text-lg font-bold text-amber-600 mt-1">{pct}% <span className="text-xs font-normal">umumiy to'lovdan</span></p> : null
                  })()}
                </div>
                <div>
                  <p className="text-xs text-amber-700 mb-1">Muddat</p>
                  <p className="text-xl font-bold text-foreground">{sotishForm.oylar || '—'} <span className="text-sm font-normal text-muted-foreground">oy</span></p>
                </div>
                <div>
                  <p className="text-xs text-amber-700 mb-1">Narx/m²</p>
                  <p className="text-xl font-bold text-foreground">{sotishForm.narx_m2 || '—'} <span className="text-sm font-normal text-muted-foreground">USD</span></p>
                </div>
              </div>
              <button type="button" onClick={() => setShowCalc(true)}
                className="mt-4 self-start text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900">
                Qayta hisoblash →
              </button>
            </div>
          ) : sotishErrors.boshlangich ? (
            <button type="button" onClick={() => setShowCalc(true)}
              className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-left w-full hover:bg-red-100 transition-colors">
              <p className="text-sm font-semibold text-red-700">Boshlang'ich to'lov kiritilishi shart</p>
              <p className="text-xs text-red-500 mt-1">Kalkulyatorni ochish →</p>
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <PassportField label="Passport seriya/raqam" value={sotishForm.passport} onChange={(v) => setSotishForm(f => ({ ...f, passport: v }))} />
            <Field label="Passport berilgan joy" placeholder="Toshkent sh. IIB" value={sotishForm.passport_place} onChange={setSotish('passport_place')} />
          </div>
          <Field label="Manzil" placeholder="Toshkent, Chilonzor" value={sotishForm.manzil} onChange={setSotish('manzil')} />
        </div>
      )}
      <div className="flex items-stretch" style={{ flex: '0 0 30%' }}>
        {showCalc
          ? calcKeypad()
          : phoneTarget === 'sotish'
          ? <FullPhoneNumpad
              value={sotishForm.telefon}
              onChange={(v) => setSotishForm(f => ({ ...f, telefon: v }))}
              onClose={() => setPhoneTarget(null)}
            />
          : null
        }
      </div>
    </div>
  )

  // RESERVED yoki SOLD bo'lsa — minimal info card
  if (apartment.status === 'RESERVED' || apartment.status === 'SOLD') {
    const isReserved = apartment.status === 'RESERVED'
    return <StatusCard apartment={apartment} isReserved={isReserved} onClose={onClose} onBooked={onBooked} />
  }

  if (booked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" style={{ backdropFilter: 'blur(4px)' }}>
        <div className="bg-background rounded-2xl shadow-2xl border border-border flex flex-col items-center gap-6 px-10 py-12 w-full max-w-sm text-center">
          <CheckCircle size={56} className="text-green-500" />
          <div>
            <p className="text-xl font-bold text-foreground">{booked.type === 'bron' ? 'Bron muvaffaqiyatli!' : 'Sotish rasmiylashtirildi!'}</p>
            <p className="text-sm text-muted-foreground mt-1">{apartment.address} · {booked.form.ism} {booked.form.familiya}</p>
          </div>
          {booked.type === 'bron' && (
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors active:scale-[0.98] disabled:opacity-60"
            >
              {pdfLoading
                ? <Loader2 size={16} className="animate-spin" />
                : <FileText size={16} />
              }
              {pdfLoading ? 'Tayyorlanmoqda...' : 'Shartnoma PDF'}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Yopish
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full h-full bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-5 border-b border-border shrink-0 h-24">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-foreground">{apartment.address}</span>
            {apartment.size > 0 && (
              <span className="text-xl text-muted-foreground font-medium">{apartment.size} m²</span>
            )}
            {apartment.notes && (
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold border border-amber-200">{apartment.notes}</span>
            )}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onPointerDown={calcLongPressStart}
            onPointerUp={calcLongPressEnd}
            onPointerCancel={() => { clearTimeout(longPressTimer.current); longPressTimer.current = null }}
            onContextMenu={e => e.preventDefault()}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shrink-0 select-none touch-manipulation ${showCalc ? 'bg-amber-100 text-amber-600' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            title="Kalkulator (bosib turing: 0 dan boshlash)"
          >
            <Calculator size={22} />
          </button>
          <div className="w-px h-10 bg-border mx-1 shrink-0" />
          <button
            onClick={() => {
              if (showCalc) {
                setCalc({ narxM2: '', boshlangich: '', oylar: '12', focus: 'narxM2' })
                fetchCalcPrice()
              } else {
                setBronForm(BRON_EMPTY); setSotishForm(SOTISH_EMPTY)
              }
            }}
            className="w-14 h-14 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
            title="Formani tozalash"
          >
            <RotateCcw size={22} />
          </button>
          <div className="w-px h-10 bg-border mx-2 shrink-0" />
          <button
            onClick={onClose}
            className="w-14 h-14 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
            style={{ fontSize: 42 }}
          >
            ×
          </button>
        </div>

        {/* Tasdiqlash dialogi */}
        {confirmPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-2xl" style={{ backdropFilter: 'blur(2px)' }}>
            <div className="bg-background rounded-2xl shadow-2xl border border-border flex flex-col gap-5 px-7 py-7 w-full max-w-sm mx-4">
              <div>
                <p className="text-lg font-bold text-foreground">
                  {confirmPending === 'bron' ? 'Bron qilishni tasdiqlang' : 'Sotishni tasdiqlang'}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{apartment.address}</p>
              </div>

              {/* Menejer tanlash */}
              <div>
                <label className={LABEL}>Kim nomiga?</label>
                <div className="relative">
                  <select
                    value={assignedUserId ?? ''}
                    onChange={(e) => setAssignedUserId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none pr-10"
                  >
                    <option value="">{currentUser?.name ?? 'Men'} (o'zim)</option>
                    {managers.filter(m => m.id !== currentUser?.sub).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setConfirmPending(null); setAssignedUserId(null) }}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={() => submitBooking(confirmPending)}
                  disabled={submitting}
                  className={`flex-1 py-3 rounded-xl text-white font-semibold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 ${
                    confirmPending === 'bron' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? 'Saqlanmoqda...' : 'Tasdiqlash'}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Kontent */}
        <div className="flex flex-col flex-1 min-h-0">
          {tab === 'bron' ? (
            <form id="bron-form" onSubmit={(e) => {
              e.preventDefault()
              const errs = getErrors(bronForm)
              if (Object.keys(errs).length > 0) { setShowErrors(true); return }
              setConfirmPending('bron')
            }} className="flex flex-col flex-1 min-h-0">
              {bronFields}
            </form>
          ) : (
            <form id="sotish-form" onSubmit={(e) => {
              e.preventDefault()
              const errs = getErrors(sotishForm)
              if (Object.keys(errs).length > 0) { setShowErrors(true); return }
              setConfirmPending('sotish')
            }} className="flex flex-col flex-1 min-h-0">
              {sotishFields}
            </form>
          )}

          {/* Pastki bar */}
          {!showCalc && <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex flex-col gap-2">
            {submitError && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {submitError}
              </div>
            )}
            <div className="flex items-stretch gap-3">
              <div className="flex p-1 bg-muted rounded-xl gap-1 min-w-72">
                {[['bron', 'Bron qilish'], ['sotish', 'Sotish']].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setTab(key); setSubmitError(null); setShowErrors(false) }}
                    className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                      tab === key
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'bron' ? (
                <button
                  type="submit"
                  form="bron-form"
                  disabled={submitting || (showErrors && hasErrors)}
                  className="flex-1 py-4 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-600"
                >
                  {submitting && <Loader2 size={18} className="animate-spin" />}
                  {submitting ? 'Saqlanmoqda...' : 'Bron qilish'}
                </button>
              ) : (
                <button
                  type="submit"
                  form="sotish-form"
                  disabled={submitting || (showErrors && hasErrors)}
                  className="flex-1 py-4 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700"
                >
                  {submitting && <Loader2 size={18} className="animate-spin" />}
                  {submitting ? 'Saqlanmoqda...' : 'Sotish'}
                </button>
              )}
            </div>
          </div>}
        </div>
      </div>
    </div>
  )
}
