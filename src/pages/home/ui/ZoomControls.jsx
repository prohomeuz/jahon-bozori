import { useCallback, useRef } from 'react'

function HoldButton({ onAction, className, children, 'aria-label': ariaLabel }) {
  const intervalRef = useRef(null)

  const start = useCallback(() => {
    onAction()
    intervalRef.current = setInterval(onAction, 120)
  }, [onAction])

  const stop = useCallback(() => {
    clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  return (
    <button
      className={className}
      aria-label={ariaLabel}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {children}
    </button>
  )
}

export function ZoomControls({ onZoomIn, onZoomOut }) {
  const btnClass =
    'h-12 w-12 rounded-full bg-primary text-primary-foreground text-xl font-medium ' +
    'hover:opacity-90 active:scale-95 ' +
    'transition-all flex items-center justify-center select-none shadow-md'

  return (
    <div className="flex flex-col items-center gap-2">
      <HoldButton onAction={onZoomIn} className={btnClass} aria-label="Yaqinlashtirish">+</HoldButton>
      <HoldButton onAction={onZoomOut} className={btnClass} aria-label="Uzoqlashtirish">−</HoldButton>
    </div>
  )
}
