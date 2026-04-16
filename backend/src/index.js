import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { db, q } from './db.js'
import { hashPassword, verifyPassword, createToken, requireAuth, requireAdmin } from './auth.js'
import nodeFetch from 'node-fetch'
import { SocksProxyAgent } from 'socks-proxy-agent'
const _socksAgent = process.env.SOCKS_PROXY ? new SocksProxyAgent(process.env.SOCKS_PROXY) : null
// Faqat Telegram uchun proxy (geo-block) — UzbekVoice va OpenAI to'g'ridan ishlaydi
const proxiedFetch = (url, opts = {}) =>
  _socksAgent ? nodeFetch(url, { ...opts, agent: _socksAgent }) : fetch(url, opts)
const directFetch = (url, opts = {}) => fetch(url, opts)

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
    q.upsertSubscriber.run({ chat_id: String(chatId), first_name: firstName })
    await proxiedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Tizimga xush kelibsiz, <b>${firstName}</b>!\n\nEndi siz barcha shartnomalardan xabardor bo'lasiz.`,
        parse_mode: 'HTML',
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

// Barcha auth userlar uchun: managerlar ro'yxati (bron assign uchun)
app.get('/api/managers', requireAuth, (c) => {
  return c.json(q.allUsers.all())
})

app.post('/api/users', requireAuth, requireAdmin, async (c) => {
  const { username, password, name } = await c.req.json()
  if (!username || !password || !name) return c.json({ error: 'username, password, name majburiy' }, 400)
  try {
    q.insertUser.run({ username, password: hashPassword(password), role: 'salesmanager', name, telegram_id: null })
    return c.json({ ok: true }, 201)
  } catch (e) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'Bu username band' }, 409)
    return c.json({ error: e.message }, 500)
  }
})

app.patch('/api/users/:id', requireAuth, requireAdmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const { name, username, password } = await c.req.json()
  if (!name || !username) return c.json({ error: 'name va username majburiy' }, 400)
  try {
    if (password) {
      db.prepare('UPDATE users SET name=?, username=?, password=? WHERE id=?').run(name, username, hashPassword(password), id)
    } else {
      db.prepare('UPDATE users SET name=?, username=? WHERE id=?').run(name, username, id)
    }
    return c.json({ ok: true })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'Bu username band' }, 409)
    return c.json({ error: e.message }, 500)
  }
})

