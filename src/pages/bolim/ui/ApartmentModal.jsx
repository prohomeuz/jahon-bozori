import { Loader2, Mic, RotateCcw, FileText, CheckCircle, Lock, ShoppingBag, Ruler, X } from 'lucide-react'
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

async function downloadContractPDF({ apartment, floor, blockId, bolimNum, form, type, managerName }) {
  const { pdf } = await import('@react-pdf/renderer')

  // Floor plan image: blocks/{BLOCK}/{FLOOR}/{BOLIM}.png
  const rawFloorImg = loadImg(blockId, floor, bolimNum)

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
    />
  ).toBlob()
  return blob
}

async function transcribe(blob) {
  const fd = new FormData()
  fd.append('file', blob, 'voice.webm')
  const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd })
  const data = await res.json()
  return data.text ?? ''
}

async function extractFields(text) {
  const res = await fetch('/api/voice/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return res.json()
}

const INPUT =
  'w-full rounded-xl border border-border bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow'
const LABEL = 'block text-sm font-medium text-foreground mb-1.5'
const FLASH_CLASS = ' ring-2 ring-green-400 bg-green-50 border-green-300'
const FLASH_STYLE = { transition: 'box-shadow 0.4s, background 0.4s, border-color 0.4s' }

// Faqat o'zbek raqamlar: +998 XX XXX XX XX
function formatUzPhone(raw) {
  // Faqat raqamlar
  let digits = String(raw ?? '').replace(/\D/g, '')
  // 998 bilan boshlanganini olib tashla, 0 bilan boshlanganini olib tashla
  if (digits.startsWith('998')) digits = digits.slice(3)
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

function Field({ label, flash, ...props }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input className={INPUT + (flash ? FLASH_CLASS : '')} style={FLASH_STYLE} {...props} />
    </div>
  )
}

function PhoneField({ label, value, onChange, flash }) {
  function handleChange(e) {
    onChange(formatUzPhone(e.target.value))
  }
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input
        type="tel"
        inputMode="numeric"
        className={INPUT + (flash ? FLASH_CLASS : '')}
        style={FLASH_STYLE}
        value={value}
        onChange={handleChange}
        placeholder="+998 90 123 45 67"
        autoComplete="tel"
      />
    </div>
  )
}

function MoneyField({ label, value, onChange, flash }) {
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
          className={INPUT + ' pr-16' + (flash ? FLASH_CLASS : '')}
          style={FLASH_STYLE}
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
      <div className="flex gap-2 mb-2">
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
      <div className="relative mb-3">
        <input
          type="number"
          className={INPUT + ' pr-14'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min="12"
          max="48"
          required
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold pointer-events-none select-none">
          oy
        </span>
      </div>
      <input
        type="range"
        min="12"
        max="48"
        step="1"
        value={num}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none h-2 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, #16a34a ${((num - 12) / 36) * 100}%, #e5e7eb ${((num - 12) / 36) * 100}%)`,
        }}
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>12 oy</span>
        <span>48 oy</span>
      </div>
    </div>
  )
}

