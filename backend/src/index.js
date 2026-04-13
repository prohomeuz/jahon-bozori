import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { db, q } from './db.js'
import { hashPassword, verifyPassword, createToken, requireAuth, requireAdmin } from './auth.js'
import nodeFetch from 'node-fetch'
const proxiedFetch = (url, opts = {}) => nodeFetch(url, opts)

const app = new Hono()
app.use('/api/*', cors())

// ─── TELEGRAM WEBHOOK ────────────────────────────────────────────────────────
app.post('/api/telegram/webhook', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const message = body.message
  if (!message) return c.json({ ok: true })

  const chatId = message.chat.id
  const telegramId = message.from?.id
  const firstName = message.from?.first_name ?? 'Foydalanuvchi'
  const text = message.text ?? ''
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return c.json({ ok: true })

  if (text === '/start') {
    await proxiedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Tizimga xush kelibsiz, <b>${firstName}</b>!\n\nSizning Telegram ID:\n<code>${telegramId}</code>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{
            text: '📋 ID nusxalash',
            copy_text: { text: String(telegramId) },
          }]],
        },
      }),
    }).catch(() => {})
  }

  return c.json({ ok: true })
})

// ─── TELEGRAM ────────────────────────────────────────────────────────────────
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return
  await proxiedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: 'HTML' }),
  }).catch(() => {})
}

// ─── SSE BROADCAST ───────────────────────────────────────────────────────────
const sseClients = new Set()

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const send of sseClients) send(msg)
}

app.get('/api/events', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const { verify } = await import('hono/jwt')
    await verify(token, process.env.JWT_SECRET, 'HS256')
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
  return new Response(
    new ReadableStream({
      start(controller) {
        const send = (msg) => controller.enqueue(new TextEncoder().encode(msg))
        sseClients.add(send)
        controller.enqueue(new TextEncoder().encode(': connected\n\n'))
        c.req.raw.signal.addEventListener('abort', () => {
          sseClients.delete(send)
          controller.close()
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
})

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json()
  const user = q.userByUsername.get({ username })
  if (!user || !verifyPassword(password, user.password))
    return c.json({ error: "Username yoki parol noto'g'ri" }, 401)
  const token = await createToken(user)
  return c.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } })
})

app.get('/api/auth/me', requireAuth, (c) => {
  const { sub: id, role, name } = c.get('user')
  const user = q.userById.get({ id })
  return c.json(user ?? { error: 'Not found' })
})

// ─── USERS (admin only) ───────────────────────────────────────────────────────

app.get('/api/users', requireAuth, requireAdmin, (c) => {
  return c.json(q.allUsers.all())
})

app.post('/api/users', requireAuth, requireAdmin, async (c) => {
  const { username, password, name, telegram_id } = await c.req.json()
  if (!username || !password || !name || !telegram_id) return c.json({ error: 'username, password, name, telegram_id majburiy' }, 400)
  try {
    q.insertUser.run({ username, password: hashPassword(password), role: 'salesmanager', name, telegram_id: telegram_id ? String(telegram_id) : null })
    return c.json({ ok: true }, 201)
  } catch (e) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'Bu username band' }, 409)
    return c.json({ error: e.message }, 500)
  }
})

// ─── APARTMENTS ───────────────────────────────────────────────────────────────

app.get('/api/bolims', (c) => {
  const block = c.req.query('block')
  if (!block) return c.json({ error: 'block required' }, 400)
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return c.json(q.bolims.all({ block }).map(r => r.bolim))
})

app.get('/api/apartments/stats', (c) => {
  const block = c.req.query('block')
  if (!block) return c.json({ error: 'block required' }, 400)
  const bolim = c.req.query('bolim')
  const rows = bolim
    ? q.bolimStats.all({ block, bolim: parseInt(bolim) })
    : q.blockStats.all({ block })
  const result = { EMPTY: 0, RESERVED: 0, SOLD: 0 }
  rows.forEach(r => { result[r.status] = r.n })
  c.header('Cache-Control', 'public, max-age=5, stale-while-revalidate=30')
  return c.json(result)
})

app.get('/api/apartments', (c) => {
  const block = c.req.query('block')
  const bolim = parseInt(c.req.query('bolim'))
  const floor = parseInt(c.req.query('floor'))
  if (!block || isNaN(bolim) || isNaN(floor)) return c.json({ error: 'block, bolim, floor required' }, 400)
  return c.json(q.apartments.all({ block, bolim, floor }))
})

