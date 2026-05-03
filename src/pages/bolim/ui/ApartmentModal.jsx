import { Loader2, RotateCcw, FileText, CheckCircle, X, ChevronDown, Calculator } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, getUser } from '@/shared/lib/auth'
import { StatusCard } from './StatusCard'
import { Field, PhoneField, PassportField, FullPhoneNumpad, LABEL, getRawDigits } from './FormFields'
import { downloadContractPDF } from '../lib/pdfExport.jsx'

import imgKonditsioner from '@/assets/bonus/konditsioner.webp'
import imgTV from '@/assets/bonus/tv.webp'
import imgMuzlatgich from '@/assets/bonus/muzlatgich.webp'

const CHEGIRMA_TABLE = { 30: 100, 40: 150, 50: 200, 60: 250, 70: 300, 100: 400 }
const BONUS_TABLE = {
  30:  [{ img: imgKonditsioner, name: 'Konditsioner' }],
  40:  [{ img: imgKonditsioner, name: 'Konditsioner' }],
  50:  [{ img: imgKonditsioner, name: 'Konditsioner' }, { img: imgTV, name: 'TV (43)' }],
  60:  [{ img: imgKonditsioner, name: 'Konditsioner' }, { img: imgTV, name: 'TV (43)' }],
  70:  [{ img: imgKonditsioner, name: 'Konditsioner' }, { img: imgMuzlatgich, name: 'Muzlatgich' }],
  100: [{ img: imgKonditsioner, name: 'Konditsioner' }, { img: imgTV, name: 'TV (43)' }, { img: imgMuzlatgich, name: 'Muzlatgich' }],
}
const TIERS = [
  { pct: 30, disc: 100 }, { pct: 40, disc: 150 }, { pct: 50, disc: 200 },
  { pct: 60, disc: 250 }, { pct: 70, disc: 300 }, { pct: 100, disc: 400 },
]
const MUDDAT_STEPS      = [36, 48, 60]
const CHEGIRMA_BRACKETS = [100, 70, 60, 50, 40, 30]
const BONUS_BRACKETS    = [100, 70, 60, 50, 40, 30]
const CALC_KEYS         = ['7','8','9','4','5','6','1','2','3','C','0','⌫']
const BRON_EMPTY   = { ism: '', familiya: '', telefon: '', boshlangich: '', oylar: '12', umumiy: '', narx_m2: '', chegirma_m2: '', asl_narx_m2: '', source_id: null }
const SOTISH_EMPTY = { ism: '', familiya: '', telefon: '', boshlangich: '', oylar: '12', umumiy: '', narx_m2: '', passport: '', passport_place: '', manzil: '', source_id: null }

function playDiscountSound() {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime
    function note(freq, t, dur, vol = 0.3) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(vol, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(t); osc.stop(t + dur)
    }
    note(523.25, now,        0.25, 0.28); note(659.25, now + 0.10, 0.25, 0.28)
    note(783.99, now + 0.20, 0.25, 0.28); note(1046.5, now + 0.30, 0.50, 0.30)
    note(1318.5, now + 0.32, 0.50, 0.20); note(1567.98, now + 0.34, 0.50, 0.15)
  } catch {}
}

