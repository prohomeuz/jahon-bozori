import { useRef, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { usePan } from '@/pages/home/lib/usePan'
import { useZoom } from '@/pages/home/lib/useZoom'
import { FLOOR1_OVERLAYS } from '../config/floor1Overlays'
import { FLOOR2_OVERLAYS } from '../config/floor2Overlays'
import { B_FLOOR1_OVERLAYS } from '../config/bFloor1Overlays'
import { B_FLOOR2_OVERLAYS } from '../config/bFloor2Overlays'
import { C_FLOOR1_OVERLAYS } from '../config/cFloor1Overlays'
import { C_FLOOR2_OVERLAYS } from '../config/cFloor2Overlays'

const aImages1 = import.meta.glob('@/assets/blocks/A/1/*.jpg', { eager: true })
const aImages2 = import.meta.glob('@/assets/blocks/A/2/*.png', { eager: true })
const bImages1 = import.meta.glob('@/assets/blocks/B/1/*.png', { eager: true })
const bImages2 = import.meta.glob('@/assets/blocks/B/2/*.png', { eager: true })
const cImages1 = import.meta.glob('@/assets/blocks/C/1/*.jpg', { eager: true })
const cImages2 = import.meta.glob('@/assets/blocks/C/2/*.jpg', { eager: true })

function getImg(map, num) {
  const entry = Object.entries(map).find(([k]) => k.split('/').pop().split('.')[0] === String(num))
  return entry ? entry[1].default : null
}

const COLORS = [
  'rgba(255,120,120,0.45)',  // och qizil
  'rgba(120,210,120,0.45)',  // och yashil
]

function PanZoomPane({ src, alt, overlay }) {
  const ref = useRef(null)
  const { scale } = useZoom(ref)
  const { pos } = usePan(ref)
  const [hovered, setHovered] = useState(null)
  const [copied, setCopied] = useState(null)

  const polyColors = useMemo(() => {
    if (!overlay) return []
    return overlay.polygons.map((_, i) => COLORS[(i * 3 + Math.floor(i / 2)) % 2])
  }, [overlay])

  function handlePolyClick(p) {
    const color = p.color
    if (!color) return
    navigator.clipboard.writeText(color).then(() => {
      setCopied(color)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div
      ref={ref}
      className="relative flex-1 overflow-hidden bg-background"
      style={{ touchAction: 'none', cursor: 'grab' }}
    >
      {copied && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border text-sm font-mono shadow-md pointer-events-none">
          <span className="inline-block w-4 h-4 rounded-sm border border-border" style={{ background: copied }} />
          {copied} copied
        </div>
      )}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          willChange: 'transform',
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
              <svg
                viewBox={overlay.viewBox}
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                {overlay.polygons.map((p, i) => {
                  const fill = p.color
                    ? hovered === i ? p.color + 'cc' : p.color + '88'
                    : hovered === i ? polyColors[i].replace('0.45', '0.75') : polyColors[i]
                  return (
                    <polygon
                      key={i}
                      points={p.points}
                      fill={fill}
                      stroke="none"
                      style={{ cursor: p.color ? 'pointer' : 'default', animationDelay: p.delay }}
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => handlePolyClick(p)}
                    />
                  )
                })}
              </svg>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Rasm topilmadi</span>
        )}
      </div>
    </div>
  )
}

export default function BolimPage() {
  const { blockId, num } = useParams()
  const navigate = useNavigate()

  const bolimNum = parseInt(num)
  const [map1, map2] =
    blockId === 'B' ? [bImages1, bImages2] :
    blockId === 'C' ? [cImages1, cImages2] :
    [aImages1, aImages2]
  const img1 = getImg(map1, bolimNum)
  const img2 = getImg(map2, bolimNum)
  const [ovSrc1, ovSrc2] =
    blockId === 'B' ? [B_FLOOR1_OVERLAYS, B_FLOOR2_OVERLAYS] :
    blockId === 'C' ? [C_FLOOR1_OVERLAYS, C_FLOOR2_OVERLAYS] :
    [FLOOR1_OVERLAYS, FLOOR2_OVERLAYS]
  const overlay1 = ovSrc1.find(o => o.bolim === bolimNum) ?? null
  const overlay2 = ovSrc2.find(o => o.bolim === bolimNum) ?? null

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-background shrink-0">
        <button
          onClick={() => navigate(`/block/${blockId}`)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors"
        >
          ←
        </button>
        <span className="text-foreground font-semibold text-base">
          {blockId?.toUpperCase()}-BLOK — {bolimNum}-BO'LIM
        </span>
      </div>

      {/* Two halves */}
      <div className="flex flex-1 min-h-0">
        {/* 1-qavat */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-primary">
          <div className="px-4 py-3 text-sm font-semibold text-primary-foreground bg-primary tracking-widest uppercase select-none shrink-0">
            1-Qavat
          </div>
          <PanZoomPane src={img1} alt={`${bolimNum}-bo'lim 1-qavat`} overlay={overlay1} />
        </div>

        {/* 2-qavat */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="px-4 py-3 text-sm font-semibold text-primary-foreground bg-primary tracking-widest uppercase select-none shrink-0">
            2-Qavat
          </div>
          <PanZoomPane src={img2} alt={`${bolimNum}-bo'lim 2-qavat`} overlay={overlay2} />
        </div>
      </div>
    </div>
  )
}
