import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { db, q, dbPath } from './db.js'
import { hashPassword, verifyPassword, createToken, requireAuth, requireAdmin } from './auth.js'
import nodeFetch from 'node-fetch'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { copyFileSync, unlinkSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as pathJoin } from 'node:path'
const _socksAgent = process.env.SOCKS_PROXY ? new SocksProxyAgent(process.env.SOCKS_PROXY, { maxSockets: 50 }) : null
// Faqat Telegram uchun proxy (geo-block) — UzbekVoice va OpenAI to'g'ridan ishlaydi
const proxiedFetch = (url, opts = {}, timeoutMs = 15_000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const finalOpts = { ...opts, signal: controller.signal }
  if (_socksAgent) finalOpts.agent = _socksAgent
  const fn = _socksAgent ? nodeFetch : fetch
  return fn(url, finalOpts).finally(() => clearTimeout(timer))
}

const app = new Hono()
app.use('/api/*', cors())

// ─── TELEGRAM WEBHOOK ────────────────────────────────────────────────────────
app.post('/api/telegram/webhook', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const message = body.message
  if (!message) return c.json({ ok: true })

  const chatId    = message.chat.id
  const firstName = message.from?.first_name ?? 'Foydalanuvchi'
  const text      = message.text ?? ''
  const token     = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return c.json({ ok: true })
  const cidStr    = String(chatId)

  if (text === '/start') {
    q.upsertSubscriber.run({ chat_id: cidStr, first_name: firstName })
    await proxiedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Tizimga xush kelibsiz, <b>${firstName}</b>!\n\nEndi siz barcha shartnomalardan xabardor bo'lasiz.`,
        parse_mode: 'HTML',
      }),
    }).catch(() => {})
    return c.json({ ok: true })
  }

  // "Backup keldi" xabarini reply qilib to'g'ri parol yozsa → faqat o'shanga backup
  if (/^\d{8}$/.test(text)) {
    const replyToId = message.reply_to_message?.message_id
    const savedIds = getBackupMsgIds()
    const isReplyToBackup = replyToId && savedIds.includes(replyToId)
    if (isReplyToBackup) {
      const admin = db.prepare("SELECT plain_password FROM users WHERE role='admin'").get()
      if (admin?.plain_password === text) {
        // Parolni o'chir
        await proxiedFetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: message.message_id }),
        }).catch(() => {})
        // Progress xabari
        let progressMsgId = null
        try {
          const pr = await proxiedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: String(chatId), text: '⏳ Backup tayyorlanmoqda...' }),
          })
          const pj = await pr.json()
          if (pj.ok) progressMsgId = pj.result.message_id
        } catch {}
        // Faqat shu odamga fayl yuborish
        sendBackupFile(chatId).then(ok => {
          if (!progressMsgId) return
          proxiedFetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: String(chatId),
              message_id: progressMsgId,
              text: ok ? '✅ Backup yuborildi' : '❌ Backup yuborishda xato',
            }),
          }).catch(() => {})
        }).catch(() => {})
      }
    }
    return c.json({ ok: true })
  }

  return c.json({ ok: true })
})

// ─── BACKUP ───────────────────────────────────────────────────────────────────

// Backup notification message_id larini saqlash (oxirgi 50 ta)
function getBackupMsgIds() {
  try {
    const row = db.prepare("SELECT value FROM backup_meta WHERE key='backup_msg_ids'").get()
    return row ? JSON.parse(row.value) : []
  } catch { return [] }
}
function saveBackupMsgIds(newIds) {
  const existing = getBackupMsgIds()
  const combined = [...existing, ...newIds]
  const trimmed = combined.slice(-50)
  db.prepare("INSERT OR REPLACE INTO backup_meta (key, value) VALUES ('backup_msg_ids', ?)").run(JSON.stringify(trimmed))
}

