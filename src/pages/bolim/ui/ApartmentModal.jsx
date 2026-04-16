import { Loader2, Mic, RotateCcw, FileText, CheckCircle, Lock, ShoppingBag, Ruler, X, ChevronDown, Calculator } from 'lucide-react'
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

// iOS va boshqa platformalarda ishlaydi
function getBestMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ]
  if (typeof MediaRecorder === 'undefined') return null
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

// Float32Array → 16-bit PCM WAV (16kHz mono)
function encodeWav(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, samples.length * 2, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    off += 2
  }
  return buf
}

// Browser WebM/Opus/MP4 → WAV 16kHz mono (UzbekVoice WAV qabul qiladi)
async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new AudioContext({ sampleRate: 16000 })
  const audioBuf = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()
  // Stereo bo'lsa birinchi channelni olamiz (mono)
  const samples = audioBuf.getChannelData(0)
  return new Blob([encodeWav(samples, 16000)], { type: 'audio/wav' })
}

async function transcribe(blob) {
  // Browser audio (WebM/Opus/MP4) → WAV, UzbekVoice uchun
  const wavBlob = await blobToWav(blob)
  const fd = new FormData()
  fd.append('file', wavBlob, 'voice.wav')
  const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw Object.assign(new Error('transcribe'), { code: data.error })
  return data.text ?? ''
}

async function extractFields(text) {
  const res = await fetch('/api/voice/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('extract failed')
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

function PhoneField({ label, value, flash, onOpenNumpad, isOpen }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input
        type="tel"
        readOnly
        className={INPUT + (flash ? FLASH_CLASS : '') + (isOpen ? ' ring-2 ring-ring border-ring' : '')}
        style={{ ...FLASH_STYLE, cursor: 'pointer' }}
        value={value}
        placeholder="+998 90 123 45 67"
        onPointerDown={e => { e.preventDefault(); onOpenNumpad() }}
      />
    </div>
  )
}

const PHONE_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

function getRawDigits(val) {
  let d = String(val ?? '').replace(/\D/g, '')
  if (d.startsWith('998')) d = d.slice(3)
  else if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 9)
}

function FullPhoneNumpad({ value, onChange, onClose }) {
  function press(k) {
    const raw = getRawDigits(value)
    if (k === '⌫') { onChange(formatUzPhone(raw.slice(0, -1))); return }
    if (raw.length >= 9) return
    const next = raw + k
    onChange(formatUzPhone(next))
    if (next.length === 9) onClose()
  }

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
              onPointerDown={e => { e.preventDefault(); press('⌫') }}
              className="rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center active:scale-95 transition-transform select-none touch-manipulation">
              <svg width="20" height="15" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9L3 9z"/>
                <line x1="13" y1="7" x2="17" y2="11"/><line x1="17" y1="7" x2="13" y2="11"/>
              </svg>
            </button>
          ) : (
            <button key={i} type="button"
              onPointerDown={e => { e.preventDefault(); press(k) }}
              className="rounded-2xl bg-muted/60 text-foreground text-xl font-semibold flex items-center justify-center active:scale-95 transition-transform select-none touch-manipulation hover:bg-muted">
              {k}
            </button>
          )
        )}
      </div>
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