app.patch('/api/apartments/:id/status', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  if (!['EMPTY', 'RESERVED', 'SOLD'].includes(status)) return c.json({ error: "Status: EMPTY | RESERVED | SOLD" }, 400)
  q.updateStatus.run({ status, id })
  if (status === 'EMPTY') q.cancelBooking.run({ apartment_id: id })
  broadcast('apartment', { id, status })
  broadcast('booking', { cancelled: true })
  return c.json({ ok: true })
})

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────

app.post('/api/bookings', requireAuth, async (c) => {
  const user = c.get('user')
  const { apartment_id, type, ism, familiya, boshlangich, oylar, umumiy, passport, manzil, phone, passport_place } = await c.req.json()
  if (!apartment_id || !type || !ism || !familiya || !boshlangich || !oylar)
    return c.json({ error: "Majburiy maydonlar to'ldirilmagan" }, 400)

  db.exec('BEGIN')
  try {
    q.insertBooking.run({ apartment_id, user_id: user.sub, type, ism, familiya, boshlangich, oylar: parseInt(oylar), umumiy: umumiy ?? null, passport: passport ?? null, manzil: manzil ?? null, phone: phone ?? null, passport_place: passport_place ?? null })
    const newStatus = type === 'sotish' ? 'SOLD' : 'RESERVED'
    q.updateStatus.run({ status: newStatus, id: apartment_id })
    const booking = q.lastBooking.get()
    db.exec('COMMIT')
    broadcast('apartment', { id: apartment_id, status: newStatus })
    broadcast('booking', {
      id: booking.id,
      apartment_id,
      type: type === 'sotish' ? 'Sotish' : 'Bron',
      ism: booking.ism,
      familiya: booking.familiya,
      manager: booking.manager_name ?? booking.username ?? '',
    })


    return c.json(booking, 201)
  } catch (e) {
    db.exec('ROLLBACK')
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/bookings', requireAuth, (c) => {
  const user = c.get('user')
  const limit = parseInt(c.req.query('limit') ?? '50')
  const offset = parseInt(c.req.query('offset') ?? '0')
  const cancelled = c.req.query('cancelled') === '1'
  if (user.role === 'admin') {
    return c.json(cancelled ? q.allCancelled.all({ limit, offset }) : q.allBookings.all({ limit, offset }))
  }
  return c.json(cancelled ? q.myCancelled.all({ user_id: user.sub, limit, offset }) : q.myBookings.all({ user_id: user.sub, limit, offset }))
})

app.get('/api/bookings/apartment/:id', requireAuth, (c) => {
  return c.json(q.aptBookings.all({ apartment_id: c.req.param('id') }))
})

app.post('/api/bookings/send-pdf', requireAuth, async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('pdf')
  const bookingId = parseInt(formData.get('booking_id'))
  if (!file || !bookingId) return c.json({ error: 'pdf va booking_id kerak' }, 400)

  const booking = q.bookingById.get({ id: bookingId })
  if (!booking) return c.json({ error: 'Topilmadi' }, 404)

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return c.json({ ok: true })

  const typeLabel = booking.type === 'sotish' ? '🔴 <b>Sotish</b>' : '🟡 <b>Bron</b>'
  const caption = `\n${typeLabel}\n\n` +
    `🏢 <b>Do'kon:</b> ${booking.apartment_id}\n\n` +
    `👤 <b>Mijoz:</b> ${booking.ism} ${booking.familiya}\n\n` +
    (booking.phone ? `📞 <b>Telefon:</b> ${booking.phone}\n\n` : '') +
    `💰 <b>Boshlang'ich:</b> ${booking.boshlangich}\n\n` +
    `📅 <b>Muddat:</b> ${booking.oylar} oy\n\n` +
    `👨‍💼 <b>Manager:</b> ${booking.manager_name ?? booking.username ?? ''}`

  const buffer = Buffer.from(await file.arrayBuffer())
  // Fayl nomi uzun bo'lsa Telegram bubble kengroq bo'ladi → caption sig'adi
  const filename = `${booking.ism} ${booking.familiya} - shartnoma-${booking.apartment_id}.pdf`
  const adminTgId = process.env.ADMIN_TELEGRAM_ID

  async function sendDoc(chatId) {
    const fd = new FormData()
    fd.append('chat_id', String(chatId))
    fd.append('document', new Blob([buffer], { type: 'application/pdf' }), filename)
    fd.append('caption', caption)
    fd.append('parse_mode', 'HTML')
    await proxiedFetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST', body: fd,
    }).catch(() => {})
  }

  // Barcha salesmanagerlar + admin ga yuborish
  const allManagers = q.allUsers.all()
  const sent = new Set()

  for (const manager of allManagers) {
    if (manager.telegram_id && !sent.has(manager.telegram_id)) {
      await sendDoc(manager.telegram_id)
      sent.add(manager.telegram_id)
    }
  }

  if (adminTgId && !sent.has(String(adminTgId))) {
    await sendDoc(adminTgId)
  }

  return c.json({ ok: true })
})

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

