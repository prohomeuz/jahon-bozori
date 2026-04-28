import { useRef, useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient, keepPreviousData, useMutation } from '@tanstack/react-query'
import { usePan } from '@/pages/home/lib/usePan'
import { useGlobalZoom } from '@/shared/hooks/useGlobalZoom'
import { useGestureGuard } from '@/shared/hooks/useGestureGuard'
import { A_RECT_OVERLAYS } from '../config/aRectOverlays'
import { A_FLOOR2_RECT_OVERLAYS } from '../config/aFloor2RectOverlays'
import { B_RECT_OVERLAYS } from '../config/bRectOverlays'
import { B_FLOOR2_RECT_OVERLAYS } from '../config/bFloor2RectOverlays'
import { C_RECT_OVERLAYS } from '../config/cRectOverlays'
import { C_FLOOR2_RECT_OVERLAYS } from '../config/cFloor2RectOverlays'
import { WC_OVERLAYS } from '../config/hojatxonaOverlays'
import { ApartmentModal } from './ApartmentModal'
import { AdminButton } from '@/shared/ui/AdminButton'
import { X, Lock } from 'lucide-react'
import { getUser } from '@/shared/lib/auth'

function NotSaleInfoModal({ apt, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden">
        <div className="px-6 py-5 flex items-center gap-3 bg-muted border-b border-border">
          <span className="w-3 h-3 rounded-full bg-muted-foreground/40 shrink-0" />
          <span className="font-black text-xl text-foreground tracking-tight flex-1">{apt.address}</span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-muted text-muted-foreground border-border">
            Sotilmaydi
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/8 hover:bg-black/15 transition-colors ml-1"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide font-semibold">Sabab</p>
          <p className="text-sm font-medium text-foreground">{apt.not_sale_reason || '—'}</p>
        </div>
      </div>
    </div>
  )
}
import { useRealtimeApts } from '@/shared/hooks/useRealtimeApts'
import { useBlockedState } from '@/shared/hooks/useBlockedState'
import { BlockedOverlay } from '@/shared/ui/BlockedOverlay'
import { apiFetch } from '@/shared/lib/auth'
import { imgCache } from '@/shared/lib/imgCache'

const aImages1 = import.meta.glob('@/assets/blocks/A/1/*.webp', { eager: true })
const aImages2 = import.meta.glob('@/assets/blocks/A/2/*.webp', { eager: true })
const bImages1 = import.meta.glob('@/assets/blocks/B/1/*.webp', { eager: true })
const bImages2 = import.meta.glob('@/assets/blocks/B/2/*.webp', { eager: true })
const cImages1 = import.meta.glob('@/assets/blocks/C/1/*.webp', { eager: true })
const cImages2 = import.meta.glob('@/assets/blocks/C/2/*.webp', { eager: true })

function getImg(map, num) {
  const entry = Object.entries(map).find(([k]) => k.split('/').pop().split('.')[0] === String(num))
  return entry ? entry[1].default : null
}

