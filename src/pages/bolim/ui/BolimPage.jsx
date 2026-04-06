import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { usePan } from '@/pages/home/lib/usePan'
import { useZoom } from '@/pages/home/lib/useZoom'
import { FLOOR1_OVERLAYS } from '../config/floor1Overlays'
import { FLOOR2_OVERLAYS } from '../config/floor2Overlays'
import { B_FLOOR1_OVERLAYS } from '../config/bFloor1Overlays'
import { B_FLOOR2_OVERLAYS } from '../config/bFloor2Overlays'
import { C_FLOOR1_OVERLAYS } from '../config/cFloor1Overlays'
import { C_FLOOR2_OVERLAYS } from '../config/cFloor2Overlays'
import BLOCKS_DATA from '../config/blocks'
import { ApartmentModal } from './ApartmentModal'

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


const STATUS_COLOR = {
  EMPTY:    { base: 'rgba(34,197,94,0.5)',  hover: 'rgba(34,197,94,0.8)'  },
  SOLD:     { base: 'rgba(239,68,68,0.5)',  hover: 'rgba(239,68,68,0.8)'  },
  RESERVED: { base: 'rgba(251,146,60,0.5)', hover: 'rgba(251,146,60,0.8)' },
}
const DEFAULT_COLOR = { base: 'rgba(148,163,184,0.4)', hover: 'rgba(148,163,184,0.7)' }

function PanZoomPane({ src, alt, overlay, apartments, onSelect }) {
  const ref = useRef(null)
  const { scale } = useZoom(ref)
  const { pos } = usePan(ref)
  const [hovered, setHovered] = useState(null)
  const [copied, setCopied] = useState(null)

  function handlePolyClick(p, i) {
    if (p.color) {
      navigator.clipboard.writeText(p.color).then(() => {
        setCopied(p.color)
        setTimeout(() => setCopied(null), 1500)
      })
    }
    onSelect?.(i)
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
            <img src={src} alt={alt} draggable={false} className="block max-w-full max-h-full object-contain select-none" />
            {overlay && (
              <svg viewBox={overlay.viewBox} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                {overlay.polygons.map((p, i) => {
                  const status = apartments?.[i]?.status
                  const colors = STATUS_COLOR[status] ?? DEFAULT_COLOR
                  const fill = hovered === i ? colors.hover : colors.base
                  return (
                    <polygon
                      key={i}
                      points={p.points}
                      fill={fill}
                      stroke="none"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => handlePolyClick(p, i)}
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
  const [modal, setModal] = useState(null)

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

  const apts1 = BLOCKS_DATA[blockId]?.['1-FLOOR']?.[bolimNum] ?? []
  const apts2 = BLOCKS_DATA[blockId]?.['2-FLOOR']?.[bolimNum] ?? []

  function handleSelect(floor) {
    return (index) => {
      const apt = (floor === 1 ? apts1 : apts2)[index]
      if (apt) setModal({ apartment: apt, floor })
    }
  }

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
        <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500/70 inline-block" />Bo'sh</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400/70 inline-block" />Bron</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500/70 inline-block" />Sotilgan</span>
        </div>
      </div>

      {/* Two halves */}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0 border-r border-primary">
          <div className="px-4 py-3 text-sm font-semibold text-primary-foreground bg-primary tracking-widest uppercase select-none shrink-0">
            1-Qavat
          </div>
          <PanZoomPane src={img1} alt={`${bolimNum}-bo'lim 1-qavat`} overlay={overlay1} apartments={apts1} onSelect={handleSelect(1)} />
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <div className="px-4 py-3 text-sm font-semibold text-primary-foreground bg-primary tracking-widest uppercase select-none shrink-0">
            2-Qavat
          </div>
          <PanZoomPane src={img2} alt={`${bolimNum}-bo'lim 2-qavat`} overlay={overlay2} apartments={apts2} onSelect={handleSelect(2)} />
        </div>
      </div>

      {modal && (
        <ApartmentModal
          apartment={modal.apartment}
          floor={modal.floor}
          blockId={blockId?.toUpperCase()}
          bolimNum={bolimNum}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
