import { useRef, useState, useCallback } from 'react'

const BASE_R = 56
const THUMB_R = 20
const MAX_DIST = BASE_R - THUMB_R
const SPEED = 2.5

export function Joystick({ onMove }) {
  const baseRef = useRef(null)
  const activeRef = useRef(false)
  const rafRef = useRef(null)
  const dirRef = useRef({ x: 0, y: 0 })
  const [thumbPos, setThumbPos] = useState({ x: 0, y: 0 })
  const [isActive, setIsActive] = useState(false)

  const tick = useCallback(() => {
    const { x, y } = dirRef.current
    if (x !== 0 || y !== 0) onMove(x * SPEED, y * SPEED)
    rafRef.current = requestAnimationFrame(tick)
  }, [onMove])

  const stop = useCallback(() => {
    activeRef.current = false
    setIsActive(false)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    dirRef.current = { x: 0, y: 0 }
    setThumbPos({ x: 0, y: 0 })
  }, [])

  const move = useCallback((clientX, clientY) => {
    if (!baseRef.current) return
    const rect = baseRef.current.getBoundingClientRect()
    const dx = clientX - (rect.left + rect.width / 2)
    const dy = clientY - (rect.top + rect.height / 2)
    const dist = Math.hypot(dx, dy)
    const r = Math.min(dist, MAX_DIST)
    const angle = Math.atan2(dy, dx)
    const tx = Math.cos(angle) * r
    const ty = Math.sin(angle) * r
    setThumbPos({ x: tx, y: ty })
    dirRef.current = { x: tx / MAX_DIST, y: ty / MAX_DIST }
  }, [])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    baseRef.current.setPointerCapture(e.pointerId)
    activeRef.current = true
    setIsActive(true)
    move(e.clientX, e.clientY)
    rafRef.current = requestAnimationFrame(tick)
  }, [move, tick])

  const onPointerMove = useCallback((e) => {
    if (!activeRef.current) return
    e.preventDefault()
    move(e.clientX, e.clientY)
  }, [move])

  return (
    <div
      ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      className="bg-primary relative rounded-full cursor-pointer"
      style={{
        width: BASE_R * 2,
        height: BASE_R * 2,
        touchAction: 'none',
        userSelect: 'none',
        boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.35), inset 0 -1px 3px rgba(255,255,255,0.1), 0 6px 20px rgba(0,0,0,0.25)',
      }}
    >
      {/* PS-style grip dots */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const r = BASE_R * 0.62
        return (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none bg-primary-foreground/20"
            style={{
              width: 3, height: 3,
              left: BASE_R + Math.cos(angle) * r - 1.5,
              top:  BASE_R + Math.sin(angle) * r - 1.5,
            }}
          />
        )
      })}

      {/* Thumb */}
      <div
        className="absolute rounded-full pointer-events-none bg-primary-foreground/90"
        style={{
          width: THUMB_R * 2,
          height: THUMB_R * 2,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${thumbPos.x}px), calc(-50% + ${thumbPos.y}px))`,
          transition: isActive ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: isActive
            ? 'inset 0 3px 8px rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.3)'
            : 'inset 0 3px 8px rgba(0,0,0,0.2), 0 3px 8px rgba(0,0,0,0.25)',
        }}
      />
    </div>
  )
}
