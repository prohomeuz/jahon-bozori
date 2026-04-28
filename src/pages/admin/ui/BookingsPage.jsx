import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getUser, apiFetch } from '@/shared/lib/auth'
import { useRealtimeApts } from '@/shared/hooks/useRealtimeApts'
import { Search, Download, X, FileText, Eye, SlidersHorizontal } from 'lucide-react'
import { ContractPDF } from '@/pages/bolim/ui/ContractPDF'
const allBlockImgs = import.meta.glob('@/assets/blocks/**/*.{png,jpg,webp}', { eager: true })

const PDF_BONUS_MAP = {
  30:  ['Konditsioner'],
  40:  ['Konditsioner'],
  50:  ['Konditsioner', 'TV (43)'],
  60:  ['Konditsioner', 'TV (43)'],
  70:  ['Konditsioner', 'Muzlatgich'],
  100: ['Konditsioner', 'TV (43)', 'Muzlatgich'],
}

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

async function getBolimViewBox(blockId, floor, bolimNum) {
  try {
    const LOADERS = {
      A: [
        () => import('../../../pages/bolim/config/aRectOverlays').then(m => m.A_RECT_OVERLAYS),
        () => import('../../../pages/bolim/config/aFloor2RectOverlays').then(m => m.A_FLOOR2_RECT_OVERLAYS),
      ],
      B: [
        () => import('../../../pages/bolim/config/bRectOverlays').then(m => m.B_RECT_OVERLAYS),
        () => import('../../../pages/bolim/config/bFloor2RectOverlays').then(m => m.B_FLOOR2_RECT_OVERLAYS),
      ],
      C: [
        () => import('../../../pages/bolim/config/cRectOverlays').then(m => m.C_RECT_OVERLAYS),
        () => import('../../../pages/bolim/config/cFloor2RectOverlays').then(m => m.C_FLOOR2_RECT_OVERLAYS),
      ],
    }
    const overlays = await LOADERS[blockId]?.[floor === 2 ? 1 : 0]?.()
    return overlays?.[bolimNum]?.viewBox ?? null
  } catch { return null }
}

async function drawWcHighlight(imgSrc, points, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (!points || !viewBox) return canvas.toDataURL('image/png')
  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth / vw, sy = img.naturalHeight / vh
  const coords = points.trim().split(/[\s,]+/).map(Number)
  const path = new Path2D()
  for (let i = 0; i + 1 < coords.length; i += 2) {
    if (i === 0) path.moveTo(coords[i] * sx, coords[i + 1] * sy)
    else path.lineTo(coords[i] * sx, coords[i + 1] * sy)
  }
  path.closePath()
  ctx.fillStyle = 'rgba(56,189,248,0.35)'; ctx.fill(path)
  ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = Math.max(4, vw / 130); ctx.stroke(path)
  const xs = [], ys = []
  for (let i = 0; i + 1 < coords.length; i += 2) { xs.push(coords[i] * sx); ys.push(coords[i + 1] * sy) }
  const bboxPx = Math.min(...xs), bboxPy = Math.min(...ys)
  const bboxPw = Math.max(...xs) - bboxPx, bboxPh = Math.max(...ys) - bboxPy
  const padX = bboxPw * 2.5, padY = bboxPh * 1.5
  const cx = Math.max(0, bboxPx - padX), cy = Math.max(0, bboxPy - padY)
  const cw = Math.min(img.naturalWidth - cx, bboxPw + padX * 2)
  const ch = Math.min(img.naturalHeight - cy, bboxPh + padY * 2)
  const cropped = document.createElement('canvas')
  cropped.width = cw; cropped.height = ch
  cropped.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)
  return cropped.toDataURL('image/png')
}

