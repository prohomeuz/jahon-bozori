import { useState, useRef, useCallback, useEffect } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { getUser, apiFetch } from '@/shared/lib/auth'
import { Search, X, MapPin, Maximize2, DollarSign, Tag, EyeOff, Eye, SlidersHorizontal } from 'lucide-react'

const allBlockImgs = import.meta.glob('@/assets/blocks/**/*.{png,jpg,webp}', { eager: true })

function loadImg(blockId, floor, bolimNum) {
  const filename = String(bolimNum)
  const entry = Object.entries(allBlockImgs).find(([k]) => {
    const parts = k.replace(/\\/g, '/').split('/')
    const name     = parts.pop()?.split('.')[0]
    const floorDir = parts.pop()
    const blockDir = parts.pop()
    return name === filename && floorDir === String(floor) && blockDir === blockId
  })
  return entry?.[1]?.default ?? null
}

function pathBBox(d) {
  const nums = d.match(/[-\d.]+/g)?.map(Number) ?? []
  const xs = [], ys = []
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]) }
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

async function getAptRect(blockId, floor, bolimNum, address) {
  try {
    const LOADERS = {
      A: [
        () => import('../../bolim/config/aRectOverlays').then(m => m.A_RECT_OVERLAYS),
        () => import('../../bolim/config/aFloor2RectOverlays').then(m => m.A_FLOOR2_RECT_OVERLAYS),
      ],
      B: [
        () => import('../../bolim/config/bRectOverlays').then(m => m.B_RECT_OVERLAYS),
        () => import('../../bolim/config/bFloor2RectOverlays').then(m => m.B_FLOOR2_RECT_OVERLAYS),
      ],
      C: [
        () => import('../../bolim/config/cRectOverlays').then(m => m.C_RECT_OVERLAYS),
        () => import('../../bolim/config/cFloor2RectOverlays').then(m => m.C_FLOOR2_RECT_OVERLAYS),
      ],
    }
    const overlays = await LOADERS[blockId]?.[floor === 2 ? 1 : 0]?.()
    const bolimData = overlays?.[bolimNum]
    if (!bolimData) return null
    const rect = bolimData.rects?.find(r => r.id === address)
    return rect ? { rect, viewBox: bolimData.viewBox } : null
  } catch { return null }
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

const LIMIT = 50

const STATUS_BADGE = {
  EMPTY:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  RESERVED: 'bg-amber-100 text-amber-700 border border-amber-200',
  SOLD:     'bg-blue-100 text-blue-700 border border-blue-200',
  NOT_SALE: 'bg-muted text-muted-foreground border border-border',
}
const STATUS_LABEL = {
  EMPTY:    'Sotuvda',
  RESERVED: 'Bron',
  SOLD:     'Sotilgan',
  NOT_SALE: 'Sotilmaydi',
}

const STATUS_BG = {
  EMPTY:    'bg-emerald-50 border-emerald-100',
  RESERVED: 'bg-amber-50 border-amber-100',
  SOLD:     'bg-blue-50 border-blue-100',
  NOT_SALE: 'bg-muted border-border',
}

function ShopDetailModal({ shop, onClose }) {
  const [block, bolimStr, aptStr] = shop.address.split('-')
  const bolim = parseInt(bolimStr)
  const floor = aptStr ? parseInt(aptStr[0]) : 1

  const [highlightedImg, setHighlightedImg] = useState(null)
  const [imgLoading, setImgLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setImgLoading(true)
      const rawSrc = loadImg(block, floor, bolim)
      if (!rawSrc) { setImgLoading(false); return }
      try {
        const overlay = await getAptRect(block, floor, bolim, shop.address)
        const dataUrl = await drawHighlight(rawSrc, overlay?.rect ?? null, overlay?.viewBox ?? null)
        if (!cancelled) setHighlightedImg(dataUrl)
      } catch {
        if (!cancelled) setHighlightedImg(rawSrc)
      } finally {
        if (!cancelled) setImgLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [shop.address])

  const rows = [
    { label: "Do'kon ID", value: shop.address },
    { label: 'Blok',      value: `${shop.block}-blok` },
    { label: "Bo'lim",    value: `${shop.bolim}-bo'lim` },
    { label: 'Qavat',     value: `${shop.floor}-qavat` },
    { label: 'Maydon',    value: `${shop.size} m²` },
    { label: 'Narx (m²)', value: shop.price ? `${shop.price.toLocaleString('ru-RU')} $` : '—' },
  ].filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 flex items-center gap-3 border-b ${STATUS_BG[shop.status] ?? 'bg-muted border-border'}`}>
          <div className="flex-1 min-w-0">
            <p className="font-black text-xl tracking-tight text-foreground">{shop.address}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {shop.block}-blok · {shop.bolim}-bo'lim · {shop.floor}-qavat
            </p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE[shop.status] ?? ''}`}>
            {STATUS_LABEL[shop.status] ?? shop.status}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/8 hover:bg-black/15 transition-colors shrink-0"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Highlighted floor plan — fixed height, no layout shift */}
        <div className="relative border-b border-border bg-muted/20 overflow-hidden" style={{ height: 220 }}>
          {highlightedImg && (
            <img
              src={highlightedImg}
              alt={`${shop.block}-blok ${shop.bolim}-bo'lim`}
              className={`w-full h-full object-contain transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
            />
          )}
          {imgLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/30">
              <div className="w-7 h-7 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70 animate-spin" />
              <p className="text-xs text-muted-foreground">Reja yuklanmoqda...</p>
            </div>
          )}
          {!imgLoading && !highlightedImg && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Reja topilmadi</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="px-6 py-5 flex flex-col gap-3 max-h-[40vh] overflow-y-auto">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground shrink-0">{label}</span>
              <span className="text-sm font-bold text-right text-foreground">{value}</span>
            </div>
          ))}
          {shop.status === 'NOT_SALE' && (
            <div className="pt-2 mt-1 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1.5">Sabab</p>
              <p className="text-sm font-medium text-foreground break-words">{shop.not_sale_reason || '—'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


function NotSaleModal({ shop, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!reason.trim() || loading) return
    setLoading(true)
    await onConfirm(reason.trim())
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-1">Sotuvdan chiqarish</h3>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-semibold text-foreground">{shop.address}</span> do'koni sotuvdan chiqariladi.
        </p>
        <textarea
          autoFocus
          placeholder="Sababini yozing..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Bekor
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || loading}
            className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? 'Saqlanmoqda...' : 'Sotuvdan chiqar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RestoreModal({ shop, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-2">Sotuvga chiqarish</h3>
        <p className="text-sm text-muted-foreground mb-6">
          <span className="font-semibold text-foreground">{shop.address}</span> do'koni yana sotuvga chiqariladi.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Bekor
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saqlanmoqda...' : 'Sotuvga chiqar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShopRow({ shop, isAdmin, onStatusChange, onDetail }) {
  const [showNotSaleModal, setShowNotSaleModal] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)

  async function setNotSale(reason) {
    await apiFetch(`/api/apartments/${shop.address}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'NOT_SALE', reason }),
    })
    setShowNotSaleModal(false)
    onStatusChange()
  }

  async function restoreToSale() {
    await apiFetch(`/api/apartments/${shop.address}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'EMPTY' }),
    })
    setShowRestoreModal(false)
    onStatusChange()
  }

  const isNotSale = shop.status === 'NOT_SALE'
  const isEmpty   = shop.status === 'EMPTY'

  return (
    <>
      <tr
        className={`border-t border-border transition-colors cursor-pointer ${
          isNotSale ? 'opacity-55' : 'hover:bg-muted/40'
        }`}
        onDoubleClick={() => onDetail(shop)}
      >
        <td className="px-4 py-3 font-mono font-bold text-sm whitespace-nowrap">{shop.address}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <p className="text-sm font-medium">{shop.block}-blok</p>
          <p className="text-xs text-muted-foreground">{shop.bolim}-bo'lim · {shop.floor}-qavat</p>
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap">{shop.size} m²</td>
        <td className="px-4 py-3 text-sm whitespace-nowrap">
          {shop.price?.toLocaleString('ru-RU')} $
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[shop.status] ?? ''}`}>
            {STATUS_LABEL[shop.status] ?? shop.status}
          </span>
        </td>
        <td className="px-4 py-3">
          {isAdmin && isEmpty && (
            <button
              onClick={() => setShowNotSaleModal(true)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <EyeOff size={12} strokeWidth={2} />
              Sotuvdan chiqar
            </button>
          )}
          {isAdmin && isNotSale && (
            <button
              onClick={() => setShowRestoreModal(true)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              <Eye size={12} strokeWidth={2} />
              Sotuvga chiqar
            </button>
          )}
        </td>
      </tr>

      {showNotSaleModal && (
        <tr><td className="p-0 border-0">
          <NotSaleModal shop={shop} onClose={() => setShowNotSaleModal(false)} onConfirm={setNotSale} />
        </td></tr>
      )}
      {showRestoreModal && (
        <tr><td className="p-0 border-0">
          <RestoreModal shop={shop} onClose={() => setShowRestoreModal(false)} onConfirm={restoreToSale} />
        </td></tr>
      )}
    </>
  )
}

const STATUS_FILTERS = [
  { key: 'all',      label: 'Hammasi' },
  { key: 'EMPTY',    label: 'Sotuvda' },
  { key: 'RESERVED', label: 'Bron' },
  { key: 'SOLD',     label: 'Sotilgan' },
  { key: 'NOT_SALE', label: 'Sotilmaydi' },
]

const BLOCKS = ['A', 'B', 'C']

export default function ShopsPage() {
  const user    = getUser()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  const [search,       setSearch]       = useState('')
  const [blockFilter,  setBlockFilter]  = useState('')
  const [bolimFilter,  setBolimFilter]  = useState('')
  const [floorFilter,  setFloorFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailShop,   setDetailShop]   = useState(null)
  const [filterOpen,   setFilterOpen]   = useState(false)

  const [pendingBlock,  setPendingBlock]  = useState('')
  const [pendingBolim,  setPendingBolim]  = useState('')
  const [pendingFloor,  setPendingFloor]  = useState('')
  const [pendingStatus, setPendingStatus] = useState('all')

  function openSheet() {
    setPendingBlock(blockFilter)
    setPendingBolim(bolimFilter)
    setPendingFloor(floorFilter)
    setPendingStatus(statusFilter)
    setFilterOpen(true)
  }

  function applyFilters() {
    setBlockFilter(pendingBlock)
    setBolimFilter(pendingBolim)
    setFloorFilter(pendingFloor)
    setStatusFilter(pendingStatus)
    setFilterOpen(false)
  }

  function clearFilters() {
    setPendingBlock(''); setPendingBolim(''); setPendingFloor(''); setPendingStatus('all')
  }

  const activeFilterCount = [blockFilter, bolimFilter, floorFilter, statusFilter !== 'all' ? statusFilter : ''].filter(Boolean).length

  const { data: bolimList = [] } = useQuery({
    queryKey: ['bolims', pendingBlock],
    queryFn: () => apiFetch(`/api/bolims?block=${pendingBlock}`).then(r => r.json()),
    enabled: !!pendingBlock,
    staleTime: Infinity,
  })

  const { data: floorList = [] } = useQuery({
    queryKey: ['floors', pendingBlock, pendingBolim],
    queryFn: () => {
      const p = new URLSearchParams({ block: pendingBlock })
      if (pendingBolim) p.set('bolim', pendingBolim)
      return apiFetch(`/api/floors?${p}`).then(r => r.json())
    },
    enabled: !!pendingBlock,
    staleTime: Infinity,
  })

  const bolimListRef = useRef([])
  if (bolimList.length > 0) bolimListRef.current = bolimList
  const bolimDisplay = bolimList.length > 0 ? bolimList : bolimListRef.current

  const floorListRef = useRef([])
  if (floorList.length > 0) floorListRef.current = floorList
  const floorDisplay = floorList.length > 0 ? floorList : floorListRef.current

  const scrollRef        = useRef(null)
  const hasNextPageRef   = useRef(false)
  const fetchingRef      = useRef(false)
  const fetchNextPageRef = useRef(() => {})

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['shops', search, blockFilter, bolimFilter, floorFilter, statusFilter],
    queryFn: ({ pageParam = 0 }) => {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(pageParam) })
      if (search)                 params.set('search', search)
      if (blockFilter)            params.set('block',  blockFilter)
      if (bolimFilter)            params.set('bolim',  bolimFilter)
      if (floorFilter)            params.set('floor',  floorFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      return apiFetch(`/api/shops?${params}`).then(r => r.json())
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < LIMIT ? undefined : allPages.flat().length,
    placeholderData: prev => prev,
  })

  const shops = data?.pages.flat() ?? []

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

  function onStatusChange() {
    queryClient.invalidateQueries({ queryKey: ['shops'] })
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-3 h-full min-h-0 overflow-hidden relative">

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 -mx-4 px-4 md:-mx-6 md:px-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 pt-1">
          <h1 className="text-2xl font-bold">Do'konlar</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-40 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ID, bo'lim, qavat..."
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
              onClick={() => { setStatusFilter('all'); setBlockFilter(''); setBolimFilter(''); setFloorFilter('') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X size={13} strokeWidth={2.5} />
              Tozalash
            </button>
          )}

          {/* Filter button */}
          <button
            onClick={openSheet}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors ${
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

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-auto flex-1 min-h-0 no-scrollbar"
        >
          <table className="w-full text-sm min-w-[540px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/80 backdrop-blur-sm">
                {["Do'kon ID", 'Joylashuv', 'Maydon', 'Narx', 'Status', 'Amallar'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && shops.length === 0
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div
                            className="h-4 bg-muted/60 rounded animate-pulse"
                            style={{ width: `${55 + (i * j * 7) % 35}%` }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                : shops.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground text-sm">
                        {search ? "Qidiruv bo'yicha natija topilmadi" : "Do'konlar topilmadi"}
                      </td>
                    </tr>
                  )
                : shops.map(shop => (
                    <ShopRow
                      key={shop.address}
                      shop={shop}
                      isAdmin={isAdmin}
                      onStatusChange={onStatusChange}
                      onDetail={setDetailShop}
                    />
                  ))
              }

              {/* Infinity scroll sentinel */}
              {shops.length > 0 && (
                <tr ref={sentinelRef}>
                  <td colSpan={6} className="py-3 text-center">
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

      {/* Filter bottom sheet */}
      {filterOpen && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={() => setFilterOpen(false)}>
          <div className="absolute inset-0 bg-black/40 sheet-backdrop" />
          <div className="relative bg-background rounded-t-2xl shadow-2xl flex flex-col max-h-[72vh] sheet-panel" onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-8 h-1 rounded-full bg-border" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
              <p className="font-bold text-sm">Filter</p>
              <button onClick={() => setFilterOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-4">

              {/* Status */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map(f => (
                    <button key={f.key} onClick={() => setPendingStatus(f.key)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        pendingStatus === f.key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                      }`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blok */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Blok</p>
                <div className="flex gap-1.5">
                  <button onClick={() => { setPendingBlock(''); setPendingBolim(''); setPendingFloor('') }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      !pendingBlock ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                    }`}>
                    Barcha
                  </button>
                  {BLOCKS.map(b => (
                    <button key={b} onClick={() => { setPendingBlock(b); setPendingBolim(''); setPendingFloor('') }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        pendingBlock === b ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                      }`}>
                      {b}-blok
                    </button>
                  ))}
                </div>
              </div>

              {/* Bo'lim — always visible */}
              <div className={`transition-opacity duration-200 ${!pendingBlock ? 'opacity-40 pointer-events-none' : ''}`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bo'lim</p>
                <div className="flex flex-wrap gap-1.5 min-h-8 items-start content-start">
                  {bolimDisplay.length > 0 ? (
                    <>
                      <button onClick={() => { setPendingBolim(''); setPendingFloor('') }}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          !pendingBolim ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                        }`}>
                        Barcha
                      </button>
                      {bolimDisplay.map(n => (
                        <button key={n} onClick={() => { setPendingBolim(String(n)); setPendingFloor('') }}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                            pendingBolim === String(n) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                          }`}>
                          {n}
                        </button>
                      ))}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 self-center">Avval blok tanlang</span>
                  )}
                </div>
              </div>

              {/* Qavat — always visible */}
              <div className={`transition-opacity duration-200 ${!pendingBlock ? 'opacity-40 pointer-events-none' : ''}`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Qavat</p>
                <div className="flex flex-wrap gap-1.5 min-h-8 items-start content-start">
                  {floorDisplay.length > 0 ? (
                    <>
                      <button onClick={() => setPendingFloor('')}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          !pendingFloor ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                        }`}>
                        Barcha
                      </button>
                      {floorDisplay.map(f => (
                        <button key={f} onClick={() => setPendingFloor(String(f))}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                            pendingFloor === String(f) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                          }`}>
                          {f}-qavat
                        </button>
                      ))}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 self-center">Avval blok tanlang</span>
                  )}
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex gap-2 shrink-0">
              <button
                onClick={clearFilters}
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

      {detailShop && (
        <ShopDetailModal shop={detailShop} onClose={() => setDetailShop(null)} />
      )}
    </div>
  )
}