function VoiceRecorder({ onExtracted }) {
  const [status, setStatus] = useState('idle')
  const mrRef = useRef(null)
  const chunksRef = useRef([])

  async function startRecording(e) {
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    if (status !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setStatus('processing')
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          const text = await transcribe(blob)
          if (text) {
            const fields = await extractFields(text)
            onExtracted(fields)
          }
        } finally {
          setStatus('idle')
        }
      }
      mr.start()
      mrRef.current = mr
      setStatus('recording')
    } catch {
      setStatus('idle')
    }
  }

  function stopRecording() {
    if (mrRef.current?.state === 'recording') mrRef.current.stop()
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <button
        type="button"
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerCancel={stopRecording}
        onContextMenu={(e) => e.preventDefault()}
        disabled={status === 'processing'}
        style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all select-none ${
          status === 'recording'
            ? 'bg-red-500 text-white scale-110 shadow-xl shadow-red-200'
            : status === 'processing'
            ? 'bg-muted text-muted-foreground cursor-wait'
            : 'bg-muted text-muted-foreground hover:bg-secondary active:scale-95'
        }`}
      >
        {status === 'processing' ? <Loader2 size={40} className="animate-spin" /> : <Mic size={40} />}
      </button>
      <p className="text-sm text-center leading-tight">
        {status === 'recording' && <span className="text-red-500 font-medium">Yozilmoqda...</span>}
        {status === 'processing' && <span className="text-muted-foreground">Tahlil qilinmoqda...</span>}
        {status === 'idle' && <span className="text-muted-foreground">Bosib turing</span>}
      </p>
    </div>
  )
}

const BRON_EMPTY = { ism: '', familiya: '', telefon: '', boshlangich: '', oylar: '12', umumiy: '' }
const SOTISH_EMPTY = { ism: '', familiya: '', telefon: '', boshlangich: '', oylar: '12', umumiy: '', passport: '', passport_place: '', manzil: '' }

export function ApartmentModal({ apartment, floor, blockId, bolimNum, onClose, onBooked }) {
  const [tab, setTab] = useState('bron')
  const [bronForm, setBronForm] = useState(BRON_EMPTY)
  const [sotishForm, setSotishForm] = useState(SOTISH_EMPTY)
  const [flash, setFlash] = useState(new Set())
  const [booked, setBooked] = useState(null) // { form, type }
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!apartment) return null

  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

  const setBron = (key) => (e) => setBronForm((f) => ({ ...f, [key]: e.target.value }))
  const setBronCap = (key) => (e) => setBronForm((f) => ({ ...f, [key]: cap(e.target.value) }))
  const setSotish = (key) => (e) => setSotishForm((f) => ({ ...f, [key]: e.target.value }))
  const setSotishCap = (key) => (e) => setSotishForm((f) => ({ ...f, [key]: cap(e.target.value) }))

  function handleExtracted(fields) {
    if (fields.ism) fields.ism = cap(fields.ism)
    if (fields.familiya) fields.familiya = cap(fields.familiya)
    // GPT ba'zan "phone" kalit bilan qaytaradi — normallashtir
    const rawPhone = fields.telefon || fields.phone || ''
    if (rawPhone) fields.telefon = formatUzPhone(rawPhone)
    delete fields.phone
    setBronForm((f) => ({ ...f, ...fields }))
    const filled = new Set(Object.keys(fields).filter((k) => fields[k]))
    setFlash(filled)
    setTimeout(() => setFlash(new Set()), 1200)
  }

  async function submitBooking(type) {
    const form = type === 'bron' ? bronForm : sotishForm
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
        phone: form.telefon || null,
        passport: form.passport || null,
        passport_place: form.passport_place || null,
        manzil: form.manzil || null,
      }),
    })
    const booking = await res.json()
    onBooked?.()
    setBooked({ form, type, bookingId: booking.id })

    // Faqat bron uchun Telegramga PDF yuborish (background)
    if (type === 'bron' && booking.id) {
      const managerName = getUser()?.name ?? ''
      downloadContractPDF({ apartment, floor, blockId, bolimNum, form, type, managerName })
        .then(blob => {
          const fd = new FormData()
          fd.append('pdf', blob, `shartnoma-${apartment.address}.pdf`)
          fd.append('booking_id', String(booking.id))
          apiFetch('/api/bookings/send-pdf', { method: 'POST', body: fd }).catch(() => {})
        })
        .catch(() => {})
    }
  }

  async function handleDownloadPDF() {
    setPdfLoading(true)
    try {
      const managerName = getUser()?.name ?? ''
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

  const bronFields = (
    <div className="flex flex-1 min-h-0">
      <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto border-r border-border" style={{ flex: '0 0 70%' }}>
        <Field label="Ism" placeholder="Abdulloh" value={bronForm.ism} onChange={setBronCap('ism')} required autoComplete="given-name" flash={flash.has('ism')} />
        <Field label="Familiya" placeholder="Karimov" value={bronForm.familiya} onChange={setBronCap('familiya')} required autoComplete="family-name" flash={flash.has('familiya')} />
        <PhoneField label="Telefon raqam" value={bronForm.telefon} onChange={(v) => setBronForm((f) => ({ ...f, telefon: v }))} flash={flash.has('telefon')} />
        <MoneyField label="Kafolat summasi" value={bronForm.boshlangich} onChange={(v) => setBronForm((f) => ({ ...f, boshlangich: v }))} flash={flash.has('boshlangich')} />
        <MonthsField value={bronForm.oylar} onChange={(v) => setBronForm((f) => ({ ...f, oylar: v }))} />
        <MoneyField label="Umumiy narx" value={bronForm.umumiy} onChange={(v) => setBronForm((f) => ({ ...f, umumiy: v }))} />
      </div>
      <div className="flex items-center justify-center" style={{ flex: '0 0 30%' }}>
        <VoiceRecorder onExtracted={handleExtracted} />
      </div>
    </div>
  )

  const sotishFields = (
    <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto flex-1 min-h-0">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ism" placeholder="Abdulloh" value={sotishForm.ism} onChange={setSotishCap('ism')} required autoComplete="given-name" />
        <Field label="Familiya" placeholder="Karimov" value={sotishForm.familiya} onChange={setSotishCap('familiya')} required autoComplete="family-name" />
      </div>
      <PhoneField label="Telefon raqam" value={sotishForm.telefon} onChange={(v) => setSotishForm((f) => ({ ...f, telefon: v }))} />
      <div className="grid grid-cols-2 gap-4">
        <MoneyField label="Boshlang'ich to'lov" value={sotishForm.boshlangich} onChange={(v) => setSotishForm((f) => ({ ...f, boshlangich: v }))} />
        <MonthsField value={sotishForm.oylar} onChange={(v) => setSotishForm((f) => ({ ...f, oylar: v }))} />
        <MoneyField label="Umumiy narx" value={sotishForm.umumiy} onChange={(v) => setSotishForm((f) => ({ ...f, umumiy: v }))} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Passport seriya/raqam" placeholder="AA 1234567" value={sotishForm.passport} onChange={setSotish('passport')} />
        <Field label="Passport berilgan joy" placeholder="Toshkent sh. IIB" value={sotishForm.passport_place} onChange={setSotish('passport_place')} />
      </div>
      <Field label="Manzil" placeholder="Toshkent, Chilonzor" value={sotishForm.manzil} onChange={setSotish('manzil')} />
    </div>
  )

  // RESERVED yoki SOLD bo'lsa — faqat xabar ko'rsat, form ko'rsatma
  if (apartment.status === 'RESERVED' || apartment.status === 'SOLD') {
    const isReserved = apartment.status === 'RESERVED'
    const Icon = isReserved ? Lock : ShoppingBag
    const accent = isReserved
      ? { bg: 'bg-amber-50', ring: 'ring-amber-200', icon: 'text-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200', label: "Bron qilingan" }
      : { bg: 'bg-red-50',   ring: 'ring-red-200',   icon: 'text-red-500',   badge: 'bg-red-100   text-red-700   border-red-200',   label: "Sotilgan" }
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="relative bg-background rounded-3xl shadow-2xl border border-border flex flex-col items-center gap-5 px-8 py-10 w-full max-w-xs text-center">
          {/* Yopish tugmasi */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>

          {/* Icon */}
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${accent.bg} ring-2 ${accent.ring}`}>
            <Icon size={36} className={accent.icon} strokeWidth={1.75} />
          </div>

          {/* Manzil */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{apartment.address}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${accent.badge}`}>
              {accent.label}
            </span>
          </div>

          {/* Maydon */}
          {apartment.size > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Ruler size={14} />
              <span>{apartment.size} m²</span>
            </div>
          )}

          {/* Notes */}
          {apartment.notes && (
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200">
              {apartment.notes}
            </span>
          )}

          {/* Yopish */}
          <button
            onClick={onClose}
            className="w-full mt-1 py-3.5 rounded-2xl bg-muted text-sm font-semibold text-foreground hover:bg-muted/80 active:scale-[0.98] transition-all"
          >
            Yopish
          </button>
        </div>
      </div>
    )
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
            onClick={() => { setBronForm(BRON_EMPTY); setSotishForm(SOTISH_EMPTY); setFlash(new Set()) }}
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

        {/* Kontent */}
        <div className="flex flex-col flex-1 min-h-0">
          {tab === 'bron' ? (
            <form id="bron-form" onSubmit={(e) => { e.preventDefault(); submitBooking('bron') }} className="flex flex-col flex-1 min-h-0">
              {bronFields}
            </form>
          ) : (
            <form id="sotish-form" onSubmit={(e) => { e.preventDefault(); submitBooking('sotish') }} className="flex flex-col flex-1 min-h-0">
              {sotishFields}
            </form>
          )}

          {/* Pastki bar */}
          <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex items-stretch gap-3">
            <div className="flex p-1 bg-muted rounded-xl gap-1 min-w-72">
              {[['bron', 'Bron qilish'], ['sotish', 'Sotish']].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
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
                className="flex-1 py-4 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-all bg-amber-500 hover:bg-amber-600"
              >
                Bron qilish
              </button>
            ) : (
              <button
                type="submit"
                form="sotish-form"
                className="flex-1 py-4 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-all bg-green-600 hover:bg-green-700"
              >
                Sotish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