async function getAptRect(blockId, floor, bolimNum, address) {
  try {
    const LOADERS = {
      A: [
        () => import('../../../pages/bolim/config/aRectOverlays').then(m => m.A_RECT_OVERLAYS),
        () => import('../../../pages/bolim/config/aFloor2RectOverlays').then(m => m.A_FLOOR2_RECT_OVERLAYS),
      ],
      B: [
        () => import('../../../pages/bolim/config/bRectOverlays').then(m => m.B_RECT_OVERLAYS),
        () => import('../../../pages/bolim/config/bFloor2RectOverlays').then(m => m.B_FLOOR2_RECT_OVERLAYS),
      ],
      C: [
        () => import('../../../pages/bolim/config/cRectOverlays').then(m => m.C_RECT_OVERLAYS),
        () => import('../../../pages/bolim/config/cFloor2RectOverlays').then(m => m.C_FLOOR2_RECT_OVERLAYS),
      ],
    }
    const overlays = await LOADERS[blockId]?.[floor === 2 ? 1 : 0]?.()
    const bolimData = overlays?.[bolimNum]
    if (!bolimData) return null
    const rect = bolimData.rects?.find(r => r.id === address)
    return rect ? { rect, viewBox: bolimData.viewBox } : null
  } catch { return null }
}

function pathBBox(d) {
  const nums = d.match(/[-\d.]+/g)?.map(Number) ?? []
  const xs = [], ys = []
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]) }
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

async function drawHighlight(imgSrc, rect, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (!rect || !viewBox) return canvas.toDataURL('image/png')
  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth / vw
  const sy = img.naturalHeight / vh
  let bboxVb
  if (rect.d) {
    ctx.save(); ctx.scale(sx, sy)
    ctx.fillStyle = 'rgba(239,68,68,0.22)'; ctx.fill(new Path2D(rect.d))
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = vw / 90; ctx.stroke(new Path2D(rect.d))
    ctx.restore(); bboxVb = pathBBox(rect.d)
  } else {
    const lw = Math.max(4, img.naturalWidth / 250)
    ctx.fillStyle = 'rgba(239,68,68,0.22)'; ctx.fillRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = lw; ctx.strokeRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
    bboxVb = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }
  const bboxPx = bboxVb.x * sx
  const bboxPy = bboxVb.y * sy
  const bboxPw = bboxVb.width  * sx
  const bboxPh = bboxVb.height * sy
  const padX = bboxPw * 5
  const padY = bboxPh * 1.5
  const cx = Math.max(0, bboxPx - padX)
  const cy = Math.max(0, bboxPy - padY)
  const cw = Math.min(img.naturalWidth  - cx, bboxPw + padX * 2)
  const ch = Math.min(img.naturalHeight - cy, bboxPh + padY * 2)
  const cropped = document.createElement('canvas')
  cropped.width = cw; cropped.height = ch
  cropped.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)
  return cropped.toDataURL('image/png')
}

