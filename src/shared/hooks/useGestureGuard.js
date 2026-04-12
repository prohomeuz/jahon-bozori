import { useRef, useEffect } from 'react'

/**
 * Mouse drag yoki pinch/pan gesture bo'lsa keyingi click eventni bloklaydi.
 * gesturedRef.current === true bo'lsa navigatsiya qilinmasin.
 */
export function useGestureGuard(containerRef) {
  const gesturedRef = useRef(false)
  const startPt = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // --- Mouse ---
    const onMouseDown = (e) => {
      if (e.button !== 0) return
      startPt.current = { x: e.clientX, y: e.clientY }
      gesturedRef.current = false
    }
    const onMouseMove = (e) => {
      if (!startPt.current) return
      const dx = e.clientX - startPt.current.x
      const dy = e.clientY - startPt.current.y
      if (Math.hypot(dx, dy) > 4) gesturedRef.current = true
    }
    const onMouseUp = () => {
      startPt.current = null
    }

    // --- Touch ---
    const onTouchStart = (e) => {
      if (e.touches.length >= 2) {
        gesturedRef.current = true
      } else {
        startPt.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }
    const onTouchMove = (e) => {
      if (e.touches.length >= 2) {
        gesturedRef.current = true
      } else if (e.touches.length === 1 && startPt.current) {
        const dx = e.touches[0].clientX - startPt.current.x
        const dy = e.touches[0].clientY - startPt.current.y
        if (Math.hypot(dx, dy) > 6) gesturedRef.current = true
      }
    }
    const onTouchEnd = () => {
      startPt.current = null
      setTimeout(() => { gesturedRef.current = false }, 350)
    }

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [containerRef])

  return gesturedRef
}