function PanZoomPane({ src, alt, overlay, aptByAddress, onSelect, ready, wcZone, onWcClick }) {
  const ref = useRef(null)
  const { scale } = useGlobalZoom(ref)
  const { pos } = usePan(ref)
  const gesturedRef = useGestureGuard(ref)
  const [hovered, setHovered] = useState(null)

  const DOT_SPACING = 28
  const offsetX = ((pos.x % DOT_SPACING) + DOT_SPACING) % DOT_SPACING
  const offsetY = ((pos.y % DOT_SPACING) + DOT_SPACING) % DOT_SPACING

  return (
    <div
      ref={ref}
      className="relative flex-1 overflow-hidden bg-background"
      style={{ touchAction: 'none', cursor: ready ? 'grab' : 'default' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          inset: `-${DOT_SPACING}px`,
          backgroundImage: 'radial-gradient(circle, color-mix(in srgb, currentColor 18%, transparent) 1.5px, transparent 1.5px)',
          backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          willChange: 'transform',
        }}
      />

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          willChange: 'transform',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      >
        {src ? (
          <div className="relative inline-block">
            <img
              src={src}
              alt={alt}
              draggable={false}
              className="block max-w-full max-h-full object-contain select-none"
            />
            {overlay && (
              <svg viewBox={overlay.viewBox} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                {overlay.rects.map((r) => {
                  const apt = aptByAddress[r.id.split('-').pop()]
                  const isHovered = hovered === r.id
                  const status = apt?.status ?? 'UNKNOWN'
                  const baseColor =
                    status === 'EMPTY'    ? 'rgba(34,197,94,0.5)'    :
                    status === 'RESERVED' ? 'rgba(234,179,8,0.65)'   :
                    status === 'SOLD'     ? 'rgba(239,68,68,0.6)'    :
                    status === 'NOT_SALE' ? 'rgba(156,163,175,0.55)' :
                    'rgba(120,120,120,0.35)'
                  const hoverColor =
                    status === 'EMPTY'    ? 'rgba(22,163,74,0.75)'   :
                    status === 'RESERVED' ? 'rgba(202,138,4,0.85)'   :
                    status === 'SOLD'     ? 'rgba(220,38,38,0.82)'   :
                    status === 'NOT_SALE' ? 'rgba(107,114,128,0.75)' :
                    'rgba(70,70,70,0.65)'
                  const strokeColor =
                    status === 'EMPTY'    ? '#15803d' :
                    status === 'RESERVED' ? '#854d0e' :
                    status === 'SOLD'     ? '#b91c1c' :
                    status === 'NOT_SALE' ? '#6b7280' :
                    '#111'
                  const sharedProps = {
                    fill: isHovered ? hoverColor : baseColor,
                    stroke: strokeColor,
                    strokeWidth: 4,
                    style: { cursor: apt ? 'pointer' : 'default' },
                    onMouseEnter: () => setHovered(r.id),
                    onMouseLeave: () => setHovered(null),
                    onDoubleClick: () => !gesturedRef.current && apt && onSelect?.(apt),
                  }
                  return r.d
                    ? <path key={r.id} {...sharedProps} d={r.d} />
                    : <rect key={r.id} {...sharedProps} x={r.x} y={r.y} width={r.width} height={r.height} />
                })}
              </svg>
            )}
            {wcZone && (() => {
              const pts = wcZone.points.split(/\s+/).map(p => p.split(',').map(Number))
              const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
              const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
              const vb = wcZone.viewBox.split(' ').map(Number)
              const r = Math.min(vb[2], vb[3]) * 0.032
              const fs = r * 0.95
              return (
                <svg viewBox={wcZone.viewBox} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                  <polygon
                    points={wcZone.points}
                    fill="rgba(56,189,248,0.42)"
                    stroke="rgba(14,165,233,0.95)"
                    strokeWidth="4"
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onDoubleClick={() => !gesturedRef.current && onWcClick?.()}
                  />
                  <circle cx={cx} cy={cy} r={r} fill="white" stroke="rgba(14,165,233,0.95)" strokeWidth="3" style={{ pointerEvents: 'none' }} />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="700" fill="rgba(14,165,233,1)" style={{ pointerEvents: 'none', userSelect: 'none' }}>WC</text>
                </svg>
              )
            })()}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Rasm mavjud emas</span>
        )}
      </div>
    </div>
  )
}

// Rasm oldindan yuklab, cache'ga qo'shadi. Allaqachon yuklangan bo'lsa resolve qiladi.
function preloadImage(src) {
  if (!src || imgCache.has(src)) return Promise.resolve()
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => { imgCache.add(src); resolve() }
    img.onerror = resolve
    img.src = src
  })
}

