import { useState } from 'react'
import { Download, FileText, Eye, X } from 'lucide-react'
import { apiFetch } from '@/shared/lib/auth'
import { downloadBookingPDF } from '../lib/bookingPdf.jsx'

const TYPE_BADGE = {
  bron:   'bg-amber-100 text-amber-700 border border-amber-200',
  sotish: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
}
const TYPE_LABEL = { bron: 'Bron', sotish: 'Sotish' }

function fmtMoney(val) {
  if (!val) return null
  const num = Number(String(val).replace(/\s/g, ''))
  if (!num) return null
  return num.toLocaleString('ru-RU').replace(/,/g, ' ') + ' USD'
}

function SotishDetailModal({ booking, onClose }) {
  const rows = [
    ['Xaridor', `${booking.ism || ''} ${booking.familiya || ''}`.trim() || '—'],
    ['Telefon', booking.phone || '—'],
    booking.source_name && ['Manbaa', booking.source_name],
    ['Menejer', booking.manager_name || '—'],
    ['Sana', new Date(booking.created_at).toLocaleString('uz-UZ')],
    fmtMoney(booking.boshlangich) && ["Boshlang'ich to'lov", fmtMoney(booking.boshlangich)],
    booking.oylar && ['Muddat', `${booking.oylar} oy`],
    fmtMoney(booking.narx_m2) && ['Narx/m²', fmtMoney(booking.narx_m2)],
    fmtMoney(booking.umumiy) && ['Umumiy narx', fmtMoney(booking.umumiy)],
    booking.passport && ['Passport', booking.passport],
    booking.passport_place && ['Passport berilgan joy', booking.passport_place],
    booking.manzil && ['Manzil', booking.manzil],
  ].filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 flex items-center gap-3 bg-emerald-50 border-b border-emerald-100">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-black text-xl text-foreground tracking-tight flex-1">{booking.apartment_id}</span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">Sotilgan</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-black/8 text-foreground hover:bg-black/15 transition-colors ml-1">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3.5 max-h-[70vh] overflow-y-auto">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-6">
              <span className="text-sm text-muted-foreground shrink-0">{label}</span>
              <span className="text-sm font-bold text-foreground text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BookingRow({ b, isAdmin, cancelled, onReset, scrolled, scrolledRight, pairPosition, bulkMode, selected, onSelect }) {
  const [loading, setLoading]         = useState(false)
  const [pdfLoading, setPdfLoading]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDetail, setShowDetail]   = useState(false)

  const [block, bolim, aptStr] = b.apartment_id.split('-')
  const floor  = aptStr ? aptStr[0] : '?'
  const isPair = !!pairPosition

  async function handleDownloadPDF() {
    setPdfLoading(true)
    try { await downloadBookingPDF(b) } finally { setPdfLoading(false) }
  }

  async function handleReset() {
    setShowConfirm(false); setLoading(true)
    await apiFetch(`/api/apartments/${b.apartment_id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'EMPTY' }),
    })
    setLoading(false)
    onReset?.()
  }

  return (
    <>
      <tr
        className={`transition-colors duration-300
          ${pairPosition === 'last' ? 'border-t border-violet-100' : 'border-t border-border'}
          ${isPair && !cancelled ? 'bg-violet-50/40 hover:bg-violet-50/70' : cancelled ? 'opacity-55' : 'hover:bg-muted/40'}
          ${b.type === 'sotish' && !cancelled ? 'cursor-pointer' : ''}`}
        onDoubleClick={() => b.type === 'sotish' && !cancelled && setShowDetail(true)}
      >
        <td className={`px-4 py-3 whitespace-nowrap sticky left-0 transition-shadow
          ${isPair && !cancelled ? 'bg-violet-50' : 'bg-card'}
          ${scrolled ? 'shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]' : ''}
          ${isPair ? 'border-l-[3px] border-l-violet-400' : ''}`}>
          <div className="flex items-center gap-2">
            {bulkMode && pairPosition !== 'last' && (
              <button type="button" onClick={() => onSelect?.(b.id)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-foreground border-foreground' : 'border-border bg-background'}`}>
                {selected && <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            )}
            <p className="font-mono font-bold text-sm">{b.apartment_id}</p>
            {pairPosition === 'first' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200 leading-none">JUFT</span>
            )}
            {pairPosition === 'last' && (
              <span className="text-[10px] text-violet-400 leading-none">↑ juft</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{block}-blok · {bolim}-bo'lim · {floor}-qavat</p>
        </td>

        {pairPosition !== 'last' && (
          <td className={`px-4 py-3 align-middle whitespace-nowrap ${isPair && !cancelled ? 'bg-violet-50' : 'bg-card'}`} rowSpan={isPair ? 2 : 1}>
            <p className="text-sm font-medium">{b.ism} {b.familiya}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {b.phone && <p className="text-xs text-muted-foreground">{b.phone}</p>}
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[b.type] ?? ''}`}>{TYPE_LABEL[b.type] ?? b.type}</span>
            </div>
          </td>
        )}

        {isAdmin && pairPosition !== 'last' && (
          <td className={`px-4 py-3 text-sm text-muted-foreground whitespace-nowrap align-middle ${isPair && !cancelled ? 'bg-violet-50' : 'bg-card'}`} rowSpan={isPair ? 2 : 1}>
            {b.manager_name || '—'}
          </td>
        )}

        {pairPosition !== 'last' && (
          <td className={`px-4 py-3 align-middle ${isPair && !cancelled ? 'bg-violet-50' : 'bg-card'}`} rowSpan={isPair ? 2 : 1}>
            {b.source_name
              ? <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200 whitespace-nowrap">{b.source_name}</span>
              : <span className="text-xs text-muted-foreground">—</span>
            }
          </td>
        )}

        {pairPosition !== 'last' && (
          <td className={`px-4 py-3 whitespace-nowrap align-middle ${isPair && !cancelled ? 'bg-violet-50' : 'bg-card'}`} rowSpan={isPair ? 2 : 1}>
            {cancelled ? (
              <p className="text-xs text-red-500 font-medium">{new Date(b.cancelled_at).toLocaleString('uz-UZ')}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString('uz-UZ')}</p>
            )}
          </td>
        )}

        {pairPosition !== 'last' && (
          <td className={`px-4 py-3 align-middle sticky right-0 transition-shadow ${isPair && !cancelled ? 'bg-violet-50' : 'bg-card'} ${scrolledRight ? 'shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.08)]' : ''}`} rowSpan={isPair ? 2 : 1}>
            <div className="flex items-center gap-2">
              {b.type === 'bron' ? (
                <button onClick={handleDownloadPDF} disabled={pdfLoading}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors disabled:opacity-40">
                  {pdfLoading ? <FileText size={13} className="animate-pulse" /> : <Download size={13} />}
                  Shartnoma
                </button>
              ) : (
                <button onClick={() => setShowDetail(true)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors">
                  <Eye size={13} />
                  Ko'rish
                </button>
              )}
              {!cancelled && (
                <button onClick={() => setShowConfirm(true)} disabled={loading}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-40">
                  <X size={13} />
                  Bekor
                </button>
              )}
            </div>
          </td>
        )}
      </tr>

      {showConfirm && (
        <tr><td className="p-0 border-0">
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={e => e.target === e.currentTarget && setShowConfirm(false)}>
            <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold mb-2">Bitimni bekor qilish</h3>
              <p className="text-sm text-muted-foreground mb-3">
                <span className="font-semibold text-foreground">{b.apartment_id}</span> xonadonining bitimi bekor qilinadi.
              </p>
              {isPair && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-violet-50 border border-violet-200 mb-4">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-xs text-violet-700 font-medium leading-relaxed">Bu <b>juft bron</b> — ikkinchi do'kon ham avtomatik bekor qilinadi.</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Bekor</button>
                <button onClick={handleReset} disabled={loading} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                  {loading ? 'Bekor qilinmoqda...' : 'Ha, bekor qilish'}
                </button>
              </div>
            </div>
          </div>
        </td></tr>
      )}

      {showDetail && (
        <tr><td className="p-0 border-0">
          <SotishDetailModal booking={b} onClose={() => setShowDetail(false)} />
        </td></tr>
      )}
    </>
  )
}
