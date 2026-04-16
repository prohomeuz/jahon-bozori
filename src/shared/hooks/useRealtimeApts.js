import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getToken } from '@/shared/lib/auth'

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
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