async function downloadBookingPDF(b) {
  const [blockId, bolimStr, aptStr] = b.apartment_id.split('-')
  const bolimNum = parseInt(bolimStr)
  const floor = aptStr ? parseInt(aptStr[0]) : 1

  const [{ pdf }, aptRes, qrImg] = await Promise.all([
    import('@react-pdf/renderer'),
    apiFetch(`/api/apartments?block=${blockId}&bolim=${bolimNum}&floor=${floor}`).then(r => r.json()),
    import('@/assets/qrcode.png'),
  ])
  const qrDataUrl = qrImg.default

  const aptData = Array.isArray(aptRes) ? aptRes.find(a => a.address === b.apartment_id) : null
  const apartment = aptData ?? { address: b.apartment_id, size: 0, status: b.type === 'sotish' ? 'SOLD' : 'RESERVED' }

  const rawFloorImg = loadImg(blockId, floor, bolimNum)
  let floorImgSrc = null
  if (rawFloorImg) {
    try {
      if (apartment.is_wc) {
        const { WC_OVERLAYS } = await import('@/pages/bolim/config/hojatxonaOverlays')
        const wcPoints = WC_OVERLAYS[blockId]?.[floor]?.[bolimNum] ?? null
        const viewBox  = await getBolimViewBox(blockId, floor, bolimNum)
        floorImgSrc = await drawWcHighlight(rawFloorImg, wcPoints, viewBox)
      } else {
        const overlay = await getAptRect(blockId, floor, bolimNum, b.apartment_id)
        floorImgSrc = await drawHighlight(rawFloorImg, overlay?.rect ?? null, overlay?.viewBox ?? null)
      }
    } catch { floorImgSrc = null }
  }

  async function toDataUrl(url) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
      const c = document.createElement('canvas')
      c.width = img.naturalWidth || img.width
      c.height = img.naturalHeight || img.height
      c.getContext('2d').drawImage(img, 0, 0)
      return c.toDataURL('image/png')
    } catch { return null }
  }

  const form = {
    ism: b.ism,
    familiya: b.familiya,
    telefon: b.phone || '',
    boshlangich: b.boshlangich,
    oylar: String(b.oylar),
    umumiy: b.umumiy || '',
    narx_m2: b.narx_m2 || '',
    chegirma_m2: b.chegirma_m2 || '',
    asl_narx_m2: b.asl_narx_m2 || '',
    passport: b.passport || '',
    passport_place: b.passport_place || '',
    manzil: b.manzil || '',
  }

  // Bonus items — faqat nom kerak (rasm yo'q)
  let bonusItems = []
  const chegirmaM2 = Number(String(b.chegirma_m2 || '').replace(/\s/g, '')) || 0
  const aslNarxM2  = Number(String(b.asl_narx_m2 || '').replace(/\s/g, '')) || 0
  if (chegirmaM2 > 0 && aslNarxM2 > 0 && apartment.size > 0) {
    const baseTotal  = Math.round(aslNarxM2 * apartment.size)
    const downVal    = Number(String(b.boshlangich || '').replace(/\s/g, '')) || 0
    const umumiyNum  = Number(String(b.umumiy || '').replace(/\s/g, '')) || 0
    const pctOfBase  = baseTotal > 0 && downVal > 0
      ? (umumiyNum > 0 && downVal >= umumiyNum ? 100 : Math.floor((downVal / baseTotal) * 100))
      : 0
    const bracket    = [100, 70, 60, 50, 40, 30].find(p => pctOfBase >= p) ?? null
    bonusItems       = bracket ? (PDF_BONUS_MAP[bracket] ?? []).map(name => ({ name })) : []
  }

  const logoSrc = await toDataUrl('/logo.png')

  const date = new Date(b.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
  const blob = await pdf(
    <ContractPDF
      apartment={apartment}
      floor={floor}
      blockId={blockId}
      bolimNum={bolimNum}
      form={form}
      type={b.type}
      date={date}
      floorImgSrc={floorImgSrc}
      qrDataUrl={qrDataUrl}
      managerName={b.manager_name || ''}
      logoSrc={logoSrc}
      bonusItems={bonusItems}
    />
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `shartnoma-${b.apartment_id}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

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
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/8 text-foreground hover:bg-black/15 transition-colors ml-1">
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

function BookingRow({ b, isAdmin, cancelled, onReset, scrolled }) {
  const [loading, setLoading]         = useState(false)
  const [pdfLoading, setPdfLoading]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDetail, setShowDetail]   = useState(false)

  const [block, bolim, aptStr] = b.apartment_id.split('-')
  const floor = aptStr ? aptStr[0] : '?'

  async function handleDownloadPDF() {
    setPdfLoading(true)
    try { await downloadBookingPDF(b) } finally { setPdfLoading(false) }
  }

  async function handleReset() {
    setShowConfirm(false)
    setLoading(true)
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
        className={`border-t border-border transition-colors duration-300 ${
          cancelled ? 'opacity-55' : 'hover:bg-muted/40'
        } ${b.type === 'sotish' && !cancelled ? 'cursor-pointer' : ''}`}
        onDoubleClick={() => b.type === 'sotish' && !cancelled && setShowDetail(true)}
      >
        <td className={`px-4 py-3 whitespace-nowrap sticky left-0 transition-shadow ${
          cancelled ? 'bg-card opacity-100' : 'bg-card'
        } ${scrolled ? 'shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]' : ''}`}>
          <p className="font-mono font-bold text-sm">{b.apartment_id}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {block}-blok · {bolim}-bo'lim · {floor}-qavat
          </p>
        </td>

        <td className="px-4 py-3">
          <p className="text-sm font-medium">{b.ism} {b.familiya}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {b.phone && <p className="text-xs text-muted-foreground">{b.phone}</p>}
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[b.type] ?? ''}`}>
              {TYPE_LABEL[b.type] ?? b.type}
            </span>
          </div>
        </td>

        {isAdmin && (
          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
            {b.manager_name || '—'}
          </td>
        )}

        <td className="px-4 py-3 whitespace-nowrap">
          {cancelled ? (
            <p className="text-xs text-red-500 font-medium">
              {new Date(b.cancelled_at).toLocaleString('uz-UZ')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {new Date(b.created_at).toLocaleString('uz-UZ')}
            </p>
          )}
        </td>

        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {b.type === 'bron' ? (
              <button
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors disabled:opacity-40"
              >
                {pdfLoading ? <FileText size={13} className="animate-pulse" /> : <Download size={13} />}
                Shartnoma
              </button>
            ) : (
              <button
                onClick={() => setShowDetail(true)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
              >
                <Eye size={13} />
                Ko'rish
              </button>
            )}
            {isAdmin && !cancelled && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-40"
              >
                <X size={13} />
                Bekor
              </button>
            )}
          </div>
        </td>
      </tr>

      {showConfirm && (
        <tr><td className="p-0 border-0">
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={e => e.target === e.currentTarget && setShowConfirm(false)}>
            <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold mb-2">Bitimni bekor qilish</h3>
              <p className="text-sm text-muted-foreground mb-6">
                <span className="font-semibold text-foreground">{b.apartment_id}</span> xonadonining bitimi bekor qilinadi.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                  Bekor
                </button>
                <button onClick={handleReset} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
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

const LIMIT = 50
const BLOCKS      = ['A', 'B', 'C']
const ALL_BOLIMS = [1,2,3,4,5,6,7,8,9,10,11,12,13]
const BOLIMS_BY_BLOCK = {
  A: [1,2,3,4,5,6,7,8,9,10,11],
  B: ALL_BOLIMS,
  C: ALL_BOLIMS,
}
const ALL_FLOORS  = [1, 2]

function BookingsTable({ cancelled, isAdmin, onReset, search, typeFilter, dateFrom, dateTo, blockFilter, bolimFilter, floorFilter }) {
  const [scrolled, setScrolled] = useState(false)
  const scrollRef        = useRef(null)
  const hasNextPageRef   = useRef(false)
  const fetchingRef      = useRef(false)
  const fetchNextPageRef = useRef(() => {})

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() { setScrolled(el.scrollLeft > 4) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['bookings', cancelled ? 'cancelled' : 'active', search, typeFilter, dateFrom, dateTo, blockFilter, bolimFilter, floorFilter],
    queryFn: ({ pageParam = 0 }) => {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(pageParam) })
      if (cancelled)              params.set('cancelled', '1')
      if (search)                 params.set('search',    search)
      if (typeFilter !== 'all')   params.set('type',      typeFilter)
      if (blockFilter)            params.set('block',     blockFilter)
      if (bolimFilter)            params.set('bolim',     bolimFilter)
      if (floorFilter)            params.set('floor',     floorFilter)
      if (dateFrom)               params.set('from',      dateFrom)
      if (dateTo)                 params.set('to',        dateTo)
      return apiFetch(`/api/bookings?${params}`).then(r => r.json())
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length < LIMIT ? undefined : allPages.flatMap(p => p.rows).length,
    placeholderData: keepPreviousData,
  })

  const total      = data?.pages[0]?.total ?? null
  const bookingsRaw = useMemo(() => data?.pages.flatMap(p => p.rows) ?? [], [data])
  // Filter o'zgarganda eski ma'lumotlar ko'rsatilib turadi — flicker yo'q
  const bookingsRef = useRef([])
  if (bookingsRaw.length > 0) bookingsRef.current = bookingsRaw
  const bookings = bookingsRaw.length > 0 ? bookingsRaw : bookingsRef.current

  hasNextPageRef.current   = hasNextPage
  fetchingRef.current      = isFetchingNextPage
  fetchNextPageRef.current = fetchNextPage

  const sentinelRef = useCallback(node => {
    if (!node || !scrollRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPageRef.current && !fetchingRef.current) {
          fetchNextPageRef.current()
        }
      },
      { root: scrollRef.current, rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const colSpan = isAdmin ? 5 : 4

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0">
      {total !== null && (
        <div className="px-4 py-2 border-b border-border flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">Jami:</span>
          <span className="text-xs font-semibold tabular-nums">{total} ta</span>
        </div>
      )}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-auto flex-1 min-h-0 no-scrollbar"
      >
        <table className="w-full text-sm min-w-[640px]">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-border bg-muted/80 backdrop-blur-sm">
              <th className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 bg-muted/80 backdrop-blur-sm transition-shadow ${scrolled ? 'shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]' : ''}`}>Xonadon</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mijoz</th>
              {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manager</th>}
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cancelled ? 'Bekor sanasi' : 'Sana'}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && bookingsRaw.length === 0 && bookingsRef.current.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    {Array.from({ length: colSpan }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted/60 rounded animate-pulse" style={{ width: `${60 + (i * j * 7) % 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : bookingsRaw.length === 0 && !isFetchingNextPage && !isLoading
              ? (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-16 text-center text-muted-foreground text-sm">
                      {search ? "Qidiruv bo'yicha natija topilmadi" : cancelled ? "Bekor qilingan bitimlar yo'q" : "Bitimlar yo'q"}
                    </td>
                  </tr>
                )
              : bookings.map(b => (
                  <BookingRow
                    key={b.id}
                    b={b}
                    isAdmin={isAdmin}
                    cancelled={cancelled}
                    onReset={onReset}
                    scrolled={scrolled}
                  />
                ))
            }

            {bookings.length > 0 && (
              <tr ref={sentinelRef}>
                <td colSpan={colSpan} className="py-3 text-center">
                  {isFetchingNextPage && (
                    <div className="flex items-center justify-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                          style={{ animation: 'loader-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
                        />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function BookingsPage() {
  useRealtimeApts()
  const user    = getUser()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  const [tab,          setTab]          = useState('active')
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [blockFilter,  setBlockFilter]  = useState('')
  const [bolimFilter,  setBolimFilter]  = useState('')
  const [floorFilter,  setFloorFilter]  = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [filterOpen,   setFilterOpen]   = useState(false)

  const [pendingType,  setPendingType]  = useState('all')
  const [pendingBlock, setPendingBlock] = useState('')
  const [pendingBolim, setPendingBolim] = useState('')
  const [pendingFloor, setPendingFloor] = useState('')
  const [pendingFrom,  setPendingFrom]  = useState('')
  const [pendingTo,    setPendingTo]    = useState('')

  function openSheet() {
    setPendingType(typeFilter); setPendingBlock(blockFilter)
    setPendingBolim(bolimFilter); setPendingFloor(floorFilter)
    setPendingFrom(dateFrom); setPendingTo(dateTo)
    setFilterOpen(true)
  }

  function applyFilters() {
    setTypeFilter(pendingType); setBlockFilter(pendingBlock)
    setBolimFilter(pendingBolim); setFloorFilter(pendingFloor)
    setDateFrom(pendingFrom); setDateTo(pendingTo)
    setFilterOpen(false)
  }

  function clearPending() {
    setPendingType('all'); setPendingBlock(''); setPendingBolim(''); setPendingFloor(''); setPendingFrom(''); setPendingTo('')
  }

  const activeFilterCount = [typeFilter !== 'all' ? typeFilter : '', blockFilter, bolimFilter, floorFilter, dateFrom, dateTo].filter(Boolean).length

  function resetFilters() {
    setSearch(''); setTypeFilter('all')
    setBlockFilter(''); setBolimFilter(''); setFloorFilter('')
    setDateFrom(''); setDateTo('')
  }

  function onReset() {
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['apartments'] })
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-3 h-full min-h-0 overflow-hidden relative">

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 -mx-4 px-4 md:-mx-6 md:px-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
          <h1 className="text-2xl font-bold">Bitimlar</h1>
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {[
              { key: 'active',    label: 'Faol bitimlar' },
              { key: 'cancelled', label: 'Bekor qilingan' },
            ].map(t => (
              <button key={t.key}
                onClick={() => { setTab(t.key); resetFilters() }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-50 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Ism, xonadon yoki telefon..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Clear filters button */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setTypeFilter('all'); setBlockFilter(''); setBolimFilter(''); setFloorFilter(''); setDateFrom(''); setDateTo('') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X size={13} strokeWidth={2.5} />
              Tozalash
            </button>
          )}

          {/* Filter button */}
          <button
            onClick={openSheet}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors shrink-0 ${
              activeFilterCount > 0
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filter
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-background text-foreground text-xs font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

        </div>
      </div>

      <BookingsTable
        key={tab}
        cancelled={tab === 'cancelled'}
        isAdmin={isAdmin}
        onReset={onReset}
        search={search}
        typeFilter={typeFilter}
        blockFilter={blockFilter}
        bolimFilter={bolimFilter}
        floorFilter={floorFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      {/* Filter bottom sheet */}
      {filterOpen && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={() => setFilterOpen(false)}>
          <div className="absolute inset-0 bg-black/40 sheet-backdrop" />
          <div className="relative bg-background rounded-t-2xl shadow-2xl max-h-[72vh] flex flex-col sheet-panel" onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-8 h-1 rounded-full bg-border" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
              <span className="text-sm font-bold">Filter</span>
              <button onClick={() => setFilterOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-4">

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tur</p>
                <div className="flex gap-1.5">
                  {[{ key: 'all', label: 'Hammasi' }, { key: 'bron', label: 'Bron' }, { key: 'sotish', label: 'Sotilgan' }].map(f => (
                    <button key={f.key} onClick={() => setPendingType(f.key)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        pendingType === f.key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                      }`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Blok</p>
                <div className="flex gap-1.5">
                  {['', ...BLOCKS].map(b => (
                    <button key={b || 'all'} onClick={() => {
                      const newBolims = b ? BOLIMS_BY_BLOCK[b] : Object.values(BOLIMS_BY_BLOCK).flat()
                      const bolimStillValid = pendingBolim && newBolims.includes(Number(pendingBolim))
                      setPendingBlock(b)
                      if (!bolimStillValid) setPendingBolim('')
                      setPendingFloor('')
                    }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        pendingBlock === b ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                      }`}>
                      {b || 'Barcha'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bo'lim</p>
                <div className="flex flex-wrap gap-1.5 items-start content-start">
                  <button onClick={() => { setPendingBolim(''); setPendingFloor('') }}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${!pendingBolim ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    Barcha
                  </button>
                  {(pendingBlock ? BOLIMS_BY_BLOCK[pendingBlock] : ALL_BOLIMS).map(n => (
                    <button key={n} onClick={() => { setPendingBolim(String(n)); setPendingFloor('') }}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingBolim === String(n) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Qavat</p>
                <div className="flex flex-wrap gap-1.5 items-start content-start">
                  <button onClick={() => setPendingFloor('')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${!pendingFloor ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    Barcha
                  </button>
                  {ALL_FLOORS.map(f => (
                    <button key={f} onClick={() => setPendingFloor(String(f))}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingFloor === String(f) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {f}-qavat
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sana</p>
                <div className="flex items-center gap-2">
                  <input type="date" value={pendingFrom} onChange={e => setPendingFrom(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  <span className="text-muted-foreground text-xs">—</span>
                  <input type="date" value={pendingTo} onChange={e => setPendingTo(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex gap-2 shrink-0">
              <button
                onClick={clearPending}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Tozalash
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Qo'llash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
