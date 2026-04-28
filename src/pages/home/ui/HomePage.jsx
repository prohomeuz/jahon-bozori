import GENPLAN from '@/assets/genplan.webp'
import { useRef, useState } from 'react'
import { imgCache } from '@/shared/lib/imgCache'
import { useNavigate } from 'react-router'
import { usePan } from '../lib/usePan'
import { useGlobalZoom } from '@/shared/hooks/useGlobalZoom'
import { useGestureGuard } from '@/shared/hooks/useGestureGuard'
import { AdminButton } from '@/shared/ui/AdminButton'
import { useBlockedState } from '@/shared/hooks/useBlockedState'
import { BlockedOverlay } from '@/shared/ui/BlockedOverlay'

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
  const [imgLoaded, setImgLoaded] = useState(() => imgCache.has(GENPLAN))
  const navigate = useNavigate()
  const isBlocked = useBlockedState()

  const { scale } = useGlobalZoom(containerRef)
  const { pos } = usePan(containerRef)
  const gesturedRef = useGestureGuard(containerRef)

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-black"
      style={{ touchAction: 'none', cursor: 'grab' }}
    >
      {isBlocked && <BlockedOverlay />}
      <div className="fixed top-6 right-6 z-10">
        <AdminButton />
      </div>

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
          fetchPriority="high"
          onLoad={() => { imgCache.add(GENPLAN); setImgLoaded(true) }}
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
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={10}
                strokeLinejoin="round"
                pointerEvents="none"
              />
              <polygon
                points={block.points}
                fill="black"
                stroke="rgba(0,0,0,0.75)"
                strokeOpacity={1}
                strokeWidth={2}
                strokeLinejoin="round"
                className="block-pulse"
                style={{ cursor: 'pointer', animationDelay: block.delay }}
                onClick={() => { if (!gesturedRef.current) navigate(`/block/${block.id}`) }}
              />
              <circle
                cx={block.textX}
                cy={block.textY}
                r={152}
                fill="none"
                stroke="white"
                strokeWidth={10}
                opacity={0.9}
                pointerEvents="none"
              />
              <circle
                cx={block.textX}
                cy={block.textY}
                r={138}
                fill="rgba(0,0,0,0.82)"
                pointerEvents="none"
              />
              <text
                x={block.textX}
                y={block.textY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={120}
                fontWeight="bold"
                fontFamily="ui-monospace, monospace"
                fill="white"
                pointerEvents="none"
              >
                {block.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
