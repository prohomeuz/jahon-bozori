import GENPLAN from '@/assets/genplan.jpg'
import { useCallback, useRef, useState } from 'react'
import { imgCache } from '@/shared/lib/imgCache'
import { useNavigate } from 'react-router'
import { usePan } from '../lib/usePan'
import { useZoom } from '../lib/useZoom'
import { Joystick } from './Joystick'
import { ZoomControls } from './ZoomControls'

const BLOCKS = [
  {
    id: 'A',
    label: 'A-BLOK',
    points: '3081,2161 2935,2414 3004,2472 3811,2579 3928,2521 3996,2268',
    textX: 3459,
    textY: 2403,
    delay: '0s',
  },
  {
    id: 'B',
    label: 'B-BLOK',
    points: '4191,2287 5096,2394 5077,2686 4970,2735 4172,2628 4094,2531',
    textX: 4600,
    textY: 2544,
    delay: '1.3s',
  },
  {
    id: 'C',
    label: 'C-BLOK',
    points: '5194,2414 5174,2706 5262,2774 6118,2891 6206,2842 6216,2774 6157,2521',
    textX: 5761,
    textY: 2703,
    delay: '2.6s',
  },
]

export default function HomePage() {
  const containerRef = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(() => imgCache.has('genplan'))
  const navigate = useNavigate()

  const { scale, zoomIn, zoomOut } = useZoom(containerRef)
  const { pos, applyDelta } = usePan(containerRef)

  const onJoystickMove = useCallback((dx, dy) => {
    applyDelta(-dx, -dy)
  }, [applyDelta])

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
          src={GENPLAN}
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
          onLoad={() => { imgCache.add('genplan'); setImgLoaded(true) }}
          style={{
            filter: imgLoaded ? 'blur(0px)' : 'blur(20px)',
            opacity: imgLoaded ? 1 : 0.4,
            transition: 'filter 0.6s ease, opacity 0.6s ease',
          }}
        />
        <svg
          viewBox="0 0 7000 3892"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
        >
          {BLOCKS.map((block) => (
            <g key={block.id}>
              <polygon
                points={block.points}
                fill="rgba(10,10,15,0.75)"
                stroke="rgba(30,30,30,0.7)"
                strokeWidth={14}
                className="block-pulse"
                style={{ cursor: 'pointer', animationDelay: block.delay }}
                onClick={() => navigate(`/block/${block.id}`)}
              />

              {[6, 5, 4, 3, 2, 1].map((d) => (
                <text
                  key={d}
                  x={block.textX + d * 1.2}
                  y={block.textY + d * 1.2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={116}
                  fontWeight="bold"
                  fill={`rgba(0,0,0,${0.45 - d * 0.05})`}
                  pointerEvents="none"
                >
                  {block.label}
                </text>
              ))}

              <text
                x={block.textX}
                y={block.textY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={116}
                fontWeight="bold"
                fill="white"
                stroke="rgba(0,0,0,0.55)"
                strokeWidth={20}
                strokeLinejoin="round"
                paintOrder="stroke"
                pointerEvents="none"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}
              >
                {block.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="fixed bottom-6 left-6 z-10">
        <Joystick onMove={onJoystickMove} />
      </div>

      <div className="fixed bottom-6 right-6 z-10">
        <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
      </div>
    </div>
  )
}
