import ABLOK from '@/assets/blocks/A-BLOK.png'
import BBLOK from '@/assets/blocks/B-BLOK.png'
import CBLOK from '@/assets/blocks/C-BLOK.png'
import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { usePan } from '@/pages/home/lib/usePan'
import { useZoom } from '@/pages/home/lib/useZoom'
import { Joystick } from '@/pages/home/ui/Joystick'
import { ZoomControls } from '@/pages/home/ui/ZoomControls'
import { BLOCK_BUILDINGS, BLOCK_VIEW_BOX } from '../config/buildings'
import { imgCache } from '@/shared/lib/imgCache'

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

  const { scale, zoomIn, zoomOut } = useZoom(containerRef)
  const { pos, applyDelta } = usePan(containerRef)
  const onJoystickMove = useCallback((dx, dy) => applyDelta(-dx, -dy), [applyDelta])

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
          {buildings.map((b) => (
            <g key={b.id}>
              <polygon
                points={b.points}
                fill={hovered === b.id ? 'rgba(255,255,255,0.15)' : 'rgba(10,10,15,0.75)'}
                stroke="rgba(30,30,30,0.7)"
                strokeWidth={6}
                className="block-pulse"
                style={{ cursor: 'pointer', animationDelay: b.delay }}
                onMouseEnter={() => setHovered(b.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => navigate(`/block/${blockId}/bolim/${parseInt(b.label)}`)}
              />
              {[6, 5, 4, 3, 2, 1].map((d) => (
                <text
                  key={d}
                  x={b.textX + d * 0.3}
                  y={b.textY + d * 0.3}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={28}
                  fontWeight="bold"
                  fill={`rgba(0,0,0,${0.45 - d * 0.05})`}
                  pointerEvents="none"
                >
                  {b.label.toUpperCase()}
                </text>
              ))}
              <text
                x={b.textX}
                y={b.textY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={28}
                fontWeight="bold"
                fill="white"
                stroke="rgba(0,0,0,0.55)"
                strokeWidth={5}
                strokeLinejoin="round"
                paintOrder="stroke"
                pointerEvents="none"
                style={{ filter: 'drop-shadow(0 0.5px 1.5px rgba(0,0,0,0.8))' }}
              >
                {b.label.toUpperCase()}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <button
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-10 flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium shadow-md hover:bg-accent transition-colors"
      >
        ← {meta.label}
      </button>

      <div className="fixed bottom-6 left-6 z-10">
        <Joystick onMove={onJoystickMove} />
      </div>

      <div className="fixed bottom-6 right-6 z-10">
        <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
      </div>
    </div>
  )
}
