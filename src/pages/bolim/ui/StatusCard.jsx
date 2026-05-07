import { useState, useEffect } from 'react'
import { Loader2, X } from 'lucide-react'
import { apiFetch, getUser } from '@/shared/lib/auth'
import { LABEL, Field, PassportField } from './FormFields'

export function StatusCard({ apartment, isReserved, onClose, onBooked }) {
  const currentUser = getUser()
  const isAdmin = currentUser?.role === 'admin'
  const [booking, setBooking] = useState(null)
  const [form, setForm] = useState({ passport: '', passport_place: '', manzil: '' })
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState(null)

  useEffect(() => {
    apiFetch(`/api/apartments/booking?id=${apartment.address}`)
      .then(r => r.json())
      .then(d => setBooking(d))
      .catch(() => {})
  }, [apartment.address])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const canConvert = isReserved && booking && currentUser &&
    (booking.user_id === currentUser.sub || isAdmin)

  const accent = isReserved
    ? { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Bron' }
    : { dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700 border-red-200',       label: 'Sotilgan' }

  function fmtDate(str) {
    if (!str) return null
    const d = new Date(str)
    const months = ['yan','fev','mar','apr','may','iyn','iyl','avg','sen','okt','noy','dek']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  async function handleConvert(e) {
    e.preventDefault()
    setConverting(true)
    setConvertError(null)
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
        setConvertError(data.error || 'Xatolik yuz berdi')
        return
      }
      onBooked?.()
      onClose()
    } catch {
      setConvertError('Internet aloqasi uzildi')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="apt-modal-enter relative w-full h-full bg-background rounded-2xl overflow-hidden flex flex-col">

        <div className={`shrink-0 px-6 flex items-center gap-4 h-24 ${isReserved ? 'bg-amber-50 border-b border-amber-100' : 'bg-red-50 border-b border-red-100'}`}>
          <div className="flex-1 min-w-0">
            <p className="text-3xl font-black tracking-tight text-foreground leading-none">{apartment.address}</p>
            {apartment.size > 0 && (
              <p className="text-base text-muted-foreground font-medium mt-1">{apartment.size} m²</p>
            )}
          </div>
          <span className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-full border ${accent.badge}`}>
            {isReserved && canConvert ? "Sotishga o'tkazish" : accent.label}
          </span>
          <button onClick={onClose} className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-black/8 hover:bg-black/15 transition-colors">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!booking && (
            <div className="flex items-center justify-center py-14">
              <svg className="w-6 h-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {booking && !canConvert && (
            <div className="px-6 py-6 flex flex-col gap-1">
              {booking.ism && (
                <div className="flex items-center justify-between py-3.5 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">{isReserved ? 'Kim uchun bron' : 'Xaridor'}</span>
                  <span className="text-base font-bold text-foreground">{booking.ism}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-3.5 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Menejer</span>
                <span className="text-base font-semibold text-foreground">{booking.manager_name ?? '—'}</span>
              </div>
              {booking.created_at && (
                <div className="flex items-center justify-between py-3.5 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">{isReserved ? 'Bron sanasi' : 'Sotilgan sana'}</span>
                  <span className="text-base font-semibold text-foreground">{fmtDate(booking.created_at)}</span>
                </div>
              )}
              {apartment.size > 0 && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-sm text-muted-foreground">Maydon</span>
                  <span className="text-base font-semibold text-foreground">{apartment.size} m²</span>
                </div>
              )}
            </div>
          )}

          {canConvert && (
            <form id="convert-form" onSubmit={handleConvert} className="px-6 py-6 flex flex-col gap-6">
              <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 overflow-hidden">
                {booking.ism && (
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-200/60">
                    <span className="text-sm text-amber-700/80">Xaridor</span>
                    <span className="text-sm font-bold text-amber-900">{booking.ism}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-200/60">
                  <span className="text-sm text-amber-700/80">Menejer</span>
                  <span className="text-sm font-semibold text-amber-900">{booking.manager_name ?? '—'}</span>
                </div>
                {booking.created_at && (
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-sm text-amber-700/80">Bron sanasi</span>
                    <span className="text-sm font-semibold text-amber-900">{fmtDate(booking.created_at)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-5">
                <p className="text-sm font-semibold text-muted-foreground">
                  Qo'shimcha ma'lumotlar <span className="font-normal opacity-70">(ixtiyoriy)</span>
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

              {convertError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {convertError}
                </div>
              )}
            </form>
          )}
        </div>

        {canConvert && (
          <div className="shrink-0 px-6 pb-6 pt-4 border-t border-border">
            <button
              type="submit"
              form="convert-form"
              disabled={converting}
              className="w-full py-5 rounded-2xl bg-green-600 text-white font-bold text-lg active:scale-[0.99] transition-all hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
            >
              {converting && <Loader2 size={20} className="animate-spin" />}
              {converting ? 'Saqlanmoqda...' : "Sotishga o'tkazish"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
