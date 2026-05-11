import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/shared/lib/auth'

export function StatusCard({ apartment, isReserved, onClose }) {
  const [booking, setBooking] = useState(null)

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

  const accent = isReserved
    ? { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Bron', header: 'bg-amber-50 border-b border-amber-100' }
    : { badge: 'bg-red-100 text-red-700 border-red-200',       label: 'Sotilgan', header: 'bg-red-50 border-b border-red-100' }

  function fmtDate(str) {
    if (!str) return null
    const d = new Date(str)
    const months = ['yan','fev','mar','apr','may','iyn','iyl','avg','sen','okt','noy','dek']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="apt-modal-enter relative w-full h-full bg-background rounded-2xl overflow-hidden flex flex-col">

        <div className={`shrink-0 px-6 flex items-center gap-4 h-24 ${accent.header}`}>
          <div className="flex-1 min-w-0">
            <p className="text-3xl font-black tracking-tight text-foreground leading-none">{apartment.address}</p>
            {apartment.size > 0 && (
              <p className="text-base text-muted-foreground font-medium mt-1">{apartment.size} m²</p>
            )}
          </div>
          <span className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-full border ${accent.badge}`}>
            {accent.label}
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

          {booking && (
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
        </div>
      </div>
    </div>
  )
}
