import { useState, useRef, useCallback, useEffect } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { getUser, apiFetch } from '@/shared/lib/auth'
import { Search, X, SlidersHorizontal, EyeOff, Eye } from 'lucide-react'

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

const LIMIT = 50

const STATUS_BADGE = {
  EMPTY:    'bg-sky-100 text-sky-700 border border-sky-200',
  RESERVED: 'bg-amber-100 text-amber-700 border border-amber-200',
  SOLD:     'bg-red-100 text-red-700 border border-red-200',
  NOT_SALE: 'bg-muted text-muted-foreground border border-border',
}
const STATUS_LABEL = {
  EMPTY:    'Sotuvda',
  RESERVED: 'Bron',
  SOLD:     'Sotilgan',
  NOT_SALE: 'Sotilmaydi',
}
const STATUS_BG = {
  EMPTY:    'bg-sky-50 border-sky-100',
  RESERVED: 'bg-amber-50 border-amber-100',
  SOLD:     'bg-red-50 border-red-100',
  NOT_SALE: 'bg-muted border-border',
}

function WcDetailModal({ wc, onClose }) {
  const [block, bolimStr, aptStr] = wc.address.split('-')
  const bolim = parseInt(bolimStr)
  const floor = aptStr ? parseInt(aptStr[0]) : 1

  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    const src = loadImg(block, floor, bolim)
    setImgSrc(src)
  }, [wc.address])

  const rows = [
    { label: 'Hojatxona ID', value: wc.address },
    { label: 'Blok',         value: `${wc.block}-blok` },
    { label: "Bo'lim",       value: `${wc.bolim}-bo'lim` },
    { label: 'Qavat',        value: `${wc.floor}-qavat` },
    { label: 'Maydon',       value: `${wc.size} m²` },
    { label: 'Narx (m²)',    value: '2 000 $' },
    { label: 'Jami narx',    value: `${(2000 * wc.size).toLocaleString('ru-RU')} $` },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
        <div className={`px-6 py-4 flex items-center gap-3 border-b ${STATUS_BG[wc.status] ?? 'bg-muted border-border'}`}>
          <div className="flex-1 min-w-0">
            <p className="font-black text-xl tracking-tight text-foreground">{wc.address}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {wc.block}-blok · {wc.bolim}-bo'lim · {wc.floor}-qavat · Hojatxona
            </p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE[wc.status] ?? ''}`}>
            {STATUS_LABEL[wc.status] ?? wc.status}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/8 hover:bg-black/15 transition-colors shrink-0"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <div className="relative border-b border-border bg-muted/20 overflow-hidden" style={{ height: 180 }}>
          {imgSrc
            ? <img src={imgSrc} alt={`${wc.block}-blok reja`} className="w-full h-full object-contain" />
            : <div className="absolute inset-0 flex items-center justify-center"><p className="text-xs text-muted-foreground">Reja topilmadi</p></div>
          }
        </div>

        <div className="px-6 py-5 flex flex-col gap-3 max-h-[40vh] overflow-y-auto">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground shrink-0">{label}</span>
              <span className="text-sm font-bold text-right text-foreground">{value}</span>
            </div>
          ))}
          {wc.status === 'NOT_SALE' && (
            <div className="pt-2 mt-1 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1.5">Sabab</p>
              <p className="text-sm font-medium text-foreground break-words">{wc.not_sale_reason || '—'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NotSaleModal({ wc, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!reason.trim() || loading) return
    setLoading(true)
    await onConfirm(reason.trim())
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-1">Sotuvdan chiqarish</h3>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-semibold text-foreground">{wc.address}</span> hojatxonasi sotuvdan chiqariladi.
        </p>
        <textarea
          autoFocus placeholder="Sababini yozing..." value={reason}
          onChange={e => setReason(e.target.value)} rows={3}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Bekor</button>
          <button onClick={handleConfirm} disabled={!reason.trim() || loading}
            className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40">
            {loading ? 'Saqlanmoqda...' : 'Sotuvdan chiqar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RestoreModal({ wc, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  async function handleConfirm() { setLoading(true); await onConfirm(); setLoading(false) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-2">Sotuvga chiqarish</h3>
        <p className="text-sm text-muted-foreground mb-6">
          <span className="font-semibold text-foreground">{wc.address}</span> hojatxonasi yana sotuvga chiqariladi.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Bekor</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {loading ? 'Saqlanmoqda...' : 'Sotuvga chiqar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WcRow({ wc, isAdmin, onStatusChange, onDetail }) {
  const [showNotSaleModal, setShowNotSaleModal] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)

  async function setNotSale(reason) {
    await apiFetch(`/api/apartments/${wc.address}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'NOT_SALE', reason }),
    })
    setShowNotSaleModal(false)
    onStatusChange()
  }

  async function restoreToSale() {
    await apiFetch(`/api/apartments/${wc.address}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'EMPTY' }),
    })
    setShowRestoreModal(false)
    onStatusChange()
  }

  const isNotSale = wc.status === 'NOT_SALE'
  const isEmpty   = wc.status === 'EMPTY'

  return (
    <>
      <tr
        className={`border-t border-border transition-colors cursor-pointer ${isNotSale ? 'opacity-55' : 'hover:bg-muted/40'}`}
        onDoubleClick={() => onDetail(wc)}
      >
        <td className="px-4 py-3 font-mono font-bold text-sm whitespace-nowrap">{wc.address}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <p className="text-sm font-medium">{wc.block}-blok</p>
          <p className="text-xs text-muted-foreground">{wc.bolim}-bo'lim · {wc.floor}-qavat</p>
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap">{wc.size} m²</td>
        <td className="px-4 py-3 text-sm whitespace-nowrap">{(2000 * wc.size).toLocaleString('ru-RU')} $</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[wc.status] ?? ''}`}>
            {STATUS_LABEL[wc.status] ?? wc.status}
          </span>
        </td>
        <td className="px-4 py-3">
          {isAdmin && isEmpty && (
            <button onClick={() => setShowNotSaleModal(true)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
              <EyeOff size={12} strokeWidth={2} /> Sotuvdan chiqar
            </button>
          )}
          {isAdmin && isNotSale && (
            <button onClick={() => setShowRestoreModal(true)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
              <Eye size={12} strokeWidth={2} /> Sotuvga chiqar
            </button>
          )}
        </td>
      </tr>
      {showNotSaleModal && <tr><td className="p-0 border-0"><NotSaleModal wc={wc} onClose={() => setShowNotSaleModal(false)} onConfirm={setNotSale} /></td></tr>}
      {showRestoreModal && <tr><td className="p-0 border-0"><RestoreModal wc={wc} onClose={() => setShowRestoreModal(false)} onConfirm={restoreToSale} /></td></tr>}
    </>
  )
}

const STATUS_FILTERS = [
  { key: 'all',      label: 'Hammasi'   },
  { key: 'EMPTY',    label: 'Sotuvda'   },
  { key: 'RESERVED', label: 'Bron'      },
  { key: 'SOLD',     label: 'Sotilgan'  },
  { key: 'NOT_SALE', label: 'Sotilmaydi'},
]
const BLOCKS = ['A', 'B', 'C']

export default function HojatxonalarPage() {
  const user    = getUser()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  const [search,       setSearch]       = useState('')
  const [blockFilter,  setBlockFilter]  = useState('')
  const [bolimFilter,  setBolimFilter]  = useState('')
  const [floorFilter,  setFloorFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailWc,     setDetailWc]     = useState(null)
  const [filterOpen,   setFilterOpen]   = useState(false)

  const [pendingBlock,  setPendingBlock]  = useState('')
  const [pendingBolim,  setPendingBolim]  = useState('')
  const [pendingFloor,  setPendingFloor]  = useState('')
  const [pendingStatus, setPendingStatus] = useState('all')

  function openSheet() {
    setPendingBlock(blockFilter); setPendingBolim(bolimFilter)
    setPendingFloor(floorFilter); setPendingStatus(statusFilter)
    setFilterOpen(true)
  }
  function applyFilters() {
    setBlockFilter(pendingBlock); setBolimFilter(pendingBolim)
    setFloorFilter(pendingFloor); setStatusFilter(pendingStatus)
    setFilterOpen(false)
  }
  function clearFilters() {
    setPendingBlock(''); setPendingBolim(''); setPendingFloor(''); setPendingStatus('all')
  }

  const activeFilterCount = [blockFilter, bolimFilter, floorFilter, statusFilter !== 'all' ? statusFilter : ''].filter(Boolean).length

  const { data: bolimList = [] } = useQuery({
    queryKey: ['wc-bolims', pendingBlock],
    queryFn: () => apiFetch(`/api/bolims?block=${pendingBlock}`).then(r => r.json()),
    enabled: !!pendingBlock,
    staleTime: Infinity,
  })
  const { data: floorList = [] } = useQuery({
    queryKey: ['wc-floors', pendingBlock, pendingBolim],
    queryFn: () => {
      const p = new URLSearchParams({ block: pendingBlock })
      if (pendingBolim) p.set('bolim', pendingBolim)
      return apiFetch(`/api/floors?${p}`).then(r => r.json())
    },
    enabled: !!pendingBlock,
    staleTime: Infinity,
  })

  const bolimListRef = useRef([]); if (bolimList.length > 0) bolimListRef.current = bolimList
  const floorListRef = useRef([]); if (floorList.length > 0) floorListRef.current = floorList
  const bolimDisplay = bolimList.length > 0 ? bolimList : bolimListRef.current
  const floorDisplay = floorList.length > 0 ? floorList : floorListRef.current

  const scrollRef        = useRef(null)
  const hasNextPageRef   = useRef(false)
  const fetchingRef      = useRef(false)
  const fetchNextPageRef = useRef(() => {})

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['hojatxonalar', search, blockFilter, bolimFilter, floorFilter, statusFilter],
    queryFn: ({ pageParam = 0 }) => {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(pageParam) })
      if (search)                 params.set('search', search)
      if (blockFilter)            params.set('block',  blockFilter)
      if (bolimFilter)            params.set('bolim',  bolimFilter)
      if (floorFilter)            params.set('floor',  floorFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      return apiFetch(`/api/wc?${params}`).then(r => r.json())
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < LIMIT ? undefined : allPages.flat().length,
    placeholderData: prev => prev,
  })

  const items = data?.pages.flat() ?? []
  hasNextPageRef.current   = hasNextPage
  fetchingRef.current      = isFetchingNextPage
  fetchNextPageRef.current = fetchNextPage

  const sentinelRef = useCallback(node => {
    if (!node || !scrollRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPageRef.current && !fetchingRef.current)
          fetchNextPageRef.current()
      },
      { root: scrollRef.current, rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function onStatusChange() {
    queryClient.invalidateQueries({ queryKey: ['hojatxonalar'] })
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-3 h-full min-h-0 overflow-hidden relative">

      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 -mx-4 px-4 md:-mx-6 md:px-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 pt-1">
          <h1 className="text-2xl font-bold">Hojatxonalar</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-40 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text" placeholder="ID, bo'lim, qavat..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button onClick={() => { setStatusFilter('all'); setBlockFilter(''); setBolimFilter(''); setFloorFilter('') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
              <X size={13} strokeWidth={2.5} /> Tozalash
            </button>
          )}

          <button onClick={openSheet}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors ${
              activeFilterCount > 0 ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}>
            <SlidersHorizontal size={14} />
            Filter
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-background text-foreground text-xs font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0">
        <div ref={scrollRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0 no-scrollbar">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/80 backdrop-blur-sm">
                {['Hojatxona ID', 'Joylashuv', 'Maydon', 'Jami narx', 'Status', 'Amallar'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/60 rounded animate-pulse" style={{ width: `${55 + (i * j * 7) % 35}%` }} /></td>
                      ))}
                    </tr>
                  ))
                : items.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground text-sm">
                        {search ? "Qidiruv bo'yicha natija topilmadi" : 'Hojatxonalar topilmadi'}
                      </td>
                    </tr>
                  )
                : items.map(wc => (
                    <WcRow key={wc.address} wc={wc} isAdmin={isAdmin} onStatusChange={onStatusChange} onDetail={setDetailWc} />
                  ))
              }
              {items.length > 0 && (
                <tr ref={sentinelRef}>
                  <td colSpan={6} className="py-3 text-center">
                    {isFetchingNextPage && (
                      <div className="flex items-center justify-center gap-1.5">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                            style={{ animation: 'loader-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
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

      {filterOpen && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={() => setFilterOpen(false)}>
          <div className="absolute inset-0 bg-black/40 sheet-backdrop" />
          <div className="relative bg-background rounded-t-2xl shadow-2xl flex flex-col max-h-[72vh] sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2.5 pb-1 shrink-0"><div className="w-8 h-1 rounded-full bg-border" /></div>
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
              <p className="font-bold text-sm">Filter</p>
              <button onClick={() => setFilterOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"><X size={13} strokeWidth={2.5} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map(f => (
                    <button key={f.key} onClick={() => setPendingStatus(f.key)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingStatus === f.key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Blok</p>
                <div className="flex gap-1.5">
                  <button onClick={() => { setPendingBlock(''); setPendingBolim(''); setPendingFloor('') }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${!pendingBlock ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    Barcha
                  </button>
                  {BLOCKS.map(b => (
                    <button key={b} onClick={() => { setPendingBlock(b); setPendingBolim(''); setPendingFloor('') }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingBlock === b ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {b}-blok
                    </button>
                  ))}
                </div>
              </div>
              <div className={`transition-opacity duration-200 ${!pendingBlock ? 'opacity-40 pointer-events-none' : ''}`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bo'lim</p>
                <div className="flex flex-wrap gap-1.5 min-h-8">
                  {bolimDisplay.length > 0 ? (
                    <>
                      <button onClick={() => { setPendingBolim(''); setPendingFloor('') }}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${!pendingBolim ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>Barcha</button>
                      {bolimDisplay.map(n => (
                        <button key={n} onClick={() => { setPendingBolim(String(n)); setPendingFloor('') }}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingBolim === String(n) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>{n}</button>
                      ))}
                    </>
                  ) : <span className="text-xs text-muted-foreground/50 self-center">Avval blok tanlang</span>}
                </div>
              </div>
              <div className={`transition-opacity duration-200 ${!pendingBlock ? 'opacity-40 pointer-events-none' : ''}`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Qavat</p>
                <div className="flex flex-wrap gap-1.5 min-h-8">
                  {floorDisplay.length > 0 ? (
                    <>
                      <button onClick={() => setPendingFloor('')}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${!pendingFloor ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>Barcha</button>
                      {floorDisplay.map(f => (
                        <button key={f} onClick={() => setPendingFloor(String(f))}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingFloor === String(f) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>{f}-qavat</button>
                      ))}
                    </>
                  ) : <span className="text-xs text-muted-foreground/50 self-center">Avval blok tanlang</span>}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex gap-2 shrink-0">
              <button onClick={clearFilters} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Tozalash</button>
              <button onClick={applyFilters} className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">Qo'llash</button>
            </div>
          </div>
        </div>
      )}

      {detailWc && <WcDetailModal wc={detailWc} onClose={() => setDetailWc(null)} />}
    </div>
  )
}
