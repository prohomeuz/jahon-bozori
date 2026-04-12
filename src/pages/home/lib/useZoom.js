import { useState, useRef, useCallback, useEffect } from 'react'

const STEP = 0.18
const LERP = 0.07

export function useZoom(containerRef, { initialScale = 1, onSettle } = {}) {
  const scaleRef = useRef(initialScale)
  const targetRef = useRef(initialScale)
  const rafRef = useRef(null)
  const [scale, setScale] = useState(initialScale)

  const animateTo = useCallback((target) => {
    targetRef.current = Math.max(0.01, target)
    if (rafRef.current) return
    const tick = () => {
      const diff = targetRef.current - scaleRef.current
      if (Math.abs(diff) < 0.0005) {
        scaleRef.current = targetRef.current
        setScale(targetRef.current)
        rafRef.current = null
        onSettle?.(targetRef.current)
        return
      }
      scaleRef.current += diff * LERP
      setScale(scaleRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const zoomBy = useCallback((delta) => animateTo(targetRef.current + delta), [animateTo])
  const zoomIn = useCallback(() => zoomBy(STEP), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(-STEP), [zoomBy])

  // Wheel
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? STEP : -STEP
      zoomBy(delta * (e.ctrlKey ? 0.4 : 1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef, zoomBy])

  // Pinch
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let lastDist = null
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onMove = (e) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const d = dist(e.touches)
      if (lastDist !== null) zoomBy((d - lastDist) * 0.003)
      lastDist = d
    }
    const onEnd = () => { lastDist = null }
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    return () => {
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [containerRef, zoomBy])

  return { scale, zoomIn, zoomOut }
}
