import ABLOK from '@/assets/blocks/A-BLOK.webp'
import BBLOK from '@/assets/blocks/B-BLOK.webp'
import CBLOK from '@/assets/blocks/C-BLOK.webp'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { usePan } from '@/pages/home/lib/usePan'
import { useGlobalZoom } from '@/shared/hooks/useGlobalZoom'
import { useGestureGuard } from '@/shared/hooks/useGestureGuard'
import { BLOCK_BUILDINGS, BLOCK_VIEW_BOX } from '../config/buildings'
import { imgCache } from '@/shared/lib/imgCache'
import { AdminButton } from '@/shared/ui/AdminButton'

const BLOCK_META = {
  A: { label: 'A-BLOK', image: ABLOK },
  B: { label: 'B-BLOK', image: BBLOK },
  C: { label: 'C-BLOK', image: CBLOK },
}

export default function BlockPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const blockId = id?.toUpperCase()
  const [imgLoaded, setImgLoaded] = useState(() => imgCache.has(blockId))
  const [hovered, setHovered] = useState(null)

  const meta = BLOCK_META[blockId]
  const buildings = BLOCK_BUILDINGS[blockId] ?? []
  const viewBox = BLOCK_VIEW_BOX[blockId] ?? '0 0 1597 672'

  const { scale } = useGlobalZoom(containerRef)
  const { pos } = usePan(containerRef)
  const gesturedRef = useGestureGuard(containerRef)

  if (!meta) {
    navigate('/', { replace: true })
    return null
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-black"
      style={{ touchAction: 'none', cursor: 'grab' }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        <img
          src={meta.image}
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
          onLoad={() => { imgCache.add(blockId); setImgLoaded(true) }}
          style={{
            filter: imgLoaded ? 'blur(0px)' : 'blur(20px)',
            opacity: imgLoaded ? 1 : 0.4,
            transition: 'filter 0.6s ease, opacity 0.6s ease',
          }}
        />
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
        >

          {buildings.map((b) => {
            const num = parseInt(b.label)
            return (
              <g key={b.id}>
                {/* Oq tashqi stroke — natural building edge highlight */}
                <polygon
                  points={b.points}
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={4}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
                {/* Qora ichki stroke — ingichka, aniq chegara + fill animation */}
                <polygon
                  points={b.points}
                  fill={hovered === b.id ? 'white' : 'black'}
                  fillOpacity={hovered === b.id ? 0.08 : undefined}
                  stroke="rgba(0,0,0,0.75)"
                  strokeOpacity={1}
                  strokeWidth={1}
                  strokeLinejoin="round"
                  className={hovered === b.id ? '' : 'block-pulse'}
                  style={{ cursor: 'pointer', animationDelay: b.delay }}
                  onMouseEnter={() => setHovered(b.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => { if (!gesturedRef.current) navigate(`/block/${blockId}/bolim/${num}`) }}
                />
                <circle
                  cx={b.textX}
                  cy={b.textY}
                  r={22}
                  fill="rgba(0,0,0,0.55)"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
                <text
                  x={b.textX}
                  y={b.textY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={20}
                  fontWeight="bold"
                  fontFamily="ui-monospace, monospace"
                  fill="white"
                  pointerEvents="none"
                >
                  {num}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <button
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-10 flex items-center justify-center w-12 h-12 rounded-xl bg-black/80 text-white text-lg shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
      >
        ←
      </button>
      <div className="fixed top-6 right-6 z-10">
        <AdminButton />
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
        {['A', 'B', 'C'].map((id) => (
          <button
            key={id}
            onClick={() => navigate(`/block/${id}`)}
            className={`w-16 h-16 rounded-2xl text-xl font-bold shadow-xl transition-all active:scale-95
              ${blockId === id
                ? 'bg-white text-black scale-110 shadow-white/20'
                : 'bg-black/80 text-white backdrop-blur-sm'
              }`}
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  )
}