// Har daqiqa "Backup keldi" xabari barcha subscriberlarga + adminga yuboriladi
async function notifyBackupAll() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const adminChatId = process.env.ADMIN_TELEGRAM_ID
  if (!token) return

  const subscribers = q.allSubscribers.all()
  const targets = new Set()
  if (adminChatId) targets.add(String(adminChatId))
  for (const sub of subscribers) targets.add(sub.chat_id)

  console.log('[backup-notify] yuboriladi:', targets.size, 'ta chat')

  const results = await Promise.all([...targets].map(async (chatId) => {
    try {
      const res = await proxiedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: '🗄 Backup keldi' }),
      })
      const json = await res.json()
      if (json.ok) return json.result.message_id
      if (json.error_code === 403 || json.error_code === 400) {
        db.prepare('DELETE FROM telegram_subscribers WHERE chat_id=?').run(String(chatId))
        console.log('[backup-notify] subscriber o\'chirildi (bot blocked/invalid):', chatId)
      }
    } catch (e) { console.error('[backup-notify] xato:', e.message, 'chatId:', chatId) }
    return null
  }))
  // Bir vaqtda batch save — race condition yo'q
  const newIds = results.filter(Boolean)
  if (newIds.length > 0) saveBackupMsgIds(newIds)
}

// Cron: har 1 soatda
setInterval(() => { notifyBackupAll().catch(console.error) }, 60 * 60_000).unref()

// Faqat adminga SQLite faylni yuboradi
async function sendBackupFile(adminChatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !adminChatId) return false

  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  const tmpPath = pathJoin(tmpdir(), `jahon_backup_${Date.now()}.sqlite`)
  try { copyFileSync(dbPath, tmpPath) }
  catch (e) { console.error('[backup] copy xato:', e.message); return false }

  const uzbNow = new Date(Date.now() + 5 * 3600_000)
  const fname  = `jahon_${uzbNow.toISOString().slice(0,10)}_${String(uzbNow.getUTCHours()).padStart(2,'0')}00.sqlite`
  const fileData = readFileSync(tmpPath)
  try { unlinkSync(tmpPath) } catch {}

  const fd = new FormData()
  fd.append('chat_id',  String(adminChatId))
  fd.append('document', new Blob([fileData], { type: 'application/octet-stream' }), fname)
  try {
    const res  = await proxiedFetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { console.log('[backup] OK → admin:', adminChatId); return true }
    else { console.error('[backup] Telegram xato:', JSON.stringify(json)); return false }
  } catch (e) { console.error('[backup] fetch xato:', e.message); return false }
}

// ─── SSE BROADCAST ───────────────────────────────────────────────────────────
const sseClients = new Set()

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const send of sseClients) {
    try { send(msg) } catch { sseClients.delete(send) }
  }
}

// ─── RATE LIMITER ─────────────────────────────────────────────────────────────
const _rateMap = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of _rateMap) if (now > v.resetAt) _rateMap.delete(k)
}, 60_000).unref()

function rateLimit(key, max = 10, windowMs = 60_000) {
  const now = Date.now()
  let entry = _rateMap.get(key)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs }
    _rateMap.set(key, entry)
  }
  entry.count++
  return entry.count <= max
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
        const enc = new TextEncoder()
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
})

