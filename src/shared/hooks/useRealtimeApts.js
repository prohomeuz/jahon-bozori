import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getToken, getUser } from '@/shared/lib/auth'

async function requestNotificationPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.setValueAtTime(1100, t + 0.1)
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    osc.start(t)
    osc.stop(t + 0.4)
  } catch {}
}

// Fetch-based SSE — supports custom headers (ngrok, auth, etc.)
async function connectSSE(token, onEvent, signal) {
  try {
    const res = await fetch(`/api/events?token=${token}`, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal,
    })
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
        const dataLine = part.match(/^data: (.+)/m)
        if (dataLine) {
          onEvent(eventLine?.[1] ?? 'message', dataLine[1])
        }
      }
    }
  } catch {}
}

export function useRealtimeApts() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (getUser()?.role === 'admin') requestNotificationPermission()
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) return

    const controller = new AbortController()
    let stopped = false

    function onEvent(event, rawData) {
      if (event === 'apartment') {
        const { id, status } = JSON.parse(rawData)
        const [block, bolimStr] = id.split('-')
        const bolim = parseInt(bolimStr)
        for (const floor of [1, 2]) {
          queryClient.setQueryData(['apartments', block, bolim, floor], (old) => {
            if (!old) return old
            return old.map((apt) => apt.address === id ? { ...apt, status } : apt)
          })
        }
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['bolim-stats', block] })
      }

      if (event === 'booking') {
        const { id, apartment_id, type, ism, familiya, manager, cancelled } = JSON.parse(rawData)
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })

        const user = getUser()
        if (user?.role !== 'admin' || cancelled) return
        if (Notification.permission !== 'granted') return

        playNotificationSound()
        const n = new Notification(`${type}: ${apartment_id}`, {
          body: `${ism} ${familiya}${manager ? ` — ${manager}` : ''}`,
          icon: '/favicon.ico',
          tag: 'booking',
          renotify: true,
        })
        n.onclick = () => {
          window.focus()
          window.dispatchEvent(new CustomEvent('flash-booking', { detail: { id } }))
          n.close()
        }
        setTimeout(() => n.close(), 6000)
      }
    }

    async function loop() {
      while (!stopped) {
        await connectSSE(token, onEvent, controller.signal)
        if (!stopped) await new Promise(r => setTimeout(r, 3000)) // reconnect after 3s
      }
    }

    loop()

    return () => {
      stopped = true
      controller.abort()
    }
  }, [queryClient])
}