app.get('/api/dashboard', requireAuth, (c) => {
  const user = c.get('user')

  // Apartment stats by block
  const rows = q.statsAll.all()
  const blocks = {}
  const total = { SOLD: 0, RESERVED: 0, EMPTY: 0 }
  for (const row of rows) {
    if (!blocks[row.block]) blocks[row.block] = { SOLD: 0, RESERVED: 0, EMPTY: 0 }
    blocks[row.block][row.status] = row.n
    total[row.status] = (total[row.status] || 0) + row.n
  }

  if (user.role === 'admin') {
    const bookings = q.allBookings.all({ limit: 20, offset: 0 })
    const totalB = q.totalBookings.get()
    return c.json({ blocks, total, bookings, totalBookings: totalB.n })
  } else {
    const myStats = q.statsUser.all({ user_id: user.sub })
    const myTotal = q.bookingsCount.get({ user_id: user.sub })
    const bookings = q.myBookings.all({ user_id: user.sub, limit: 20, offset: 0 })
    const myStatsMap = Object.fromEntries(myStats.map(r => [r.type, r.n]))
    return c.json({ blocks, total, bookings, myStats: myStatsMap, totalBookings: myTotal.n })
  }
})

// ─── DETAILED STATS ───────────────────────────────────────────────────────────

app.get('/api/stats', requireAuth, (c) => {
  function pivot(rows, groupKey) {
    const map = {}
    for (const r of rows) {
      const key = r.block + '|' + r[groupKey]
      if (!map[key]) map[key] = { block: r.block, [groupKey]: r[groupKey], SOLD: 0, RESERVED: 0, EMPTY: 0 }
      map[key][r.status] = r.n
    }
    return Object.values(map)
  }
  return c.json({
    byBolim: pivot(q.statsByBolim.all(), 'bolim'),
    byFloor: pivot(q.statsByFloor.all(), 'floor'),
    byDate:  q.bookingsByDate.all(),
  })
})

app.get('/api/stats/managers', requireAuth, (c) => {
  const from = c.req.query('from') ?? ''
  const to   = c.req.query('to')   ?? ''
  return c.json(q.managerStats.all({ from, to }))
})

app.get('/api/stats/snapshot', requireAuth, (c) => {
  const block = c.req.query('block') ?? 'A'
  const date  = c.req.query('date')  ?? new Date().toISOString().slice(0, 10)
  const endDate = date + ' 23:59:59'
  const snap  = q.snapshotByBlock.get({ block, endDate })
  const total = q.totalByBlock.get({ block })?.n ?? 0
  const sold     = snap?.sold     ?? 0
  const reserved = snap?.reserved ?? 0
  return c.json({ sold, reserved, empty: total - sold - reserved, total, date, block })
})

// ─── VOICE PROXY ─────────────────────────────────────────────────────────────

app.post('/api/voice/transcribe', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!file) return c.json({ error: 'file required' }, 400)
  const fd = new FormData()
  fd.append('file', file, 'voice.webm')
  fd.append('enable_diarization', 'false')
  const res = await proxiedFetch('https://uzbekvoice.ai/api/v1/stt', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UV_KEY}` },
    body: fd,
  })
  const data = await res.json()
  return c.json({ text: (data?.result?.text ?? '').trim() })
})

app.post('/api/voice/extract', async (c) => {
  const { text } = await c.req.json()
  if (!text) return c.json({})
  const res = await proxiedFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GPT_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `O'zbek tilidagi matndan quyidagi ma'lumotlarni ajrat va JSON qaytar.\nQoidalar:\n- "ismim X", "ismi X", "X ismli" → ism: "X"\n- "familiyam X", "familiyasi X" → familiya: "X"\n- boshlangich: to'lov raqami, faqat raqamlar va bo'shliq "10 000 000"\n- oylar: necha oyga, faqat raqam string "24"\n- telefon: telefon raqami, xalqaro yoki mahalliy formatda, masalan "+998901234567" yoki "901234567"\n- Topilmasa bo'sh string\nJSON kalitlari: ism, familiya, boshlangich, oylar, telefon` },
        { role: 'user', content: String(text) },
      ],
    }),
  })
  const data = await res.json()
  try { return c.json(JSON.parse(data.choices[0].message.content)) }
  catch { return c.json({}) }
})

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ ok: true }))

const port = parseInt(process.env.PORT ?? '3001')
serve({ fetch: app.fetch, port })
console.log(`Backend: http://localhost:${port}`)