// ─── ADMIN SEED ──────────────────────────────────────────────────────────────
// MUHIM: faqat admin umuman yo'q bo'lsa yaratiladi.
// Mavjud admin bilan hech narsa qilinmaydi — DELETE/UPDATE hech qachon avtomatik ishlamaydi.
{
  const admin = db.prepare("SELECT id FROM users WHERE role='admin'").get()
  if (!admin) {
    db.prepare("INSERT INTO users (username, password, plain_password, role, name, telegram_id, created_at) VALUES (?,?,?,'admin',?,NULL,datetime('now','+5 hours'))")
      .run('00001111', hashPassword('00001111'), '00001111', 'Raxmatulloh Boqijonov')
    console.log('[seed] Admin yaratildi: Raxmatulloh Boqijonov (parol: 00001111)')
  }
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim()
          ?? c.req.header('x-real-ip')
          ?? 'unknown'
  if (!rateLimit(ip, 20, 60_000))
    return c.json({ error: "Juda ko'p urinish. 1 daqiqa kuting." }, 429)

  const { password } = await c.req.json()
  if (!password || password.length !== 8 || !/^\d+$/.test(password))
    return c.json({ error: "Parol 8 ta raqamdan iborat bo'lishi kerak" }, 400)
  const user = q.userByPlainPassword.get({ plain_password: password })
  if (!user) return c.json({ error: "Parol noto'g'ri" }, 401)
  const token = await createToken(user)
  return c.json({ token, user: { id: user.id, role: user.role, name: user.name } })
})

app.get('/api/auth/me', requireAuth, (c) => {
  const { sub: id } = c.get('user')
  const user = q.userById.get({ id })
  return c.json(user ?? { error: 'Not found' })
})

app.patch('/api/auth/change-password', requireAuth, async (c) => {
  const { sub: id, role } = c.get('user')
  if (role === 'admin') return c.json({ error: 'Admin paroli faqat dasturchi tomonidan o\'zgartiriladi' }, 403)
  const { currentPassword, newPassword } = await c.req.json()
  if (!currentPassword || !newPassword) return c.json({ error: 'Maydonlar to\'ldirilmagan' }, 400)
  if (newPassword.length !== 8 || !/^\d+$/.test(newPassword)) return c.json({ error: 'Yangi parol 8 ta raqamdan iborat bo\'lishi kerak' }, 400)
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id)
  if (!user || user.plain_password !== currentPassword) return c.json({ error: 'Joriy parol noto\'g\'ri' }, 400)
  db.prepare('UPDATE users SET password=?, plain_password=?, username=? WHERE id=?')
    .run(hashPassword(newPassword), newPassword, newPassword, id)
  return c.json({ ok: true })
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
  const { name, password } = await c.req.json()
  if (!name || !password) return c.json({ error: 'ism-familiya va parol majburiy' }, 400)
  if (password.length !== 8 || !/^\d+$/.test(password)) return c.json({ error: 'Parol 8 ta raqamdan iborat bo\'lishi kerak' }, 400)
  try {
    q.insertUser.run({ plain_password: password, password: hashPassword(password), role: 'salesmanager', name })
    return c.json({ ok: true }, 201)
  } catch (e) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'Bu parol allaqachon mavjud' }, 409)
    return c.json({ error: e.message }, 500)
  }
})

app.patch('/api/users/:id', requireAuth, requireAdmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const { name, password } = await c.req.json()
  if (!name) return c.json({ error: 'ism-familiya majburiy' }, 400)
  try {
    if (password) {
      if (password.length !== 8 || !/^\d+$/.test(password)) return c.json({ error: 'Parol 8 ta raqamdan iborat bo\'lishi kerak' }, 400)
      db.prepare('UPDATE users SET name=?, username=?, password=?, plain_password=? WHERE id=?')
        .run(name, password, hashPassword(password), password, id)
    } else {
      db.prepare('UPDATE users SET name=? WHERE id=?').run(name, id)
    }
    broadcast('user_invalidated', { id })
    return c.json({ ok: true })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'Bu parol allaqachon mavjud' }, 409)
    return c.json({ error: e.message }, 500)
  }
})

