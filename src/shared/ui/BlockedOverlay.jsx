import { useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'

export function BlockedOverlay() {
  const cardRef = useRef(null)
  const overlayRef = useRef(null)

  useEffect(() => { overlayRef.current?.focus() }, [])

  function handleInteract(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!cardRef.current) return
    cardRef.current.animate([
      { transform: 'translateX(0) scale(1)' },
      { transform: 'translateX(-9px) scale(1.01)' },
      { transform: 'translateX(9px) scale(1.01)' },
      { transform: 'translateX(-6px) scale(1)' },
      { transform: 'translateX(6px) scale(1)' },
      { transform: 'translateX(-3px) scale(1)' },
      { transform: 'translateX(0) scale(1)' },
    ], { duration: 380, easing: 'ease-in-out', composite: 'replace' })
  }

  return (
    <div
      ref={overlayRef}
      tabIndex={0}
      className="blocked-overlay fixed inset-0 z-[200] flex items-center justify-center outline-none"
      style={{ backgroundColor: 'rgba(0,0,0,0.12)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      onPointerDown={handleInteract}
      onKeyDown={e => e.preventDefault()}
    >
      <div ref={cardRef} className="blocked-card bg-background border border-border rounded-3xl shadow-2xl px-10 py-9 flex flex-col items-center gap-6 max-w-[300px] mx-4 text-center select-none">
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-muted animate-ping opacity-60" style={{ animationDuration: '2.2s' }} />
          <div className="relative w-16 h-16 rounded-2xl bg-muted flex items-center justify-center shadow-sm">
            <Lock size={28} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-bold text-foreground">Hisobingiz to'xtatildi</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Admin sizni faollashtirsa,<br />keyin tizimga kirasiz
          </p>
        </div>
      </div>
    </div>
  )
}