export function ApartmentModal({ apartment, floor, blockId, bolimNum, onClose, onBooked, embedded = false }) {
  const currentUser = getUser()
  const [tab, setTab]                   = useState('bron')
  const [bronForm, setBronForm]         = useState(BRON_EMPTY)
  const [sotishForm, setSotishForm]     = useState(SOTISH_EMPTY)
  const [booked, setBooked]             = useState(null)
  const [pdfLoading, setPdfLoading]     = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState(null)
  const [managers, setManagers]         = useState([])
  const [assignedUserId, setAssignedUserId] = useState(null)
  const [confirmPending, setConfirmPending] = useState(null)
  const [showErrors, setShowErrors]     = useState(false)
  const [showCalc, setShowCalc]         = useState(false)
  const [bonusPreview, setBonusPreview] = useState(null)
  const [calc, setCalc]                 = useState({ narxM2: '', boshlangich: '', oylar: '12', muddatStep: 0, focus: 'boshlangich' })
  const [phoneTarget, setPhoneTarget]   = useState(null)
  const [sendSms, setSendSms]           = useState(false)
  const [pairPartner, setPairPartner]   = useState(null)
  const [bookWithPair, setBookWithPair] = useState(false)
  const [sources, setSources]           = useState([])

  const longPressTimer       = useRef(null)
  const longPressFired       = useRef(false)
  const calcLoadFromDB       = useRef(true)
  const muddatLongPressTimer = useRef(null)
  const muddatLongPressFired = useRef(false)
  const prevPctBracket       = useRef(null)
  const keypadRef            = useRef(null)

  const triggerConfetti = useCallback(async () => {
    const { default: confettiLib } = await import('canvas-confetti')
    const W = window.innerWidth, H = window.innerHeight
    const colors = ['#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#ef4444','#facc15','#ffffff','#00d4ff','#ff6b35']
    function burst(ox, oy, delay = 0) {
      setTimeout(() => {
        const origin = { x: ox / W, y: oy / H }
        const base = { origin, ticks: 320, colors }
        confettiLib({ ...base, particleCount: 55, spread: 60,  startVelocity: 58, decay: 0.88, scalar: 1.0 })
        confettiLib({ ...base, particleCount: 35, spread: 110, startVelocity: 42, decay: 0.91, scalar: 0.8 })
        confettiLib({ ...base, particleCount: 20, spread: 160, startVelocity: 28, decay: 0.93, scalar: 1.2 })
      }, delay)
    }
    burst(W * 0.5, H * 0.50); burst(W * 0.25, H * 0.45, 220); burst(W * 0.75, H * 0.45, 380)
  }, [])

  function calcLongPressStart(e) {
    e.preventDefault()
    longPressFired.current = false
    if (showCalc) return
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      if (navigator.vibrate) navigator.vibrate(40)
      calcLoadFromDB.current = false
      setCalc({ narxM2: '', boshlangich: '', oylar: '12', muddatStep: 0, focus: 'boshlangich' })
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

  const effectiveAptSize = bookWithPair && pairPartner
    ? Number((apartment.size + pairPartner.size).toFixed(2))
    : apartment.size

  const calcDerived = useMemo(() => {
    const narxVal   = Number(String(calc.narxM2).replace(/\s/g, ''))
    const downVal   = Number(String(calc.boshlangich).replace(/\s/g, ''))
    const months    = parseInt(calc.oylar) || 12
    const baseTotal = Math.round(narxVal * effectiveAptSize)
    const pctOfBase = baseTotal > 0 && downVal > 0 ? Math.floor((downVal / baseTotal) * 100) : 0
    const pctBracket = apartment.is_wc ? null : (CHEGIRMA_BRACKETS.find(p => pctOfBase >= p) ?? null)
    const chegirma  = apartment.is_wc ? 0 : (pctBracket ? CHEGIRMA_TABLE[pctBracket] : 0)
    const yakuniy   = narxVal > 0 ? Math.max(0, narxVal - chegirma) : 0
    const total     = Math.round(yakuniy * effectiveAptSize)
    const percent   = Math.min(100, pctOfBase)
    const qolgan    = Math.max(0, total - downVal)
    const qolganDisplay = qolgan > 0 ? qolgan : (pctOfBase < 100 ? Math.max(0, baseTotal - downVal) : 0)
    const monthly   = qolganDisplay > 0 && months > 0 ? Math.round(qolganDisplay / months) : 0
    const bonusBracket = BONUS_BRACKETS.find(p => pctOfBase >= p) ?? null
    const bonus     = apartment.is_wc ? null : (bonusBracket ? BONUS_TABLE[bonusBracket] : null)
    return { narxVal, downVal, months, baseTotal, pctOfBase, pctBracket, chegirma, yakuniy, total, percent, qolgan, monthly, bonus }
  }, [calc.narxM2, calc.boshlangich, calc.oylar, effectiveAptSize, apartment.is_wc])

  const { pctBracket: currentBracket } = calcDerived
  useEffect(() => {
    if (!showCalc || !currentBracket) return
    if (currentBracket !== prevPctBracket.current) {
      playDiscountSound()
      triggerConfetti()
      if (navigator.vibrate) navigator.vibrate([80, 40, 120, 40, 200])
    }
    prevPctBracket.current = currentBracket
  }, [showCalc, currentBracket, triggerConfetti])

  useEffect(() => {
    if (!showCalc || !calcLoadFromDB.current) return
    let cancelled = false
    const [block, bolimStr] = apartment.address.split('-')
    const isWc = apartment.is_wc ? '&is_wc=1' : ''
    apiFetch(`/api/prices?block=${block}&bolim=${parseInt(bolimStr)}&floor=${floor}${isWc}`)
      .then(r => r.json())
      .then(({ price }) => {
        if (!cancelled && price) setCalc(f => ({ ...f, narxM2: f.narxM2 === '' ? String(price) : f.narxM2 }))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [showCalc]) // eslint-disable-line react-hooks/exhaustive-deps

  function fetchCalcPrice() {
    const [block, bolimStr] = apartment.address.split('-')
    const isWc = apartment.is_wc ? '&is_wc=1' : ''
    apiFetch(`/api/prices?block=${block}&bolim=${parseInt(bolimStr)}&floor=${floor}${isWc}`)
      .then(r => r.json())
      .then(({ price }) => { if (price) setCalc(f => ({ ...f, narxM2: String(price) })) })
      .catch(() => {})
  }

  useEffect(() => {
    apiFetch('/api/managers').then(r => r.json()).then(list => { if (Array.isArray(list)) setManagers(list) }).catch(() => {})
    apiFetch('/api/sources').then(r => r.json()).then(list => { if (Array.isArray(list)) setSources(list) }).catch(() => {})
  }, [])

  useEffect(() => {
    setPairPartner(null); setBookWithPair(false)
    if (apartment.is_wc) return
    apiFetch(`/api/apartments/${apartment.address}/pair`)
      .then(r => r.json())
      .then(partner => { if (partner && partner.status === 'EMPTY') setPairPartner(partner) })
      .catch(() => {})
  }, [apartment.address, apartment.is_wc])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!phoneTarget) return
    function onFocusIn(e) {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'tel') setPhoneTarget(null)
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [phoneTarget])

  useEffect(() => {
    if (!showCalc) return
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault(); flashKey(e.key)
        setCalc(f => {
          if (f.focus === 'oylar') return f
          const raw = String(f[f.focus]).replace(/\s/g, '')
          if (raw.length >= 12) return f
          const num = Number(raw + e.key)
          return { ...f, [f.focus]: num.toLocaleString('ru-RU').replace(/,/g, ' ') }
        })
      } else if (e.key === 'Backspace') {
        e.preventDefault(); flashKey('⌫')
        setCalc(f => {
          if (f.focus === 'oylar') return f
          const raw = String(f[f.focus]).replace(/\s/g, '').slice(0, -1)
          return { ...f, [f.focus]: raw ? Number(raw).toLocaleString('ru-RU').replace(/,/g, ' ') : '' }
        })
      } else if (e.key === 'Delete') {
        e.preventDefault(); flashKey('C')
        setCalc(f => f.focus === 'oylar' ? f : { ...f, [f.focus]: '', focus: 'boshlangich' })
      } else if (e.key === 'Escape') {
        e.preventDefault(); setShowCalc(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCalc])

  if (!apartment) return null

  function flashKey(key) {
    const el = keypadRef.current?.querySelector(`[data-key="${key}"]`)
    if (!el) return
    el.setAttribute('data-active', '1')
    setTimeout(() => el.removeAttribute('data-active'), 150)
  }

  function getErrors(form) {
    const e = {}
    if (!form.ism.trim()) e.ism = "To'ldirilishi shart"
    if (!form.familiya.trim()) e.familiya = "To'ldirilishi shart"
    const phoneDigits = getRawDigits(form.telefon)
    if (phoneDigits.length < 9) e.telefon = phoneDigits.length === 0 ? 'Telefon raqam kiritilishi shart' : "Telefon raqam to'liq emas"
    const boshlVal = Number(String(form.boshlangich || '').replace(/\s/g, ''))
    if (!boshlVal) e.boshlangich = boshlVal === 0 && form.boshlangich ? "Summa noldan katta bo'lishi shart" : "Boshlang'ich to'lov kiritilishi shart"
    if (sources.length > 0 && !form.source_id) e.source_id = "Manbaa tanlanishi shart"
    return e
  }

  const bronErrors   = showErrors ? getErrors(bronForm)   : {}
  const sotishErrors = showErrors ? getErrors(sotishForm) : {}
  const activeErrors = tab === 'bron' ? bronErrors : sotishErrors
  const hasErrors    = Object.keys(activeErrors).length > 0

  const cap = (s) => s ? s.toUpperCase() : s
  const setBronCap   = (key) => (e) => setBronForm(f => ({ ...f, [key]: cap(e.target.value) }))
  const setSotish    = (key) => (e) => setSotishForm(f => ({ ...f, [key]: e.target.value }))
  const setSotishCap = (key) => (e) => setSotishForm(f => ({ ...f, [key]: cap(e.target.value) }))

  const assignedManager    = assignedUserId ? managers.find(m => m.id === assignedUserId) : null
  const effectiveManagerName = assignedManager?.name ?? currentUser?.name ?? ''

  async function submitBooking(type) {
    if (submitting) return
    setConfirmPending(null); setSubmitting(true); setSubmitError(null)
    const form = type === 'bron' ? bronForm : sotishForm
    try {
      const res = await apiFetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartment_id: apartment.address, type,
          ism: form.ism, familiya: form.familiya,
          boshlangich: form.boshlangich, oylar: parseInt(form.oylar),
          umumiy: form.umumiy || null, narx_m2: form.narx_m2 || null,
          chegirma_m2: form.chegirma_m2 || null, asl_narx_m2: form.asl_narx_m2 || null,
          phone: form.telefon || null, passport: form.passport || null,
          passport_place: form.passport_place || null, manzil: form.manzil || null,
          assigned_user_id: assignedUserId ?? null,
          pair_with: bookWithPair && pairPartner ? pairPartner.address : undefined,
          source_id: form.source_id ?? null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSubmitError(data.error || "Xatolik yuz berdi. Qayta urinib ko'ring.")
        return
      }
      const booking = await res.json()
      onBooked?.()
      const sourceName = sources.find(s => s.id === form.source_id)?.name ?? ''
      setBooked({
        form, type, bookingId: booking.id, managerName: effectiveManagerName, sourceName,
        pairApartmentAddress: booking.pair_booking ? pairPartner?.address ?? null : null,
        pairApartmentSize:    booking.pair_booking ? pairPartner?.size ?? null : null,
        pairBookingId:        booking.pair_booking?.id ?? null,
      })

      if (type === 'bron' && form.telefon && sendSms) {
        fetch('https://backend.prohome.uz/api/v1/sms/send-congratulation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '998' + getRawDigits(form.telefon), firstName: form.ism, block: apartment.address, type: apartment.is_wc ? 'WS' : 'SHOP' }),
        }).catch(() => {})
      }

      if (type === 'bron' && booking.id) {
        const pairApt = booking.pair_booking && pairPartner
          ? { address: pairPartner.address, size: pairPartner.size } : null
        downloadContractPDF({ apartment, floor, blockId, bolimNum, form, type, managerName: effectiveManagerName, sourceName, pairApartment: pairApt })
          .then(blob => {
            const fd = new FormData()
            fd.append('pdf', blob, `shartnoma-${apartment.address}.pdf`)
            fd.append('booking_id', String(booking.id))
            if (booking.pair_booking?.id) fd.append('pair_booking_id', String(booking.pair_booking.id))
            return apiFetch('/api/bookings/send-pdf', { method: 'POST', body: fd })
          })
          .then(res => res?.ok && console.log('[PDF] Telegramga yuborildi'))
          .catch(e => console.error('[PDF] xato:', e?.message ?? e))
      }
    } catch {
      setSubmitError("Internet aloqasi uzildi. Qayta urinib ko'ring.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownloadPDF() {
    setPdfLoading(true)
    try {
      const pairApt = booked.pairApartmentAddress
        ? { address: booked.pairApartmentAddress, size: booked.pairApartmentSize } : null
      const blob = await downloadContractPDF({ apartment, floor, blockId, bolimNum, form: booked.form, type: booked.type, managerName: booked.managerName ?? getUser()?.name ?? '', sourceName: booked.sourceName ?? '', pairApartment: pairApt })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const aptNum = apartment.address.split('-').pop()
      a.download = pairApt ? `shartnoma-${aptNum}-${pairApt.address.split('-').pop()}.pdf` : `shartnoma-${apartment.address}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPdfLoading(false)
    }
  }

  // ── CALCULATOR KEYPAD ────────────────────────────────────────────────────────

  const calcKeypad = (() => {
    function pressKey(key) {
      flashKey(key)
      setCalc(f => {
        if (f.focus === 'oylar') return f
        const raw = String(f[f.focus]).replace(/\s/g, '')
        let next = raw
        if (key === '⌫') next = raw.slice(0, -1)
        else if (key === 'C') return { ...f, [f.focus]: '', focus: 'boshlangich' }
        else if (raw.length < 12) next = raw + key
        const formatted = next ? Number(next).toLocaleString('ru-RU').replace(/,/g, ' ') : ''
        return { ...f, [f.focus]: formatted }
      })
    }
    return (
      <div ref={keypadRef} className="flex flex-col gap-3 px-4 py-5 w-full h-full">
        <button type="button"
          onClick={() => setCalc(f => ({ ...f, focus: 'narxM2' }))}
          className={`w-full rounded-2xl border-2 text-left px-4 py-4 transition-colors shrink-0 ${calc.focus === 'narxM2' ? 'border-amber-400 bg-amber-50' : 'border-border bg-background hover:border-amber-200'}`}
        >
          <p className="text-xs text-muted-foreground mb-1">Narx/m²</p>
          <p className={`text-4xl font-bold ${calc.narxM2 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
            {calc.narxM2 ? Number(String(calc.narxM2).replace(/\s/g, '')).toLocaleString('ru-RU') : '0'}
            <span className="text-sm font-normal text-muted-foreground ml-1">USD</span>
          </p>
        </button>
        <div className="grid grid-cols-3 gap-2 w-full flex-1">
          {CALC_KEYS.map(k => (
            <button key={k} data-key={k} type="button" onPointerDown={e => { e.preventDefault(); pressKey(k) }}
              className={`rounded-xl text-3xl font-bold transition-all active:scale-95 select-none
                data-active:scale-95
                ${k === '⌫' ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 data-active:bg-red-400 data-active:text-white data-active:border-red-400'
                : k === 'C'  ? 'bg-muted text-muted-foreground border border-border hover:bg-muted/70 data-active:bg-muted-foreground/30 data-active:text-foreground'
                              : 'bg-background border border-border text-foreground hover:bg-amber-50 hover:border-amber-300 data-active:bg-amber-400 data-active:text-white data-active:border-amber-400'}
              `}
            >{k}</button>
          ))}
        </div>
      </div>
    )
  })

  // ── CALCULATOR LEFT PANEL ────────────────────────────────────────────────────

  const calcLeftPanel = (() => {
    const thirdVal = MUDDAT_STEPS[calc.muddatStep ?? 0]
    const MUDDAT_OPTIONS = [12, 24, thirdVal]

    function startMuddatLP() {
      muddatLongPressFired.current = false
      const step = calc.muddatStep ?? 0
      if (step >= 2) return
      muddatLongPressTimer.current = setTimeout(() => {
        muddatLongPressFired.current = true
        if (navigator.vibrate) navigator.vibrate(40)
        const nextStep = step + 1
        setCalc(f => ({ ...f, muddatStep: nextStep, oylar: String(MUDDAT_STEPS[nextStep]) }))
      }, 3000)
    }
    function cancelMuddatLP() {
      if (muddatLongPressTimer.current) { clearTimeout(muddatLongPressTimer.current); muddatLongPressTimer.current = null }
    }

    const { narxVal, downVal, baseTotal, pctOfBase, pctBracket, chegirma, yakuniy, total, percent, monthly, bonus } = calcDerived

    function transferToForm() {
      const setter = tab === 'sotish' ? setSotishForm : setBronForm
      setter(f => ({
        ...f,
        narx_m2:     yakuniy ? String(yakuniy) : f.narx_m2,
        boshlangich: total > 0 && downVal > total ? String(total) : (calc.boshlangich || f.boshlangich),
        oylar:       calc.oylar || f.oylar,
        umumiy:      total ? String(total) : f.umumiy,
        chegirma_m2: chegirma > 0 ? String(chegirma) : '',
        asl_narx_m2: chegirma > 0 ? String(narxVal) : '',
      }))
      setShowCalc(false)
    }

    return (
      <div className="flex flex-col border-r border-border" style={{ flex: '0 0 70%' }}>
        <div className="flex flex-col gap-4 px-5 py-5 flex-1 overflow-y-auto min-h-0">
          <div className="flex gap-3">
            <div className={`flex-1 rounded-2xl border-2 px-4 py-3 ${chegirma > 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-border bg-muted/40'}`}>
              <p className="text-xs text-muted-foreground mb-1">Umumiy narx <span className="text-muted-foreground/50">({effectiveAptSize} m²)</span></p>
              {chegirma > 0 && baseTotal > 0 ? (
                <>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm text-muted-foreground/50 line-through">{baseTotal.toLocaleString('ru-RU')}</span>
                    <span className="text-muted-foreground/40 text-xs">→</span>
                    <span className="text-xl font-bold text-foreground">{total.toLocaleString('ru-RU')} <span className="text-sm font-normal text-muted-foreground">USD</span></span>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    −{(baseTotal - total).toLocaleString('ru-RU')} $ tejaldi
                  </span>
                </>
              ) : (
                <p className={`text-xl font-bold ${total > 0 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                  {total > 0 ? total.toLocaleString('ru-RU') : '—'}
                  {total > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">USD</span>}
                </p>
              )}
            </div>
            <button type="button"
              onClick={() => setCalc(f => ({ ...f, focus: 'boshlangich' }))}
              className={`flex-1 rounded-2xl border-2 text-left px-4 py-3 transition-colors ${calc.focus === 'boshlangich' ? 'border-amber-400 bg-amber-50' : 'border-border bg-background hover:border-amber-200'}`}
            >
              <p className="text-xs text-muted-foreground mb-1">Boshlang'ich</p>
              <p className={`text-xl font-bold ${calc.boshlangich ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                {calc.boshlangich ? Number(String(calc.boshlangich).replace(/\s/g, '')).toLocaleString('ru-RU') : '0'}
                <span className="text-sm font-normal text-muted-foreground ml-1">USD</span>
              </p>
            </button>
          </div>

          {!apartment.is_wc && (
            <div className="rounded-2xl border border-border bg-background overflow-hidden shrink-0">
              <div className="px-3 py-1.5 border-b border-border bg-muted/40">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chegirma darajalari</p>
              </div>
              <div className="divide-y divide-border/60">
                {TIERS.map(({ pct, disc }) => {
                  const isActive  = pctBracket === pct
                  const isReached = pctOfBase >= pct
                  const threshold = baseTotal > 0 ? Math.round(baseTotal * pct / 100) : null
                  return (
                    <div key={pct} className={`flex items-center justify-between px-3 py-2 transition-all duration-300 ${isActive ? 'bg-amber-400/15' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${isActive ? 'bg-amber-500 shadow-[0_0_6px_2px_rgba(245,158,11,0.5)]' : isReached ? 'bg-emerald-400' : 'bg-border'}`} />
                        <span className={`text-sm font-bold shrink-0 transition-colors ${isActive ? 'text-amber-700' : isReached ? 'text-emerald-700' : 'text-muted-foreground'}`}>{pct}%</span>
                        {threshold && <span className="text-xs text-muted-foreground/70 shrink-0">≥ {threshold.toLocaleString('ru-RU')} $</span>}
                      </div>
                      <span className={`text-sm font-bold shrink-0 transition-colors ${isActive ? 'text-amber-600' : isReached ? 'text-emerald-600' : 'text-muted-foreground/50'}`}>−{disc} $/m²</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!apartment.is_wc && (() => {
            const MILESTONES = [
              { pct: 30,  items: [{ img: imgKonditsioner, name: 'Konditsioner' }] },
              { pct: 50,  items: [{ img: imgKonditsioner, name: 'Konditsioner' }, { img: imgTV, name: 'TV (43)' }] },
              { pct: 70,  items: [{ img: imgKonditsioner, name: 'Konditsioner' }, { img: imgMuzlatgich, name: 'Muzlatgich' }] },
              { pct: 100, items: [{ img: imgKonditsioner, name: 'Konditsioner' }, { img: imgTV, name: 'TV (43)' }, { img: imgMuzlatgich, name: 'Muzlatgich' }] },
            ]
            const reachedCount = MILESTONES.filter(m => pctOfBase >= m.pct).length
            const trackFill = reachedCount <= 1 ? 0 : ((reachedCount - 1) / (MILESTONES.length - 1)) * 100
            return (
              <div className="rounded-2xl border border-border bg-background overflow-hidden shrink-0 px-4 pt-4 pb-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Bonus texnikalar</p>
                <div className="relative flex justify-between items-start">
                  <div className="absolute top-5 left-5 right-5 h-0.5 bg-border rounded-full" />
                  <div className="absolute top-5 left-5 h-0.5 bg-linear-to-r from-emerald-400 to-amber-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `calc((100% - 40px) * ${trackFill} / 100)` }} />
                  {MILESTONES.map(({ pct, items }, idx) => {
                    const reached = pctOfBase >= pct
                    const active  = reachedCount - 1 === idx
                    return (
                      <div key={pct} className="relative flex flex-col items-center gap-2" style={{ width: '25%' }}>
                        <div className={`relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-400 ${active ? 'bg-amber-400 border-amber-500 text-white shadow-lg shadow-amber-200/60 scale-110' : reached ? 'bg-emerald-400 border-emerald-500 text-white' : 'bg-muted border-border text-muted-foreground/60'}`}>
                          {pct}%
                          {active && <span className="absolute inset-0 rounded-full animate-ping bg-amber-400 opacity-20" />}
                        </div>
                        <div className="flex flex-wrap justify-center gap-1">
                          {items.map(item => (
                            <div key={item.name} className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all duration-400 ${active ? 'border-amber-300 shadow-md shadow-amber-100' : reached ? 'border-emerald-300 shadow-sm' : 'border-border opacity-55'}`}>
                              <img src={item.img} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          {items.map(item => (
                            <span key={item.name} className={`text-[10px] font-semibold leading-tight text-center transition-colors ${active ? 'text-amber-600' : reached ? 'text-emerald-600' : 'text-muted-foreground/60'}`}>{item.name}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {!apartment.is_wc && narxVal > 0 && chegirma > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-3">Chegirma faollashdi</p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Narx/m²</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-zinc-400 line-through">{narxVal.toLocaleString('ru-RU')} $</span>
                    <span className="text-xs text-emerald-600 font-semibold">−{chegirma} $</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-800 leading-tight mt-0.5">{yakuniy.toLocaleString('ru-RU')} <span className="text-sm font-normal text-zinc-500">$/m²</span></p>
                </div>
                <div className="w-px bg-amber-200 self-stretch" />
                <div className="text-right">
                  <p className="text-xs text-zinc-400 mb-1">Siz tejaysiz</p>
                  <p className="text-xs text-zinc-500 mb-0.5">{chegirma} $ × {effectiveAptSize} m² =</p>
                  <p className="text-2xl font-bold text-emerald-600 leading-tight">{(chegirma * effectiveAptSize).toLocaleString('ru-RU')} <span className="text-sm font-normal">$</span></p>
                </div>
              </div>
            </div>
          )}

          {pctOfBase < 100 && (
            <div>
              <p className={LABEL}>Muddat</p>
              <div className="flex gap-2">
                {MUDDAT_OPTIONS.map((m, i) => {
                  const isThird = i === 2
                  const canAdvance = isThird && (calc.muddatStep ?? 0) < 2
                  return (
                    <button key={m} type="button"
                      onPointerDown={isThird ? e => { e.preventDefault(); startMuddatLP() } : undefined}
                      onPointerUp={isThird ? e => { e.preventDefault(); cancelMuddatLP(); if (!muddatLongPressFired.current) setCalc(f => ({ ...f, oylar: String(m) })) } : undefined}
                      onPointerLeave={isThird ? cancelMuddatLP : undefined}
                      onClick={!isThird ? () => setCalc(f => ({ ...f, oylar: String(m) })) : undefined}
                      className={`relative flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors select-none touch-manipulation ${parseInt(calc.oylar) === m ? 'bg-amber-500 text-white border-amber-500' : 'bg-background text-muted-foreground border-border hover:bg-amber-50'}`}
                    >
                      {m}
                      {canAdvance && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400 opacity-60" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
            {bonus && (
              <div className="mt-2 pt-2 border-t border-amber-300">
                <p className="text-xs text-amber-700 mb-1.5">Bonus texnika</p>
                <div className="flex gap-3">
                  {bonus.map(item => (
                    <button key={item.name} type="button" onClick={() => setBonusPreview(item)} className="flex flex-col items-center gap-1 group">
                      <div className="w-12 h-12 rounded-xl bg-white shadow-sm overflow-hidden border border-amber-200 group-active:scale-95 transition-transform">
                        <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] font-medium text-amber-800 text-center leading-tight">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border shrink-0">
          <button type="button" onClick={transferToForm} disabled={!calc.boshlangich}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-600 disabled:hover:bg-amber-500 text-white">
            Formaga o'tkazish →
          </button>
        </div>
      </div>
    )
  })

  // ── FORM SUMMARY CARD ─────────────────────────────────────────────────────────
  function FormSummaryCard({ form, errors }) {
    if (!form.boshlangich && !form.narx_m2) {
      if (!errors.boshlangich) return null
      return (
        <button type="button" onClick={() => setShowCalc(true)}
          className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-left w-full hover:bg-red-100 transition-colors">
          <p className="text-sm font-semibold text-red-700">Boshlang'ich to'lov kiritilishi shart</p>
          <p className="text-xs text-red-500 mt-1">Kalkulyatorni ochish →</p>
        </button>
      )
    }
    const down    = Number(String(form.boshlangich || '').replace(/\s/g, ''))
    const aslNarx = Number(String(form.asl_narx_m2 || '').replace(/\s/g, ''))
    const narx    = Number(String(form.narx_m2 || '').replace(/\s/g, ''))
    const baseT   = aslNarx > 0 ? Math.round(aslNarx * effectiveAptSize) : (narx > 0 ? Math.round(narx * effectiveAptSize) : 0)
    const pct     = baseT > 0 && down > 0 ? Math.min(100, Math.floor((down / baseT) * 100)) : 0
    return (
      <div className="flex-1 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 flex flex-col justify-between">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-amber-700 mb-1">Kafolat summasi</p>
            <p className="text-xl font-bold text-foreground">{form.boshlangich || '—'} <span className="text-sm font-normal text-muted-foreground">USD</span></p>
            {pct > 0 && <p className="text-lg font-bold text-amber-600 mt-1">{pct}% <span className="text-xs font-normal">umumiy to'lovdan</span></p>}
          </div>
          <div>
            <p className="text-xs text-amber-700 mb-1">Muddat</p>
            <p className="text-xl font-bold text-foreground">{form.oylar || '—'} <span className="text-sm font-normal text-muted-foreground">oy</span></p>
          </div>
          <div>
            <p className="text-xs text-amber-700 mb-1">Narx/m²</p>
            <p className="text-xl font-bold text-foreground">{form.narx_m2 || '—'} <span className="text-sm font-normal text-muted-foreground">USD</span></p>
          </div>
        </div>
        <button type="button" onClick={() => setShowCalc(true)}
          className="mt-4 self-start text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900">
          Qayta hisoblash →
        </button>
      </div>
    )
  }

  // ── SOURCE SELECTOR ───────────────────────────────────────────────────────────
  function SourceSelector({ value, onChange, errors }) {
    if (sources.length === 0) return null
    return (
      <div className="flex flex-col gap-2">
        <span className={`block text-sm font-medium ${errors.source_id ? 'text-red-600' : 'text-foreground'}`}>
          Manbaa
          {errors.source_id && <span className="ml-1.5 font-semibold text-red-500 text-xs">— tanlanishi shart</span>}
        </span>
        <div className={`flex flex-wrap gap-1.5 transition-colors ${errors.source_id ? 'rounded-xl px-3 py-2 border border-red-300 bg-red-50/60' : ''}`}>
          {sources.map(s => (
            <button key={s.id} type="button" onClick={() => onChange(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                value === s.id ? 'bg-slate-100 border-slate-400 text-slate-800'
                : errors.source_id ? 'bg-white border-red-200 text-muted-foreground hover:border-slate-300 hover:text-foreground'
                : 'bg-background border-border text-muted-foreground hover:border-slate-300 hover:text-foreground'
              }`}>
              {value === s.id && (
                <svg viewBox="0 0 12 10" className="w-2.5 h-2" fill="none" aria-hidden="true">
                  <path d="M1 5l3.5 3.5L11 1" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {s.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── FORM FIELDS ───────────────────────────────────────────────────────────────
  const bronFields = (
    <div className="flex flex-1 min-h-0">
      {showCalc ? calcLeftPanel() : (
        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto border-r border-border" style={{ flex: '0 0 70%' }}>
          <Field label="Ism" placeholder="Abdulloh" value={bronForm.ism} onChange={setBronCap('ism')} autoComplete="given-name" error={bronErrors.ism} />
          <Field label="Familiya" placeholder="Karimov" value={bronForm.familiya} onChange={setBronCap('familiya')} autoComplete="family-name" error={bronErrors.familiya} />
          <PhoneField label="Telefon raqam" value={bronForm.telefon} isOpen={phoneTarget === 'bron'} onOpenNumpad={() => setPhoneTarget('bron')} error={bronErrors.telefon} />
          <button type="button" onClick={() => setSendSms(v => !v)} className="flex items-center gap-3 w-full text-left group">
            <span className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${sendSms ? 'bg-amber-500 border-amber-500' : 'border-border bg-background'}`}>
              {sendSms && <svg viewBox="0 0 12 10" className="w-3 h-3" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">SMS xabar yuborish (tabriklash)</span>
          </button>
          <SourceSelector value={bronForm.source_id} onChange={id => setBronForm(f => ({ ...f, source_id: id }))} errors={bronErrors} />
          <FormSummaryCard form={bronForm} errors={bronErrors} />
        </div>
      )}
      <div className="flex items-stretch" style={{ flex: '0 0 30%' }}>
        {showCalc ? calcKeypad()
          : phoneTarget === 'bron'
          ? <FullPhoneNumpad value={bronForm.telefon} onChange={v => setBronForm(f => ({ ...f, telefon: v }))} onClose={() => setPhoneTarget(null)} />
          : null}
      </div>
    </div>
  )

  const sotishFields = (
    <div className="flex flex-1 min-h-0">
      {showCalc ? calcLeftPanel() : (
        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto border-r border-border" style={{ flex: '0 0 70%' }}>
          <Field label="Ism" placeholder="Abdulloh" value={sotishForm.ism} onChange={setSotishCap('ism')} autoComplete="given-name" error={sotishErrors.ism} />
          <Field label="Familiya" placeholder="Karimov" value={sotishForm.familiya} onChange={setSotishCap('familiya')} autoComplete="family-name" error={sotishErrors.familiya} />
          <PhoneField label="Telefon raqam" value={sotishForm.telefon} isOpen={phoneTarget === 'sotish'} onOpenNumpad={() => setPhoneTarget('sotish')} error={sotishErrors.telefon} />
          <SourceSelector value={sotishForm.source_id} onChange={id => setSotishForm(f => ({ ...f, source_id: id }))} errors={sotishErrors} />
          <FormSummaryCard form={sotishForm} errors={sotishErrors} />
          <div className="grid grid-cols-2 gap-4">
            <PassportField label="Passport seriya/raqam" value={sotishForm.passport} onChange={v => setSotishForm(f => ({ ...f, passport: v }))} />
            <Field label="Passport berilgan joy" placeholder="Toshkent sh. IIB" value={sotishForm.passport_place} onChange={setSotish('passport_place')} />
          </div>
          <Field label="Manzil" placeholder="Toshkent, Chilonzor" value={sotishForm.manzil} onChange={setSotish('manzil')} />
        </div>
      )}
      <div className="flex items-stretch" style={{ flex: '0 0 30%' }}>
        {showCalc ? calcKeypad()
          : phoneTarget === 'sotish'
          ? <FullPhoneNumpad value={sotishForm.telefon} onChange={v => setSotishForm(f => ({ ...f, telefon: v }))} onClose={() => setPhoneTarget(null)} />
          : null}
      </div>
    </div>
  )

  // ── STATUS VIEWS ─────────────────────────────────────────────────────────────
  if (apartment.status === 'RESERVED' || apartment.status === 'SOLD') {
    return <StatusCard apartment={apartment} isReserved={apartment.status === 'RESERVED'} onClose={onClose} onBooked={onBooked} />
  }

  if (booked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" style={{ backdropFilter: 'blur(4px)' }}>
        <div className="bg-background rounded-2xl shadow-2xl border border-border flex flex-col items-center gap-6 px-10 py-12 w-full max-w-sm text-center">
          <CheckCircle size={56} className="text-green-500" />
          <div>
            <p className="text-xl font-bold text-foreground">{booked.type === 'bron' ? 'Bron muvaffaqiyatli!' : 'Sotish rasmiylashtirildi!'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {booked.pairApartmentAddress
                ? `${apartment.address.split('-').pop()}/${booked.pairApartmentAddress.split('-').pop()}-DO'KON`
                : apartment.address} · {booked.form.ism} {booked.form.familiya}
            </p>
          </div>
          {booked.type === 'bron' && (
            <button onClick={handleDownloadPDF} disabled={pdfLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors active:scale-[0.98] disabled:opacity-60">
              {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {pdfLoading ? 'Tayyorlanmoqda...' : 'Shartnoma PDF'}
            </button>
          )}
          <button onClick={onClose} className="w-full py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Yopish</button>
        </div>
      </div>
    )
  }

  // ── MAIN MODAL ───────────────────────────────────────────────────────────────
  const innerContent = (
    <div className={`${embedded ? 'apt-modal-enter' : 'apt-modal-enter'} relative w-full h-full bg-background ${embedded ? '' : 'rounded-2xl shadow-2xl border border-border'} flex flex-col overflow-hidden`}>
      <div className={`flex items-center px-5 border-b shrink-0 h-24 transition-colors ${bookWithPair && pairPartner ? 'border-violet-100 bg-violet-50/50' : 'border-border'}`}>
        <div className="flex items-center gap-3 min-w-0 overflow-hidden mr-4">
          {bookWithPair && pairPartner ? (() => {
            const parts = apartment.address.split('-')
            const prefix = parts.slice(0, -1).join('-')
            const [n1, n2] = [Number(parts[parts.length - 1]), Number(pairPartner.address.split('-').pop())].sort((a, b) => a - b)
            return <span className="text-3xl font-bold text-violet-700 shrink-0">{prefix}-{n1}/{n2}</span>
          })() : <span className="text-3xl font-bold text-foreground shrink-0">{apartment.address}</span>}
          {apartment.size > 0 && (
            <span className={`text-xl font-medium shrink-0 ${bookWithPair && pairPartner ? 'text-violet-400' : 'text-muted-foreground'}`}>
              {bookWithPair && pairPartner ? `${Number((apartment.size + pairPartner.size).toFixed(2))} m²` : `${apartment.size} m²`}
            </span>
          )}
          {apartment.notes && (
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold border border-amber-200 shrink-0">{apartment.notes}</span>
          )}
        </div>
        <div className="flex-1" />
        {pairPartner && (
          <>
            <button type="button" onDoubleClick={() => setBookWithPair(v => !v)}
              className={`flex items-center gap-2.5 shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all select-none ${bookWithPair ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' : 'bg-background border-border text-foreground hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700'}`}>
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${bookWithPair ? 'bg-white/25 border-white/50' : 'border-muted-foreground'}`}>
                {bookWithPair && <svg viewBox="0 0 12 10" className="w-3.5 h-3.5" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              {pairPartner.address.split('-').pop()}-DO'KON bilan juft
            </button>
            <div className="w-px h-10 bg-border mx-4 shrink-0" />
          </>
        )}
        <button type="button" onPointerDown={calcLongPressStart} onPointerUp={calcLongPressEnd}
          onPointerCancel={() => { clearTimeout(longPressTimer.current); longPressTimer.current = null }}
          onContextMenu={e => e.preventDefault()}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shrink-0 select-none touch-manipulation ${showCalc ? 'bg-amber-100 text-amber-600' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          title="Kalkulator (bosib turing: 0 dan boshlash)">
          <Calculator size={22} />
        </button>
        <div className="w-px h-10 bg-border mx-1 shrink-0" />
        <button onClick={() => {
          if (showCalc) { setCalc({ narxM2: '', boshlangich: '', oylar: '12', muddatStep: 0, focus: 'boshlangich' }); fetchCalcPrice() }
          else { setBronForm(BRON_EMPTY); setSotishForm(SOTISH_EMPTY) }
        }} className="w-14 h-14 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0" title="Formani tozalash">
          <RotateCcw size={22} />
        </button>
        <div className="w-px h-10 bg-border mx-2 shrink-0" />
        <button onClick={onClose} className="w-14 h-14 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0" style={{ fontSize: 42 }}>×</button>
      </div>

      {confirmPending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-2xl" style={{ backdropFilter: 'blur(2px)' }}>
          <div className="bg-background rounded-2xl shadow-2xl border border-border flex flex-col gap-5 px-7 py-7 w-full max-w-sm mx-4">
            <div>
              <p className="text-lg font-bold text-foreground">{confirmPending === 'bron' ? 'Bron qilishni tasdiqlang' : 'Sotishni tasdiqlang'}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{apartment.address}</p>
            </div>
            <div>
              <label className={LABEL}>Kim nomiga?</label>
              <div className="relative">
                <select value={assignedUserId ?? ''} onChange={e => setAssignedUserId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none pr-10">
                  <option value="">{currentUser?.name ?? 'Men'} (o'zim)</option>
                  {managers.filter(m => m.id !== currentUser?.sub).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setConfirmPending(null); setAssignedUserId(null) }}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">Bekor qilish</button>
              <button type="button" onClick={() => submitBooking(confirmPending)} disabled={submitting}
                className={`flex-1 py-3 rounded-xl text-white font-semibold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 ${confirmPending === 'bron' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}>
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? 'Saqlanmoqda...' : 'Tasdiqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0">
        {tab === 'bron' ? (
          <form id="bron-form" onSubmit={e => { e.preventDefault(); const errs = getErrors(bronForm); if (Object.keys(errs).length > 0) { setShowErrors(true); return }; setConfirmPending('bron') }} className="flex flex-col flex-1 min-h-0">
            {bronFields}
          </form>
        ) : (
          <form id="sotish-form" onSubmit={e => { e.preventDefault(); const errs = getErrors(sotishForm); if (Object.keys(errs).length > 0) { setShowErrors(true); return }; setConfirmPending('sotish') }} className="flex flex-col flex-1 min-h-0">
            {sotishFields}
          </form>
        )}

        {!showCalc && (
          <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex flex-col gap-2">
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
                  <button key={key} type="button" onClick={() => { setTab(key); setSubmitError(null); setShowErrors(false) }}
                    className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'bron' ? (
                <button type="submit" form="bron-form" disabled={submitting || (showErrors && hasErrors)}
                  className="flex-1 py-4 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-600">
                  {submitting && <Loader2 size={18} className="animate-spin" />}
                  {submitting ? 'Saqlanmoqda...' : 'Bron qilish'}
                </button>
              ) : (
                <button type="submit" form="sotish-form" disabled={submitting || (showErrors && hasErrors)}
                  className="flex-1 py-4 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700">
                  {submitting && <Loader2 size={18} className="animate-spin" />}
                  {submitting ? 'Saqlanmoqda...' : 'Sotish'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (embedded) return innerContent

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      {bonusPreview && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-6 bg-black/75" onClick={() => setBonusPreview(null)}>
          <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img src={bonusPreview.img} alt={bonusPreview.name} className="w-full aspect-square object-cover" />
            <div className="px-5 py-4 flex items-center justify-between">
              <p className="text-lg font-bold text-foreground">{bonusPreview.name}</p>
              <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-3 py-1 rounded-full">Bonus</span>
            </div>
            <button type="button" onClick={() => setBonusPreview(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      {innerContent}
    </div>
  )
}
