import { useState, useRef, useCallback } from 'react'
import { useZoom } from '@/shared/hooks/useZoom'
import { usePan } from '../lib/usePan'
import { Joystick } from './Joystick'
import { ZoomControls } from './ZoomControls'

export function BlockViewer({ image, label, onBack }) {
  const containerRef = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  const { scale, zoomIn, zoomOut } = useZoom(containerRef)
  const { pos, applyDelta } = usePan(containerRef)

  const onJoystickMove = useCallback((dx, dy) => {
    applyDelta(-dx, -dy)
  }, [applyDelta])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-black z-50"
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
          src={image}
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          style={{
            filter: imgLoaded ? 'blur(0px)' : 'blur(20px)',
            opacity: imgLoaded ? 1 : 0.4,
            transition: 'filter 0.6s ease, opacity 0.6s ease',
          }}
        />
      </div>

      {/* Back */}
      <button
        onClick={onBack}
        className="fixed top-6 left-6 z-10 flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium shadow-md hover:bg-accent transition-colors"
      >
        ← {label}
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
