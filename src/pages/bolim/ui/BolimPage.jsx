import { useRef, useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { usePan } from '@/pages/home/lib/usePan'
import { useGlobalZoom } from '@/shared/hooks/useGlobalZoom'
import { useGestureGuard } from '@/shared/hooks/useGestureGuard'
import { A_RECT_OVERLAYS } from '../config/aRectOverlays'
import { A_FLOOR2_RECT_OVERLAYS } from '../config/aFloor2RectOverlays'
import { B_RECT_OVERLAYS } from '../config/bRectOverlays'
import { B_FLOOR2_RECT_OVERLAYS } from '../config/bFloor2RectOverlays'
import { C_RECT_OVERLAYS } from '../config/cRectOverlays'
import { C_FLOOR2_RECT_OVERLAYS } from '../config/cFloor2RectOverlays'
import { ApartmentModal } from './ApartmentModal'
import { AdminButton } from '@/shared/ui/AdminButton'
import { useRealtimeApts } from '@/shared/hooks/useRealtimeApts'
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

function PanZoomPane({ src, alt, overlay, aptByAddress, onSelect, ready }) {
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
                    'rgba(120,120,120,0.35)'
                  const hoverColor =
                    status === 'EMPTY'    ? 'rgba(22,163,74,0.75)'   :
                    status === 'RESERVED' ? 'rgba(202,138,4,0.85)'   :
                    status === 'SOLD'     ? 'rgba(220,38,38,0.82)'   :
                    'rgba(70,70,70,0.65)'
                  const strokeColor =
                    status === 'EMPTY'    ? '#15803d' :
                    status === 'RESERVED' ? '#854d0e' :
                    status === 'SOLD'     ? '#b91c1c' :
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
  const [modal, setModal] = useState(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const activeFloor = parseInt(searchParams.get('floor') ?? '1') === 2 ? 2 : 1
  const setActiveFloor = (f) => setSearchParams({ floor: f }, { replace: true })
  useRealtimeApts()

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

  const hasFloor2 = !!img2

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
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
            { color: 'bg-green-500',  label: "Bo'sh",    key: 'EMPTY'    },
            { color: 'bg-yellow-400', label: 'Bron',     key: 'RESERVED' },
            { color: 'bg-red-500',    label: 'Sotilgan', key: 'SOLD'     },
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
                {(stats.EMPTY ?? 0) + (stats.RESERVED ?? 0) + (stats.SOLD ?? 0)}
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
          onSelect={(apt) => setModal({ apartment: apt, floor: activeFloor })}
          ready={ready}
        />
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
    </div>
  )
}
