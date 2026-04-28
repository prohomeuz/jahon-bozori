import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { getUser, getToken, apiFetch, removeToken } from '@/shared/lib/auth'

const SS_KEY = 'sm_blocked'

function readSession() {
  try { return sessionStorage.getItem(SS_KEY) === '1' } catch { return false }
}
function writeSession(v) {
  try { sessionStorage.setItem(SS_KEY, v ? '1' : '0') } catch {}
}

async function connectSSE(token, onEvent, signal) {
  try {
    const res = await fetch(`/api/events?token=${token}`, { signal })
    if (!res.ok || !res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop()
      for (const part of parts) {
        const eventLine = part.match(/^event: (.+)/m)
        const dataLine  = part.match(/^data: (.+)/m)
        if (dataLine) onEvent(eventLine?.[1] ?? 'message', dataLine[1])
      }
    }
  } catch {}
}

// useRealtimeApts bor sahifalarda u window event dispatch qiladi — useBlockedState uni tinglaydi
// useRealtimeApts yo'q sahifalarda (HomePage, BlockPage) useBlockedState o'z SSE'sini ochadi
export function useBlockedState({ hasRealtimeApts = false } = {}) {
  const user = getUser()
  const navigate = useNavigate()
  // Bug 4: sessionStorage'dan boshlang'ich holat — F5 da flash yo'q
  const [isBlocked, setIsBlocked] = useState(() => user && user.role !== 'admin' ? readSession() : false)

  // Bug 5: alive flag — unmount bo'lsa state o'zgartirilmaydi
  useEffect(() => {
    if (!user || user.role === 'admin') return
    let alive = true
    apiFetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!alive) return
      const blocked = data?.is_active === 0
      setIsBlocked(blocked)
      writeSession(blocked)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  // Bug 2: handled guard — double-dispatch'da navigate ikki marta chaqirilmaydi
  useEffect(() => {
    if (!user || user.role === 'admin') return
    let handled = false
    function onInvalidated(e) {
      const { id, blocked } = e.detail ?? {}
      if (id !== user.sub) return
      if (blocked === true) {
        setIsBlocked(true)
        writeSession(true)
      } else if (blocked === false && !handled) {
        handled = true
        writeSession(false)
        removeToken()
        navigate('/admin/login', { replace: true })
      }
    }
    window.addEventListener('user-invalidated', onInvalidated)
    return () => { window.removeEventListener('user-invalidated', onInvalidated); handled = true }
  }, [])

  // useRealtimeApts yo'q sahifalarda o'z SSE connection'i
  useEffect(() => {
    if (hasRealtimeApts || !user || user.role === 'admin') return
    const token = getToken()
    if (!token) return

    let stopped = false
    const controller = new AbortController()

    function onEvent(event, raw) {
      if (event !== 'user_invalidated') return
      const detail = JSON.parse(raw)
      window.dispatchEvent(new CustomEvent('user-invalidated', { detail }))
    }

    async function loop() {
      while (!stopped) {
        await connectSSE(token, onEvent, controller.signal)
        if (!stopped) await new Promise(r => setTimeout(r, 3000))
      }
    }
    loop()
    return () => { stopped = true; controller.abort() }
  }, [hasRealtimeApts])

  // Bloklangan paytda brauzer back/forward bloklanadi
  useEffect(() => {
    if (!isBlocked) return
    window.history.pushState(null, '', window.location.href)
    function onPopState() {
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isBlocked])

  return isBlocked
}
