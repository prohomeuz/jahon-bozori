import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Loader2, Mic, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const UV_KEY = import.meta.env.VITE_UV_KEY
const GPT_KEY = import.meta.env.VITE_GPT_KEY

async function transcribe(blob) {
  const fd = new FormData()
  fd.append('file', blob, 'voice.webm')
  fd.append('enable_diarization', 'false')
  const res = await fetch('https://uzbekvoice.ai/api/v1/stt', {
    method: 'POST',
    headers: { Authorization: `Bearer ${UV_KEY}` },
    body: fd,
  })
  const data = await res.json()
  return (data?.result?.text ?? '').trim()
}

async function extractFields(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GPT_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `O'zbek tilidagi matndan quyidagi ma'lumotlarni ajrat va JSON qaytar.

Qoidalar:
- "ismim X", "ismi X", "X ismli" → ism: "X"
- "familiyam X", "familiyasi X", "X familiyali", "X deb ataladi" → familiya: "X"
- Agar faqat ism yoki faqat familiya aytilsa, faqat shuni to'ldir, qolganlarni bo'sh qoldir
- Tartib muhim emas — qayerda aytilsa ham to'g'ri ajrat
- boshlangich: to'lov raqami, bo'shliqli format "10 000 000" (so'm yoki dollar miqdori)
- oylar: necha oyga olayotgani, faqat raqam string "24"
- Topilmasa bo'sh string

JSON kalitlari: ism, familiya, boshlangich, oylar`,
        },
        { role: 'user', content: String(text) },
      ],
    }),
  })
  const data = await res.json()
  try {
    return JSON.parse(data.choices[0].message.content)
  } catch {
    return {}
  }
}

const INPUT =
  'w-full rounded-xl border border-border bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow'
const LABEL = 'block text-sm font-medium text-foreground mb-1.5'
const FLASH_CLASS = ' ring-2 ring-green-400 bg-green-50 border-green-300'
const FLASH_STYLE = { transition: 'box-shadow 0.4s, background 0.4s, border-color 0.4s' }

function Field({ label, flash, ...props }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input className={INPUT + (flash ? FLASH_CLASS : '')} style={FLASH_STYLE} {...props} />
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
    e.currentTarget.setPointerCapture(e.pointerId)
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
        disabled={status === 'processing'}
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

const EMPTY = { ism: '', familiya: '', boshlangich: '', oylar: '12', passport: '', manzil: '' }

export function ApartmentModal({ apartment, floor, blockId, bolimNum, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [flash, setFlash] = useState(new Set())

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!apartment) return null

  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setCap = (key) => (e) => setForm((f) => ({ ...f, [key]: cap(e.target.value) }))

  function handleExtracted(fields) {
    if (fields.ism) fields.ism = cap(fields.ism)
    if (fields.familiya) fields.familiya = cap(fields.familiya)
    setForm((f) => ({ ...f, ...fields }))
    const filled = new Set(Object.keys(fields).filter((k) => fields[k]))
    setFlash(filled)
    setTimeout(() => setFlash(new Set()), 1200)
  }

  function handleSubmit(action) {
    return (e) => {
      e.preventDefault()
      console.log({ action, apartment, ...form })
      onClose()
    }
  }

  const commonFields = (
    <>
      <Field label="Ism" placeholder="Abdulloh" value={form.ism} onChange={setCap('ism')} required autoComplete="given-name" flash={flash.has('ism')} />
      <Field label="Familiya" placeholder="Karimov" value={form.familiya} onChange={setCap('familiya')} required autoComplete="family-name" flash={flash.has('familiya')} />
      <MoneyField label="Boshlang'ich to'lov" value={form.boshlangich} onChange={(v) => setForm((f) => ({ ...f, boshlangich: v }))} flash={flash.has('boshlangich')} />
      <MonthsField value={form.oylar} onChange={(v) => setForm((f) => ({ ...f, oylar: v }))} />
    </>
  )

  const formBody = (extraFields) => (
    <div className="flex flex-1 min-h-0">
      <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto border-r border-border" style={{ flex: '0 0 70%' }}>
        {commonFields}
        {extraFields}
      </div>
      <div className="flex items-center justify-center" style={{ flex: '0 0 30%' }}>
        <VoiceRecorder onExtracted={handleExtracted} />
      </div>
    </div>
  )

  const bottomBar = (label, btnClass) => (
    <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex items-stretch gap-3">
      <TabsList className="h-auto! self-stretch p-1 min-w-72">
        <TabsTrigger value="bron" className="h-full! flex-1">Bron qilish</TabsTrigger>
        <TabsTrigger value="sotish" className="h-full! flex-1">Sotish</TabsTrigger>
      </TabsList>
      <button type="submit" className={`flex-1 py-4 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-all ${btnClass}`}>
        {label}
      </button>
    </div>
  )

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
            <span className="text-3xl font-bold text-foreground">{blockId}-BLOK</span>
            <span className="text-3xl text-muted-foreground">→</span>
            <span className="text-3xl font-bold text-foreground">{bolimNum}-BO'LIM</span>
            <span className="text-3xl text-muted-foreground">→</span>
            <span className="text-3xl font-bold text-foreground">{floor}-QAVAT</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => { setForm(EMPTY); setFlash(new Set()) }}
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

        {/* Tabs */}
        <Tabs defaultValue="bron" className="flex flex-col flex-1 min-h-0">
          <TabsContent value="bron" className="flex flex-col flex-1 min-h-0 mt-0">
            <form onSubmit={handleSubmit('bron')} className="flex flex-col flex-1 min-h-0">
              {formBody(null)}
              {bottomBar('Bron qilish', 'bg-amber-500 hover:bg-amber-600')}
            </form>
          </TabsContent>

          <TabsContent value="sotish" className="flex flex-col flex-1 min-h-0 mt-0">
            <form onSubmit={handleSubmit('sotish')} className="flex flex-col flex-1 min-h-0">
              {formBody(
                <>
                  <Field label="Passport seriya va raqami" placeholder="AA 1234567" value={form.passport} onChange={set('passport')} required />
                  <Field label="Yashash manzili" placeholder="Toshkent, Chilonzor tumani..." value={form.manzil} onChange={set('manzil')} required />
                </>
              )}
              {bottomBar('Sotish', 'bg-green-600 hover:bg-green-700')}
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
