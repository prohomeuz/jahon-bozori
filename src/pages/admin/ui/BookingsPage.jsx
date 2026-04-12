import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getUser, apiFetch } from '@/shared/lib/auth'
import { useRealtimeApts } from '@/shared/hooks/useRealtimeApts'
import { Search, Download, X, FileText } from 'lucide-react'
import { ContractPDF } from '@/pages/bolim/ui/ContractPDF'

const allBlockImgs = import.meta.glob('@/assets/blocks/**/*.{png,jpg}', { eager: true })

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
  const padY = bboxVb.height * sy * 1.2
  const cy = Math.max(0, bboxVb.y * sy - padY)
  const ch = Math.min(img.naturalHeight - cy, bboxVb.height * sy + padY * 2)
  const cropped = document.createElement('canvas')
  cropped.width = img.naturalWidth; cropped.height = ch
  cropped.getContext('2d').drawImage(canvas, 0, cy, img.naturalWidth, ch, 0, 0, img.naturalWidth, ch)
  return cropped.toDataURL('image/png')
}

async function downloadBookingPDF(b) {
  const [blockId, bolimStr, aptStr] = b.apartment_id.split('-')
  const bolimNum = parseInt(bolimStr)
  const floor = aptStr ? parseInt(aptStr[0]) : 1

  const [{ pdf }, aptRes] = await Promise.all([
    import('@react-pdf/renderer'),
    apiFetch(`/api/apartments?block=${blockId}&bolim=${bolimNum}&floor=${floor}`).then(r => r.json()),
  ])

  const aptData = Array.isArray(aptRes) ? aptRes.find(a => a.address === b.apartment_id) : null
  const apartment = aptData ?? { address: b.apartment_id, size: 0, status: b.type === 'sotish' ? 'SOLD' : 'RESERVED' }

  const rawFloorImg = loadImg(blockId, floor, bolimNum)
  let floorImgSrc = null
  if (rawFloorImg) {
    try {
      const overlay = await getAptRect(blockId, floor, bolimNum, b.apartment_id)
      floorImgSrc = await drawHighlight(rawFloorImg, overlay?.rect ?? null, overlay?.viewBox ?? null)
    } catch { floorImgSrc = null }
  }

  const form = {
    ism: b.ism,
    familiya: b.familiya,
    telefon: b.phone || '',
    boshlangich: b.boshlangich,
    oylar: String(b.oylar),
    umumiy: b.umumiy || '',
    passport: b.passport || '',
    passport_place: b.passport_place || '',
    manzil: b.manzil || '',
  }

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

function BookingRow({ b, isAdmin, cancelled, onReset, flashId, scrolled }) {
  const [loading, setLoading]       = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [flashing, setFlashing]     = useState(false)
  const rowRef = useRef(null)

  const [block, bolim, aptStr] = b.apartment_id.split('-')
  const floor = aptStr ? aptStr[0] : '?'

  useEffect(() => {
    if (flashId !== b.id) return
    setFlashing(true)
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setFlashing(false), 2000)
    return () => clearTimeout(t)
  }, [flashId, b.id])

  async function handleDownloadPDF() {
    setPdfLoading(true)
    try { await downloadBookingPDF(b) } finally { setPdfLoading(false) }
  }

  async function handleReset() {
    if (!confirm(`${b.apartment_id} ni bekor qilasizmi?`)) return
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
    <tr
      ref={rowRef}
      className={`border-t border-border transition-colors duration-300 ${
        flashing    ? 'bg-amber-50 dark:bg-amber-950/40' :
        cancelled   ? 'opacity-55' :
        'hover:bg-muted/40'
      }`}
    >
      {/* Xonadon — sticky left */}
      <td className={`px-4 py-3 whitespace-nowrap sticky left-0 transition-shadow ${
        flashing ? 'bg-amber-50 dark:bg-amber-950/40' : cancelled ? 'bg-card opacity-100' : 'bg-card'
      } ${scrolled ? 'shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]' : ''}`}>
        <p className="font-mono font-bold text-sm">{b.apartment_id}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {block}-blok · {bolim}-bo'lim · {floor}-qavat
        </p>
      </td>

      {/* Mijoz */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{b.ism} {b.familiya}</p>
        {b.phone && <p className="text-xs text-muted-foreground mt-0.5">{b.phone}</p>}
      </td>

      {/* Manager — faqat admin */}
      {isAdmin && (
        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
          {b.manager_name || b.username || '—'}
        </td>
      )}

      {/* Sana */}
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

      {/* Amallar */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            title="Shartnoma yuklab olish"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors disabled:opacity-40"
          >
            {pdfLoading
              ? <FileText size={13} className="animate-pulse" />
              : <Download size={13} />
            }
            Bron
          </button>
          {isAdmin && !cancelled && (
            <button
              onClick={handleReset}
              disabled={loading}
              title="Bitimni bekor qilish"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-40"
            >
              <X size={13} />
              Bekor
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function BookingsTable({ cancelled, isAdmin, onReset, flashId, search, typeFilter }) {
  const [page, setPage]       = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef(null)
  const LIMIT = 30

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() { setScrolled(el.scrollLeft > 4) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', cancelled ? 'cancelled' : 'active', page],
    queryFn: () =>
      apiFetch(`/api/bookings?limit=${LIMIT}&offset=${page * LIMIT}${cancelled ? '&cancelled=1' : ''}`).then(r => r.json()),
    placeholderData: prev => prev,
  })

  const allBookings = Array.isArray(data) ? data : []

  const bookings = allBookings.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      b.apartment_id.toLowerCase().includes(q) ||
      b.ism.toLowerCase().includes(q) ||
      b.familiya.toLowerCase().includes(q) ||
      (b.phone || '').includes(q)
    const matchType = typeFilter === 'all' || b.type === typeFilter
    return matchSearch && matchType
  })

  useEffect(() => { setPage(0) }, [search, typeFilter])

  const colSpan = isAdmin ? 5 : 4

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* Table wrapper — scrollable vertically, sticky header inside */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)] no-scrollbar"
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
              {isLoading && allBookings.length === 0
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      {Array.from({ length: colSpan }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted/60 rounded animate-pulse" style={{ width: `${60 + (i * j * 7) % 30}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : bookings.length === 0
                ? (
                    <tr>
                      <td colSpan={colSpan} className="px-4 py-16 text-center text-muted-foreground text-sm">
                        {search ? 'Qidiruv bo\'yicha natija topilmadi' : cancelled ? 'Bekor qilingan bitimlar yo\'q' : 'Bitimlar yo\'q'}
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
                      flashId={flashId}
                      scrolled={scrolled}
                    />
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {(allBookings.length >= LIMIT || page > 0) && (
        <div className="flex items-center gap-3 self-end">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium disabled:opacity-30 hover:bg-muted transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-muted-foreground">{page + 1}-sahifa</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={allBookings.length < LIMIT}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium disabled:opacity-30 hover:bg-muted transition-colors"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}

export default function BookingsPage() {
  useRealtimeApts()
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [tab, setTab]               = useState('active')
  const [flashId, setFlashId]       = useState(null)
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    function handler(e) {
      setTab('active')
      setFlashId(e.detail.id)
      setTimeout(() => setFlashId(null), 2500)
    }
    window.addEventListener('flash-booking', handler)
    return () => window.removeEventListener('flash-booking', handler)
  }, [])

  function onReset() {
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['apartments'] })
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 h-full min-h-0">

      {/* ── Sticky toolbar ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 -mx-4 px-4 md:-mx-6 md:px-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
          <h1 className="text-2xl font-bold">Bitimlar</h1>
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {[
              { key: 'active',    label: 'Faol bitimlar' },
              { key: 'cancelled', label: 'Bekor qilingan' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSearch(''); setTypeFilter('all') }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  tab === t.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Ism, xonadon yoki telefon..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {[
              { key: 'all',    label: 'Hammasi' },
              { key: 'bron',   label: 'Bron' },
              { key: 'sotish', label: 'Sotish' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  typeFilter === f.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BookingsTable
        key={tab}
        cancelled={tab === 'cancelled'}
        isAdmin={isAdmin}
        onReset={onReset}
        flashId={flashId}
        search={search}
        typeFilter={typeFilter}
      />
    </div>
  )
}
