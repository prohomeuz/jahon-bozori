import { useState, useRef, useCallback, useEffect } from 'react'

export function usePan(containerRef) {
  const posRef = useRef({ x: 0, y: 0 })
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPt = useRef(null)

  const applyDelta = useCallback((dx, dy) => {
    posRef.current = { x: posRef.current.x + dx, y: posRef.current.y + dy }
    setPos({ ...posRef.current })
  }, [])

  // Mouse drag
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onDown = (e) => {
      if (e.button !== 0) return
      dragging.current = true
      lastPt.current = { x: e.clientX, y: e.clientY }
      el.style.cursor = 'grabbing'
    }
    const onMove = (e) => {
      if (!dragging.current || !lastPt.current) return
      applyDelta(e.clientX - lastPt.current.x, e.clientY - lastPt.current.y)
      lastPt.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => {
      dragging.current = false
      lastPt.current = null
      el.style.cursor = ''
    }

    el.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [containerRef, applyDelta])

  // Single-touch drag (two-finger handled by useZoom)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onStart = (e) => {
      if (e.touches.length !== 1) return
      lastPt.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onMove = (e) => {
      if (e.touches.length !== 1 || !lastPt.current) return
      e.preventDefault()
      applyDelta(
        e.touches[0].clientX - lastPt.current.x,
        e.touches[0].clientY - lastPt.current.y,
      )
      lastPt.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onEnd = () => { lastPt.current = null }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [containerRef, applyDelta])

  return { pos, applyDelta }
}