app.delete('/api/users/:id', requireAuth, requireAdmin, (c) => {
  const id = parseInt(c.req.param('id'))
  db.prepare('UPDATE bookings SET user_id=NULL WHERE user_id=?').run(id)
  db.prepare("DELETE FROM users WHERE id=? AND role='salesmanager'").run(id)
  return c.json({ ok: true })
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
  const { apartment_id, type, ism, familiya, boshlangich, oylar, umumiy, passport, manzil, phone, passport_place, narx_m2, assigned_user_id } = await c.req.json()
  if (!apartment_id || !type || !ism || !familiya || !boshlangich || !oylar)
    return c.json({ error: "Majburiy maydonlar to'ldirilmagan" }, 400)

  const effective_user_id = assigned_user_id ? parseInt(assigned_user_id) : user.sub

  db.exec('BEGIN')
  try {
    q.insertBooking.run({ apartment_id, user_id: effective_user_id, type, ism, familiya, boshlangich, oylar: parseInt(oylar), umumiy: umumiy ?? null, passport: passport ?? null, manzil: manzil ?? null, phone: phone ?? null, passport_place: passport_place ?? null, narx_m2: narx_m2 ?? null })
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

  // Barcha chat_idlar: managers + admin + subscribers
  const sent = new Set()

  for (const manager of q.allUsers.all()) {
    if (manager.telegram_id && !sent.has(manager.telegram_id)) {
      await sendDoc(manager.telegram_id)
      sent.add(manager.telegram_id)
    }
  }

  if (adminTgId && !sent.has(String(adminTgId))) {
    await sendDoc(String(adminTgId))
    sent.add(String(adminTgId))
  }

  for (const sub of q.allSubscribers.all()) {
    if (!sent.has(sub.chat_id)) {
      await sendDoc(sub.chat_id)
      sent.add(sub.chat_id)
    }
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
  console.log('[voice] request received, file:', file ? `type=${file.type} size=${file.size}` : 'NULL')
  if (!file) return c.json({ error: 'file required' }, 400)
  if (process.env.DEV_MOCK === 'true') {
    return c.json({ text: 'ismim Sardor, familiyam Toshmatov, telefon raqamim 90 123 45 67' })
  }
  const mime = file.type || 'audio/webm'
  const ext = mime.includes('mp4') || mime.includes('aac') ? 'mp4'
    : mime.includes('ogg') ? 'ogg' : 'webm'
  // codec parametrini olib tashlaymiz — UzbekVoice 'audio/webm;codecs=opus' ni qayta ishlay olmaydi
  const cleanMime = mime.split(';')[0]
  const audioBuf = Buffer.from(await file.arrayBuffer())
  console.log('[voice] audioBuf size:', audioBuf.length, 'mime:', mime, 'ext:', ext)

  // nodeFetch bilan manual multipart — native fetch + FormData muammosidan xoli
  const boundary = '----UVBoundary' + Date.now()
  const CRLF = '\r\n'
  function field(name, value) {
    return Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`
    )
  }
  const fileHeader = Buffer.from(
    `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="voice.${ext}"${CRLF}Content-Type: ${cleanMime}${CRLF}${CRLF}`
  )
  const body = Buffer.concat([
    fileHeader, audioBuf, Buffer.from(CRLF),
    field('return_offsets', 'false'),
    field('run_diarization', 'false'),
    field('language', 'uz'),
    field('model', 'enhanced-stt'),
    field('blocking', 'true'),
    Buffer.from(`--${boundary}--${CRLF}`),
  ])

  try {
    const res = await nodeFetch('https://uzbekvoice.ai/api/v1/stt', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UV_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    })
    const raw = await res.text()
    console.log('[voice] status:', res.status, 'body:', raw.slice(0, 300))
    if (!res.ok) return c.json({ error: 'transcribe_failed', text: '' }, 503)
    let data
    try { data = JSON.parse(raw) } catch { return c.json({ error: 'transcribe_failed', text: '' }, 503) }
    const text = (data?.result?.text ?? data?.text ?? '').trim()
    return c.json({ text })
  } catch (e) {
    console.error('[voice] fetch error:', e.message, e.cause?.message ?? '')
    return c.json({ error: 'transcribe_failed', text: '' }, 503)
  }
})

app.post('/api/voice/extract', async (c) => {
  const { text } = await c.req.json()
  if (!text) return c.json({})
  if (process.env.DEV_MOCK === 'true') {
    return c.json({ ism: 'Sardor', familiya: 'Toshmatov', telefon: '901234567' })
  }
  const res = await directFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GPT_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Siz o'zbek tilida aytilgan ovozli matndan faqat 3 ta ma'lumot ajratuvchi yordamchisiz: ism, familiya, telefon raqam. Natijani JSON formatida qaytaring.

QOIDALAR:

1. TUZATISH: Agar inson "adashdim", "yo'q", "bunday emas", "ey bunday edi", "to'g'rilash", "xato" yoki shunga o'xshash so'zlar aytsa — o'sha maydon uchun OXIRGI aytilgan qiymatni qabul qil, avvalgisini butunlay e'tiborsiz qoldir.

2. ISM VA FAMILIYA: Istalgan tartibda aytilishi mumkin. Kontekstdan aniqlashga harakat qil. O'zbek ismlari va familiyalarini to'g'ri ajrat.

3. TELEFON RAQAM — quyidagi barcha formatlarni qabul qil:
   - "90 123 45 67" → "901234567"
   - "998 90 123 45 67" yoki "+998 90 123 45 67" → "901234567"
   - "nol to'qson bir ikki uch..." (so'z bilan) → raqamga o'tkazib ajrat
   - Avval operator kodi keyin raqam YOKI avval raqam keyin kod — ikkalasi ham to'g'ri
   - Natijada faqat 9 ta raqam qaytar (998 prefikssiz), masalan: "901234567"

4. FAQAT uchta kalit qaytargin: ism, familiya, telefon
   - Topilmagan maydon uchun null qaytar
   - Boshqa hech qanday ma'lumot (pul, muddat, manzil va h.k.) qabul qilma

Misol kirish: "ismim Abdulloh, familiyam Karimov, telefon raqamim 90 123 45 67"
Misol chiqish: {"ism": "Abdulloh", "familiya": "Karimov", "telefon": "901234567"}

Misol kirish: "Telefon 998901234567, Karimov Abdulloh"
Misol chiqish: {"ism": "Abdulloh", "familiya": "Karimov", "telefon": "901234567"}

Misol kirish: "ismim Jasur, adashdim, Sardor Toshmatov, raqam 93 456 78 90"
Misol chiqish: {"ism": "Sardor", "familiya": "Toshmatov", "telefon": "934567890"}`,
        },
        { role: 'user', content: String(text) },
      ],
    }),
  })
  let data
  try { data = await res.json() } catch { return c.json({}) }
  try { return c.json(JSON.parse(data.choices[0].message.content)) }
  catch { return c.json({}) }
})

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ ok: true }))

const port = parseInt(process.env.PORT ?? '3001')
serve({ fetch: app.fetch, port })
console.log(`Backend: http://localhost:${port}`)
