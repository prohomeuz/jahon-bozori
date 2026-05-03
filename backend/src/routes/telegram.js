import { Hono } from 'hono'
import { q } from '../db.js'
import { sseClients, SSE_MAX_CLIENTS } from '../lib/sse.js'
import { proxiedFetch } from '../lib/telegram.js'

const app = new Hono()

// ─── WEBHOOK ─────────────────────────────────────────────────────────────────
// Mounted at /api — resolves to POST /api/telegram/webhook

app.post('/telegram/webhook', async (c) => {
  const body    = await c.req.json().catch(() => ({}))
  const message = body.message
  if (!message) return c.json({ ok: true })

  const chatId    = message.chat.id
  const firstName = message.from?.first_name ?? 'Foydalanuvchi'
  const text      = message.text ?? ''
  const token     = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return c.json({ ok: true })

  if (text === '/start') {
    q.upsertSubscriber.run({ chat_id: String(chatId), first_name: firstName })
    await proxiedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Tizimga xush kelibsiz, <b>${firstName}</b>!\n\nEndi siz barcha shartnomalardan xabardor bo'lasiz.`,
        parse_mode: 'HTML',
      }),
    }).catch(e => console.error('[webhook] sendMessage xato:', e?.message ?? e))
  }

  return c.json({ ok: true })
})

// ─── SSE (authenticated) — GET /api/events ───────────────────────────────────

app.get('/events', async (c) => {
  if (sseClients.size >= SSE_MAX_CLIENTS) return c.json({ error: 'Too many connections' }, 503)

  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : c.req.query('token')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const { verify } = await import('hono/jwt')
    await verify(token, process.env.JWT_SECRET, 'HS256')
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }

  return makeSseResponse(c)
})

// ─── PUBLIC SSE — GET /api/live/events ───────────────────────────────────────

app.get('/live/events', (c) => {
  if (sseClients.size >= SSE_MAX_CLIENTS) return c.json({ error: 'Too many connections' }, 503)
  return makeSseResponse(c)
})

function makeSseResponse(c) {
  return new Response(
    new ReadableStream({
      start(controller) {
        const enc  = new TextEncoder()
        const send = (msg) => {
          try { controller.enqueue(enc.encode(msg)) }
          catch { sseClients.delete(send) }
        }
        sseClients.add(send)
        try { controller.enqueue(enc.encode(': connected\n\n')) } catch {}
        c.req.raw.signal.addEventListener('abort', () => {
          sseClients.delete(send)
          try { controller.close() } catch {}
        })
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    }
  )
}

export default app