// idle | recording | transcribing | extracting | done | error
function VoiceRecorder({ onExtracted }) {
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [transcript, setTranscript] = useState('')
  const mrRef = useRef(null)
  const chunksRef = useRef([])
  const mimeRef = useRef('')

  async function startRecording(e) {
    e.preventDefault()
    if (status === 'recording') { stopRecording(); return }
    if (status !== 'idle' && status !== 'error' && status !== 'done') return
    setErrorMsg('')
    setTranscript('')

    if (typeof MediaRecorder === 'undefined') {
      setStatus('error')
      setErrorMsg("Qurilma ovoz yozishni qo'llab-quvvatlamaydi")
      return
    }

    const mimeType = getBestMimeType()
    if (mimeType === null) {
      setStatus('error')
      setErrorMsg("Ovoz yozish qo'llab-quvvatlanmaydi")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      mimeRef.current = mr.mimeType || mimeType || 'audio/webm'
      chunksRef.current = []

      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data) }
      mr.onerror = () => {
        stream.getTracks().forEach(t => t.stop())
        setStatus('error')
        setErrorMsg("Yozish xatosi. Qayta urinib ko'ring.")
      }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (chunksRef.current.length === 0) { setStatus('idle'); return }
        try {
          setStatus('transcribing')
          const blob = new Blob(chunksRef.current, { type: mimeRef.current })
          const text = await transcribe(blob)
          if (!text) {
            setStatus('error')
            setErrorMsg("Ovoz tanilmadi. Qayta urinib ko'ring.")
            return
          }
          setTranscript(text)
          setStatus('extracting')
          const fields = await extractFields(text)
          onExtracted(fields)
          setStatus('done')
          setTimeout(() => { setStatus('idle'); setTranscript('') }, 2500)
        } catch (err) {
          setStatus('error')
          setErrorMsg(err?.code === 'transcribe_failed' ? "Ovoz xizmati ishlamayapti" : "Qayta urinib ko'ring")
        }
      }

      mr.start(250) // iOS da chunk'lar kelmasa ham ishlaydi
      mrRef.current = mr
      setStatus('recording')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err?.name === 'NotAllowedError' ? "Mikrofon ruxsati berilmagan" : "Mikrofon ishlamayapti")
    }
  }

  function stopRecording(e) {
    e?.preventDefault()
    if (mrRef.current?.state === 'recording') mrRef.current.stop()
  }

  const isProcessing = status === 'transcribing' || status === 'extracting'

  return (
    <div className="flex flex-col items-center gap-3 px-4">
      <button
        type="button"
        onClick={startRecording}
        onContextMenu={(e) => e.preventDefault()}
        disabled={isProcessing}
        style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all select-none ${
          status === 'recording'
            ? 'bg-red-500 text-white scale-110 shadow-xl shadow-red-200'
            : isProcessing
            ? 'bg-muted text-muted-foreground cursor-wait'
            : status === 'done'
            ? 'bg-green-500 text-white scale-105'
            : status === 'error'
            ? 'bg-red-50 text-red-400 border-2 border-red-200'
            : 'bg-muted text-muted-foreground hover:bg-secondary active:scale-95'
        }`}
      >
        {isProcessing
          ? <Loader2 size={40} className="animate-spin" style={{ pointerEvents: 'none' }} />
          : status === 'done'
          ? <CheckCircle size={40} style={{ pointerEvents: 'none' }} />
          : <Mic size={40} style={{ pointerEvents: 'none' }} />
        }
      </button>
      <div className="text-sm text-center leading-tight min-h-[20px]">
        {status === 'recording'    && <span className="text-red-500 font-medium">Yozilmoqda... (qayta bosing)</span>}
        {status === 'transcribing' && <span className="text-muted-foreground">Matn ajratilmoqda...</span>}
        {status === 'extracting'   && <span className="text-muted-foreground">Ma'lumot olinmoqda...</span>}
        {status === 'done'         && <span className="text-green-600 font-medium">To'ldirildi</span>}
        {status === 'idle'         && <span className="text-muted-foreground">Bosing → gapiring → qayta bosing</span>}
        {status === 'error'        && <span className="text-red-500 text-xs">{errorMsg}</span>}
      </div>
      {transcript && (
        <p className="text-xs text-muted-foreground text-center italic max-w-[220px] line-clamp-2">"{transcript}"</p>
      )}
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
  const [flash, setFlash] = useState(new Set())
  const [booked, setBooked] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [managers, setManagers] = useState([])
  const [assignedUserId, setAssignedUserId] = useState(null) // null = o'zi
  const [confirmPending, setConfirmPending] = useState(null) // 'bron' | 'sotish'
  const [showCalc, setShowCalc] = useState(false)
  const [calc, setCalc] = useState({ narxM2: '', boshlangich: '', oylar: '12', focus: 'narxM2' })
  const [phoneTarget, setPhoneTarget] = useState(null) // null | 'bron' | 'sotish'

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

  if (!apartment) return null

  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

  const setBron = (key) => (e) => setBronForm((f) => ({ ...f, [key]: e.target.value }))
  const setBronCap = (key) => (e) => setBronForm((f) => ({ ...f, [key]: cap(e.target.value) }))
  const setSotish = (key) => (e) => setSotishForm((f) => ({ ...f, [key]: e.target.value }))
  const setSotishCap = (key) => (e) => setSotishForm((f) => ({ ...f, [key]: cap(e.target.value) }))

  function handleExtracted(raw) {
    // Faqat ism, familiya, telefon — boshqa hamma narsani e'tiborsiz qoldir
    const fields = {}
    if (raw.ism)      fields.ism      = cap(String(raw.ism))
    if (raw.familiya) fields.familiya = cap(String(raw.familiya))
    // GPT ba'zan "phone" kalit bilan qaytaradi — normallashtir
    const rawPhone = raw.telefon || raw.phone || ''
    if (rawPhone)     fields.telefon  = formatUzPhone(String(rawPhone))
    if (!Object.keys(fields).length) return
    setBronForm(f => ({ ...f, ...fields }))
    setSotishForm(f => ({ ...f, ...fields }))
    const filled = new Set(Object.keys(fields).filter(k => fields[k]))
    setFlash(filled)
    setTimeout(() => setFlash(new Set()), 1200)
  }

  const assignedManager = assignedUserId
    ? managers.find(m => m.id === assignedUserId)
    : null
  const effectiveManagerName = assignedManager?.name ?? currentUser?.name ?? ''

  async function submitBooking(type) {
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
            apiFetch('/api/bookings/send-pdf', { method: 'POST', body: fd }).catch(() => {})
          })
          .catch(() => {})
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

  const calcKeypad = (() => {
    const narxVal = Number(String(calc.narxM2).replace(/\s/g, ''))
    const downVal = Number(String(calc.boshlangich).replace(/\s/g, ''))
    const months  = parseInt(calc.oylar) || 12
    const total   = apartment.size * narxVal
    const monthly = total > 0 ? Math.round((total - downVal) / months) : 0

    function pressKey(key) {
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
                k === '⌫' ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'
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
    const FIELDS  = [
      { key: 'boshlangich', label: "Boshlang'ich",  unit: 'USD', val: calc.boshlangich },
    ]
    function transferToForm() {
      if (calc.narxM2)      setBronForm(f => ({ ...f, narx_m2: calc.narxM2 }))
      if (calc.boshlangich) setBronForm(f => ({ ...f, boshlangich: calc.boshlangich }))
      if (calc.oylar)       setBronForm(f => ({ ...f, oylar: calc.oylar }))
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
        </div>

        {/* Formaga o'tkazish */}
        <button type="button" onClick={transferToForm}
          className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm active:scale-[0.98] transition-all shrink-0"
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
          <Field label="Ism" placeholder="Abdulloh" value={bronForm.ism} onChange={setBronCap('ism')} required autoComplete="given-name" flash={flash.has('ism')} />
          <Field label="Familiya" placeholder="Karimov" value={bronForm.familiya} onChange={setBronCap('familiya')} required autoComplete="family-name" flash={flash.has('familiya')} />
          <PhoneField label="Telefon raqam" value={bronForm.telefon}
            flash={flash.has('telefon')}
            isOpen={phoneTarget === 'bron'}
            onOpenNumpad={() => setPhoneTarget(t => t === 'bron' ? null : 'bron')}
          />
          {(bronForm.boshlangich || bronForm.narx_m2) ? (
            <div className="flex-1 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 flex flex-col justify-between">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-amber-700 mb-1">Kafolat summasi</p>
                  <p className="text-xl font-bold text-foreground">{bronForm.boshlangich || '—'} <span className="text-sm font-normal text-muted-foreground">USD</span></p>
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
          ) : null}
        </div>
      )}
      <div className={`flex ${showCalc || phoneTarget === 'bron' ? 'items-stretch' : 'items-center justify-center'}`} style={{ flex: '0 0 30%' }}>
        {showCalc
          ? calcKeypad()
          : phoneTarget === 'bron'
          ? <FullPhoneNumpad
              value={bronForm.telefon}
              onChange={(v) => setBronForm(f => ({ ...f, telefon: v }))}
              onClose={() => setPhoneTarget(null)}
            />
          : <VoiceRecorder onExtracted={handleExtracted} />
        }
      </div>
    </div>
  )

  const sotishFields = (
    <div className="flex flex-1 min-h-0">
      <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto border-r border-border" style={{ flex: '0 0 70%' }}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ism" placeholder="Abdulloh" value={sotishForm.ism} onChange={setSotishCap('ism')} required autoComplete="given-name" />
        <Field label="Familiya" placeholder="Karimov" value={sotishForm.familiya} onChange={setSotishCap('familiya')} required autoComplete="family-name" />
      </div>
      <PhoneField label="Telefon raqam" value={sotishForm.telefon}
        isOpen={phoneTarget === 'sotish'}
        onOpenNumpad={() => setPhoneTarget(t => t === 'sotish' ? null : 'sotish')}
      />
      <div className="grid grid-cols-2 gap-4">
        <MoneyField label="Boshlang'ich to'lov" value={sotishForm.boshlangich} onChange={(v) => setSotishForm((f) => ({ ...f, boshlangich: v }))} />
        <MonthsField value={sotishForm.oylar} onChange={(v) => setSotishForm((f) => ({ ...f, oylar: v }))} />
        <MoneyField label="Kvadrat metr narxi" value={sotishForm.narx_m2} onChange={(v) => setSotishForm((f) => ({ ...f, narx_m2: v }))} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Passport seriya/raqam" placeholder="AA 1234567" value={sotishForm.passport} onChange={setSotish('passport')} />
        <Field label="Passport berilgan joy" placeholder="Toshkent sh. IIB" value={sotishForm.passport_place} onChange={setSotish('passport_place')} />
      </div>
      <Field label="Manzil" placeholder="Toshkent, Chilonzor" value={sotishForm.manzil} onChange={setSotish('manzil')} />
      </div>
      <div className="flex items-stretch" style={{ flex: '0 0 30%' }}>
        {phoneTarget === 'sotish' && (
          <FullPhoneNumpad
            value={sotishForm.telefon}
            onChange={(v) => setSotishForm(f => ({ ...f, telefon: v }))}
            onClose={() => setPhoneTarget(null)}
          />
        )}
      </div>
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
            type="button"
            onClick={() => setShowCalc(v => !v)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shrink-0 ${showCalc ? 'bg-amber-100 text-amber-600' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            title="Kalkulator"
          >
            <Calculator size={22} />
          </button>
          <div className="w-px h-10 bg-border mx-1 shrink-0" />
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
                    {managers.filter(m => m.id !== currentUser?.id).map(m => (
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
            <form id="bron-form" onSubmit={(e) => { e.preventDefault(); setConfirmPending('bron') }} className="flex flex-col flex-1 min-h-0">
              {bronFields}
            </form>
          ) : (
            <form id="sotish-form" onSubmit={(e) => { e.preventDefault(); setConfirmPending('sotish') }} className="flex flex-col flex-1 min-h-0">
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
                    disabled={key === 'sotish'}
                    onClick={() => { setTab(key); setSubmitError(null) }}
                    className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                      tab === key
                        ? 'bg-background text-foreground shadow-sm'
                        : key === 'sotish'
                        ? 'text-muted-foreground/40 cursor-not-allowed'
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
                  disabled={submitting}
                  className="flex-1 py-4 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-all bg-amber-500 hover:bg-amber-600 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={18} className="animate-spin" />}
                  {submitting ? 'Saqlanmoqda...' : 'Bron qilish'}
                </button>
              ) : (
                <button
                  type="submit"
                  form="sotish-form"
                  disabled={submitting}
                  className="flex-1 py-4 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-all bg-green-600 hover:bg-green-700 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
