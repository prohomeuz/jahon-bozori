import { useRef } from 'react'
import { useZoom } from '@/shared/hooks/useZoom'

const COOKIE_KEY = 'gz'

function readCookie() {
  const match = document.cookie.match(/(?:^|;\s*)gz=([^;]+)/)
  if (!match) return 1
  const v = parseFloat(match[1])
  return isNaN(v) ? 1 : Math.max(0.01, v)
}

function writeCookie(value) {
  document.cookie = `${COOKIE_KEY}=${value.toFixed(3)};path=/;max-age=31536000`
}

export function useGlobalZoom(containerRef) {
  const initialScale = useRef(readCookie()).current
  return useZoom(containerRef, {
    initialScale,
    onSettle: writeCookie,
  })
}