export default function BolimPage() {
  const { blockId, num } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [modal, setModal]               = useState(null)
  const [notSaleApt, setNotSaleApt]     = useState(null)
  const [wcListOpen, setWcListOpen]     = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const activeFloor = parseInt(searchParams.get('floor') ?? '1') === 2 ? 2 : 1
  const setActiveFloor = (f) => setSearchParams({ floor: f }, { replace: true })
  useRealtimeApts()
  const isBlocked = useBlockedState({ hasRealtimeApts: true })

  const bolimNum = parseInt(num)

  const imgMap1 = blockId === 'B' ? bImages1 : blockId === 'C' ? cImages1 : aImages1
  const imgMap2 = blockId === 'B' ? bImages2 : blockId === 'C' ? cImages2 : aImages2
  const img1 = getImg(imgMap1, bolimNum)
  const img2 = getImg(imgMap2, bolimNum)
  const currentSrc = activeFloor === 1 ? img1 : img2

  // Rasm yuklash: allaqachon cache'da bo'lsa — darhol tayyor
  useEffect(() => {
    if (!currentSrc) { setImgLoaded(true); return }
    if (imgCache.has(currentSrc)) { setImgLoaded(true); return }
    setImgLoaded(false)
    preloadImage(currentSrc).then(() => setImgLoaded(true))
  }, [currentSrc])

  const { data: bolimList = [] } = useQuery({
    queryKey: ['bolims', blockId],
    queryFn: () => apiFetch(`/api/bolims?block=${blockId}`).then(r => r.json()),
    staleTime: Infinity,
  })
  const currentIdx = bolimList.indexOf(bolimNum)
  const prevBolim = currentIdx > 0 ? bolimList[currentIdx - 1] : null
  const nextBolim = currentIdx < bolimList.length - 1 ? bolimList[currentIdx + 1] : null

  const { data: apts = [], isLoading: aptsLoading } = useQuery({
    queryKey: ['apartments', blockId, bolimNum, activeFloor],
    queryFn: () => apiFetch(`/api/apartments?block=${blockId}&bolim=${bolimNum}&floor=${activeFloor}`).then(r => r.json()),
    placeholderData: keepPreviousData,
  })
  const aptByAddress = Object.fromEntries(apts.map(a => [a.address.split('-').pop(), a]))

  const { data: stats } = useQuery({
    queryKey: ['bolim-stats', blockId, bolimNum],
    queryFn: () => apiFetch(`/api/apartments/stats?block=${blockId}&bolim=${bolimNum}`).then(r => r.json()),
    staleTime: 30_000,
  })

  const { data: priceData } = useQuery({
    queryKey: ['price', blockId, bolimNum, activeFloor],
    queryFn: () => apiFetch(`/api/prices?block=${blockId}&bolim=${bolimNum}&floor=${activeFloor}`).then(r => r.json()),
    staleTime: 60_000,
  })

  const { data: locks = [] } = useQuery({
    queryKey: ['sales-locks'],
    queryFn: () => apiFetch('/api/sales-locks').then(r => r.json()),
    staleTime: 30_000,
  })
  const blockLock = locks.find(l =>
    l.block === blockId?.toUpperCase() &&
    l.bolim === bolimNum &&
    l.floor === activeFloor
  ) ?? null
  const isAdmin = getUser()?.role === 'admin'

  const { mutate: doUnlock, isPending: unlocking } = useMutation({
    mutationFn: () => apiFetch('/api/sales-locks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block: blockId?.toUpperCase(), bolim: bolimNum, floor: activeFloor }),
    }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales-locks'] }),
  })

  const ready = imgLoaded && !aptsLoading

  function goBolim(n) {
    navigate(`/block/${blockId}/bolim/${n}?floor=${activeFloor}`)
  }

  const overlay1 =
    blockId === 'A' ? (A_RECT_OVERLAYS[bolimNum] ?? null) :
    blockId === 'B' ? (B_RECT_OVERLAYS[bolimNum] ?? null) :
    blockId === 'C' ? (C_RECT_OVERLAYS[bolimNum] ?? null) :
    null
  const overlay2 =
    blockId === 'A' ? (A_FLOOR2_RECT_OVERLAYS[bolimNum] ?? null) :
    blockId === 'B' ? (B_FLOOR2_RECT_OVERLAYS[bolimNum] ?? null) :
    blockId === 'C' ? (C_FLOOR2_RECT_OVERLAYS[bolimNum] ?? null) :
    null

  const wcPoints = WC_OVERLAYS[blockId?.toUpperCase()]?.[activeFloor]?.[bolimNum] ?? null
  const currentOverlay = activeFloor === 1 ? overlay1 : overlay2
  const wcZone = wcPoints && currentOverlay ? { points: wcPoints, viewBox: currentOverlay.viewBox } : null

  const { data: wcApts = [] } = useQuery({
    queryKey: ['wc', blockId, bolimNum, activeFloor],
    queryFn: () => apiFetch(`/api/wc?block=${blockId}&bolim=${bolimNum}&floor=${activeFloor}`).then(r => r.json()),
    enabled: wcListOpen,
    staleTime: 30_000,
  })

  const hasFloor2 = !!img2

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {isBlocked && <BlockedOverlay />}
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-background shrink-0">
        <button
          onClick={() => navigate(`/block/${blockId}`)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Orqaga
        </button>
        <span className="text-foreground font-semibold text-base">
          {blockId?.toUpperCase()}-BLOK — {bolimNum}-BO'LIM
        </span>
        <div className="ml-auto">
          <AdminButton />
        </div>
      </div>

      {/* Legend */}
      <div className="fixed top-20 right-5 z-40 flex flex-col bg-background/90 backdrop-blur-sm border border-border rounded-2xl shadow-xl overflow-hidden min-w-[220px]">
        <div className="flex flex-col gap-1 px-5 py-4">
          {[
            { color: 'bg-green-500',  label: "Bo'sh",      key: 'EMPTY'    },
            { color: 'bg-yellow-400', label: 'Bron',       key: 'RESERVED' },
            { color: 'bg-red-500',    label: 'Sotilgan',   key: 'SOLD'     },
            { color: 'bg-gray-400',   label: 'Sotilmaydi', key: 'NOT_SALE' },
          ].map(({ color, label, key }) => (
            <div key={label} className="flex items-center gap-3 py-0.5">
              <span className={`w-3 h-3 rounded-full ${color} shrink-0`} />
              <span className="text-sm font-medium text-foreground flex-1">{label}</span>
              {stats != null && (
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {stats[key] ?? 0}
                </span>
              )}
            </div>
          ))}
          {stats != null && (
            <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Jami</span>
              <span className="text-xs font-bold tabular-nums text-foreground">
                {(stats.EMPTY ?? 0) + (stats.RESERVED ?? 0) + (stats.SOLD ?? 0) + (stats.NOT_SALE ?? 0)}
              </span>
            </div>
          )}
        </div>
        {priceData?.price != null && (
          <div className="px-5 py-4 bg-amber-50 border-t border-amber-200">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">{activeFloor}-qavat narxi</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black tabular-nums text-amber-900 leading-none">
                ${priceData.price.toLocaleString('ru-RU')}
              </span>
              <span className="text-xs font-semibold text-amber-600">/m²</span>
            </div>
          </div>
        )}
      </div>

      {/* Bo'lim navigatsiya */}
      <div className="fixed bottom-8 left-8 z-50 flex items-center rounded-2xl overflow-hidden shadow-xl border border-border bg-background">
        <button
          onClick={() => prevBolim && goBolim(prevBolim)}
          disabled={!prevBolim}
          className="px-7 py-5 text-2xl font-bold transition-colors disabled:opacity-25 disabled:cursor-not-allowed hover:bg-muted"
        >
          ‹
        </button>
        <div className="w-px bg-border self-stretch" />
        <span className="px-6 py-5 text-base font-bold tracking-widest">{bolimNum}</span>
        <div className="w-px bg-border self-stretch" />
        <button
          onClick={() => nextBolim && goBolim(nextBolim)}
          disabled={!nextBolim}
          className="px-7 py-5 text-2xl font-bold transition-colors disabled:opacity-25 disabled:cursor-not-allowed hover:bg-muted"
        >
          ›
        </button>
      </div>

      {/* Qavat tanlash */}
      <div className="fixed bottom-8 right-8 z-50 flex rounded-2xl overflow-hidden shadow-xl border border-border bg-background">
        <button
          onClick={() => setActiveFloor(1)}
          className={[
            'px-7 py-5 text-base font-bold tracking-widest transition-colors',
            activeFloor === 1
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          ].join(' ')}
        >
          1-QAVAT
        </button>
        <div className="w-px bg-border" />
        {hasFloor2 ? (
          <button
            onClick={() => setActiveFloor(2)}
            className={[
              'px-7 py-5 text-base font-bold tracking-widest transition-colors',
              activeFloor === 2
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            ].join(' ')}
          >
            2-QAVAT
          </button>
        ) : (
          <button
            disabled
            className="px-7 py-5 text-base font-bold tracking-widest text-muted-foreground/40 cursor-not-allowed flex items-center gap-2"
          >
            2-QAVAT
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
              Tez kunda
            </span>
          </button>
        )}
      </div>

      {/* Kontent */}
      <div className="relative flex flex-col flex-1 overflow-hidden bg-background">
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-background">
            <div className="relative w-12 h-12">
              <svg className="w-full h-full animate-spin" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" strokeOpacity="0.1" />
                <path d="M24 4a20 20 0 0 1 20 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground font-medium tracking-wide">Yuklanmoqda...</p>
          </div>
        )}
        <PanZoomPane
          key={activeFloor}
          src={currentSrc}
          alt={`${bolimNum}-bo'lim ${activeFloor}-qavat`}
          overlay={activeFloor === 1 ? overlay1 : overlay2}
          aptByAddress={aptByAddress}
          onSelect={(apt) => {
            if (blockLock) return
            if (apt.status === 'NOT_SALE') { setNotSaleApt(apt); return }
            setModal({ apartment: apt, floor: activeFloor })
          }}
          ready={ready}
          wcZone={wcZone}
          onWcClick={() => { if (!blockLock) setWcListOpen(true) }}
        />
        {/* Sotuv qulfi banneri — faqat kontent ustida, navigatsiyani bloklamaydi */}
        {blockLock && (
          <div className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}>
            <div className="flex flex-col items-center gap-3 bg-background rounded-3xl shadow-2xl px-8 py-7 max-w-xs w-full mx-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <Lock size={26} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{bolimNum}-bo'lim · {activeFloor}-qavat</p>
                <p className="text-sm font-semibold text-red-600 mt-0.5">Sotuv to'xtatilgan</p>
              </div>
              <p className="text-xs text-muted-foreground">"{blockLock.reason}"</p>
              <p className="text-xs text-muted-foreground/70">{blockLock.locked_at} · {blockLock.locked_by}</p>
              {isAdmin && (
                <button onClick={() => doUnlock()} disabled={unlocking}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-60">
                  <Lock size={12} />
                  {unlocking ? 'Ochilmoqda…' : 'Qulfdan ochish'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {modal && (
        <ApartmentModal
          apartment={modal.apartment}
          floor={modal.floor}
          blockId={blockId?.toUpperCase()}
          bolimNum={bolimNum}
          onClose={() => setModal(null)}
          onBooked={() => queryClient.invalidateQueries({ queryKey: ['apartments', blockId, bolimNum, activeFloor] })}
        />
      )}

      {notSaleApt && (
        <NotSaleInfoModal apt={notSaleApt} onClose={() => setNotSaleApt(null)} />
      )}

      {wcListOpen && (
        <WcListModal
          apts={wcApts}
          blockId={blockId?.toUpperCase()}
          bolimNum={bolimNum}
          floor={activeFloor}
          onClose={() => setWcListOpen(false)}
          onBooked={() => queryClient.invalidateQueries({ queryKey: ['wc', blockId, bolimNum, activeFloor] })}
        />
      )}

    </div>
  )
}

const WC_STATUS_COLOR = {
  EMPTY:    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  RESERVED: { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400'  },
  SOLD:     { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'    },
  NOT_SALE: { bg: 'bg-muted',       text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground/40' },
}
const WC_STATUS_LABEL = { EMPTY: "Bo'sh", RESERVED: 'Bron', SOLD: 'Sotilgan', NOT_SALE: 'Sotilmaydi' }

function WcListModal({ apts, blockId, bolimNum, floor, onClose, onBooked }) {
  const [selected, setSelected] = useState(null)
  const [notSale, setNotSale] = useState(null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full h-full bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">

        {/* LIST VIEW */}
        <div
          className="absolute inset-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: selected ? 'translateX(-100%)' : 'translateX(0)' }}
        >
          <div className="flex items-center px-6 border-b border-border shrink-0 h-20 bg-sky-50/60">
            <div className="flex-1">
              <p className="text-2xl font-black tracking-tight text-sky-900">Hojatxonalar</p>
              <p className="text-sm text-sky-600 mt-0.5">{blockId}-blok · {bolimNum}-bo'lim · {floor}-qavat</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center bg-black/8 hover:bg-black/15 transition-colors">
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {apts.length === 0 && (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">Hojatxonalar topilmadi</p>
            )}
            {apts.map(wc => {
              const sc = WC_STATUS_COLOR[wc.status] ?? WC_STATUS_COLOR.NOT_SALE
              const clickable = wc.status !== 'SOLD'
              return (
                <button
                  key={wc.address}
                  disabled={!clickable}
                  onClick={() => {
                    if (wc.status === 'NOT_SALE') { setNotSale(wc); return }
                    setSelected(wc)
                  }}
                  className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${clickable ? 'hover:bg-muted/40 active:bg-muted/60' : 'opacity-40 cursor-not-allowed'}`}
                >
                  <span className={`w-3 h-3 rounded-full shrink-0 ${sc.dot}`} />
                  <span className="font-bold text-lg text-foreground flex-1">{wc.address}</span>
                  <span className="text-sm text-muted-foreground">{wc.size} m²</span>
                  <span className="text-sm text-muted-foreground">{((wc.price ?? 2000) * wc.size).toLocaleString('ru-RU')} $</span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                    {WC_STATUS_LABEL[wc.status] ?? wc.status}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* DETAIL VIEW */}
        <div
          className="absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: selected ? 'translateX(0)' : 'translateX(100%)' }}
        >
          {selected && (
            <ApartmentModal
              embedded
              apartment={selected}
              floor={floor}
              blockId={blockId}
              bolimNum={bolimNum}
              onClose={() => setSelected(null)}
              onBooked={() => onBooked?.()}
            />
          )}
        </div>

      </div>

      {notSale && <NotSaleInfoModal apt={notSale} onClose={() => setNotSale(null)} />}
    </div>
  )
}