app.delete('/api/users/:id', requireAuth, requireAdmin, (c) => {
  const id = parseInt(c.req.param('id'))
  db.prepare('UPDATE bookings SET user_id=NULL WHERE user_id=?').run(id)
  db.prepare("DELETE FROM users WHERE id=? AND role='salesmanager'").run(id)
  broadcast('user_invalidated', { id })
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

app.get('/api/apartments/booking', requireAuth, (c) => {
  const aptId = c.req.query('id')
  if (!aptId) return c.json({ error: 'id required' }, 400)
  const row = q.aptBookings.get({ apartment_id: aptId })
  if (!row) return c.json(null)
  return c.json({ ism: row.ism, manager_name: row.manager_name, created_at: row.created_at, type: row.type })
})

// ─── PRICES ───────────────────────────────────────────────────────────────────

app.get('/api/prices', requireAuth, (c) => {
  const block = c.req.query('block')
  const bolim = parseInt(c.req.query('bolim'))
  const floor = parseInt(c.req.query('floor'))
  if (!block || isNaN(bolim) || isNaN(floor)) return c.json({ error: 'block, bolim, floor required' }, 400)
  const row = q.getPrice.get({ block, bolim, floor })
  return c.json({ price: row?.price ?? 1000 })
})

app.get('/api/prices/all', requireAuth, requireAdmin, (c) => {
  return c.json(q.allPrices.all())
})

app.patch('/api/prices', requireAuth, requireAdmin, async (c) => {
  const { block, bolim, floor, price } = await c.req.json()
  if (!block || bolim == null || floor == null || price == null) return c.json({ error: 'block, bolim, floor, price required' }, 400)
  if (typeof price !== 'number' || price < 0) return c.json({ error: 'price must be non-negative number' }, 400)
  q.upsertPrice.run({ block, bolim: parseInt(bolim), floor: parseInt(floor), price })
  return c.json({ ok: true })
})

app.patch('/api/apartments/:id/status', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  if (!['EMPTY', 'RESERVED', 'SOLD'].includes(status)) return c.json({ error: "Status: EMPTY | RESERVED | SOLD" }, 400)
  db.exec('BEGIN')
  try {
    q.updateStatus.run({ status, id })
    if (status === 'EMPTY') q.cancelBooking.run({ apartment_id: id })
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return c.json({ error: e.message }, 500)
  }
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

  const caption = `🟡 <b>Bron</b>\n` +
    `🏢 <b>Do'kon:</b> ${booking.apartment_id}\n` +
    `👤 <b>Mijoz:</b> ${booking.ism} ${booking.familiya}\n` +
    (booking.phone ? `📞 <b>Telefon:</b> ${booking.phone}\n` : '') +
    `💰 <b>Boshlang'ich:</b> ${booking.boshlangich}\n` +
    `📅 <b>Muddat:</b> ${booking.oylar} oy\n` +
    `🤵 <b>Manager:</b> ${booking.manager_name ?? ''}`

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
    try {
      const res = await proxiedFetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!json.ok) {
        console.error('[sendDoc] Telegram xato:', JSON.stringify(json), 'chatId:', chatId)
        if (json.error_code === 403 || json.error_code === 400) {
          db.prepare('DELETE FROM telegram_subscribers WHERE chat_id=?').run(String(chatId))
        }
      } else {
        console.log('[sendDoc] OK → chatId:', chatId)
      }
    } catch (e) {
      console.error('[sendDoc] fetch xato:', e?.message, 'chatId:', chatId)
    }
  }

  // Barcha chat_idlar: managers + admin + subscribers (parallel)
  const targets = new Set()
  const subscribers = q.allSubscribers.all()
  console.log('[send-pdf] subscribers:', subscribers.length, '| adminTgId:', adminTgId)

  for (const manager of q.allUsers.all()) {
    if (manager.telegram_id) targets.add(String(manager.telegram_id))
  }
  if (adminTgId) targets.add(String(adminTgId))
  for (const sub of subscribers) targets.add(sub.chat_id)

  await Promise.all([...targets].map(chatId => sendDoc(chatId)))

  console.log('[send-pdf] yuborildi:', targets.size, 'ta')
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

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ ok: true }))

const port = parseInt(process.env.PORT ?? '3001')
serve({ fetch: app.fetch, port })
console.log(`Backend: http://localhost:${port}`)
