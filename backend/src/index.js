import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { db, q, dbPath } from './db.js'
import { hashPassword, verifyPassword, createTokenPair, verifyRefresh, requireAuth, requireAdmin, isWorkingHours } from './auth.js'
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
app.use('/api/*', cors({
  origin: process.env.CORS_ORIGIN ?? process.env.WEBHOOK_DOMAIN ?? '*',
  credentials: false,
}))

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
    }).catch(e => console.error('[webhook] sendMessage xato:', e?.message ?? e))
    return c.json({ ok: true })
  }

  return c.json({ ok: true })
})

// ─── BACKUP ───────────────────────────────────────────────────────────────────

const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID ?? '7874777577'

// Har soatda faqat egasiga backup fayl yuboriladi
// Faqat UZB vaqti 06:00–20:59 orasida (UTC+5)
async function notifyBackupAll() {
  const uzbHour = new Date(Date.now() + 5 * 3600_000).getUTCHours()
  if (uzbHour < 6 || uzbHour >= 21) {
    console.log('[backup] soat', uzbHour, "UZB — vaqt tashqarida (06:00–21:00), o'tkazib yuborildi")
    return
  }
  await sendBackupFile(OWNER_CHAT_ID)
}

// Cron: har 1 soatda
setInterval(() => { notifyBackupAll().catch(console.error) }, 60 * 60_000).unref()

// Berilgan chatga SQLite faylni yuboradi
async function sendBackupFile(chatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return false

  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  const tmpPath = pathJoin(tmpdir(), `jahon_backup_${Date.now()}.sqlite`)
  try { copyFileSync(dbPath, tmpPath) }
  catch (e) { console.error('[backup] copy xato:', e.message); return false }

  const uzbNow = new Date(Date.now() + 5 * 3600_000)
  const fname  = `jahon_${uzbNow.toISOString().slice(0,10)}_${String(uzbNow.getUTCHours()).padStart(2,'0')}00.sqlite`
  const fileData = readFileSync(tmpPath)
  try { unlinkSync(tmpPath) } catch {}

  const fd = new FormData()
  fd.append('chat_id',  String(chatId))
  fd.append('document', new Blob([fileData], { type: 'application/octet-stream' }), fname)
  try {
    const res  = await proxiedFetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { console.log('[backup] OK → chatId:', chatId); return true }
    else { console.error('[backup] Telegram xato:', JSON.stringify(json)); return false }
  } catch (e) { console.error('[backup] fetch xato:', e.message); return false }
}

// ─── SSE BROADCAST ───────────────────────────────────────────────────────────
const sseClients = new Set()
const SSE_MAX_CLIENTS = 200

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const send of sseClients) {
    try { send(msg) } catch { sseClients.delete(send) }
  }
}

// ─── WORKING HOURS ENFORCER — aniq 20:00 da bir marta trigger ────────────────
function scheduleWorkEnd() {
  const now     = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }))
  const target  = new Date(now)
  target.setHours(20, 0, 0, 0)
  let ms = target - now
  if (ms <= 0) ms += 24 * 60 * 60 * 1000   // o'tib ketgan bo'lsa — ertasiga
  setTimeout(() => {
    broadcast('working_hours_ended', { message: "Ish vaqti tugadi. Tizimdan chiqarilmoqdasiz." })
    scheduleWorkEnd()                         // keyingi kun uchun qayta rejalashtir
  }, ms).unref()
}
scheduleWorkEnd()

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
  if (sseClients.size >= SSE_MAX_CLIENTS) return c.json({ error: 'Too many connections' }, 503)
  // Authorization header (fetch-based SSE) yoki query param (legacy fallback)
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : c.req.query('token')
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

// ─── PUBLIC SSE (live page) ───────────────────────────────────────────────────
app.get('/api/live/events', (c) => {
  if (sseClients.size >= SSE_MAX_CLIENTS) return c.json({ error: 'Too many connections' }, 503)
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
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } }
  )
})

// ─── ADMIN SEED ──────────────────────────────────────────────────────────────
// Faqat admin umuman yo'q bo'lsa yaratiladi (yangi server / bo'sh DB).
{
  const admin = db.prepare("SELECT id FROM users WHERE role='admin'").get()
  if (!admin) {
    const defaultPass = process.env.ADMIN_DEFAULT_PASSWORD ?? '00001111'
    db.prepare("INSERT INTO users (username, password, plain_password, role, name, telegram_id, created_at) VALUES (?,?,?,'admin',?,NULL,datetime('now','+5 hours'))")
      .run(defaultPass, hashPassword(defaultPass), defaultPass, 'Admin')
    console.log('[seed] Admin yaratildi')
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

  // salesmanager faqat ish vaqtida tizimga kira oladi
  if (user.role === 'salesmanager' && !isWorkingHours()) {
    return c.json({ error: 'OUTSIDE_HOURS', message: "Tizim faqat 08:00–20:00 orasida ishlaydi" }, 403)
  }

  const { accessToken, refreshToken } = await createTokenPair(user)
  return c.json({ token: accessToken, refreshToken, user: { id: user.id, role: user.role, name: user.name } })
})

app.post('/api/auth/refresh', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? c.req.header('x-real-ip') ?? 'unknown'
  if (!rateLimit(`refresh:${ip}`, 30, 60_000))
    return c.json({ error: "Juda ko'p urinish. 1 daqiqa kuting." }, 429)
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (!refreshToken) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const payload = await verifyRefresh(refreshToken)
    // salesmanager uchun ish vaqti tekshiruvi
    if (payload.role === 'salesmanager' && !isWorkingHours()) {
      return c.json({ error: 'OUTSIDE_HOURS', message: "Tizim faqat 08:00–20:00 orasida ishlaydi" }, 403)
    }
    const user = q.userById.get({ id: payload.sub })
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const { accessToken, refreshToken: newRefresh } = await createTokenPair(user)
    return c.json({ token: accessToken, refreshToken: newRefresh })
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
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
  if (newPassword === currentPassword) return c.json({ error: 'Yangi parol joriy paroldan farq qilishi kerak' }, 400)
  try {
    db.prepare('UPDATE users SET password=?, plain_password=?, username=? WHERE id=?')
      .run(hashPassword(newPassword), newPassword, newPassword, id)
    return c.json({ ok: true })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'Bu parol boshqa foydalanuvchida mavjud' }, 409)
    return c.json({ error: e.message }, 500)
  }
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

app.get('/api/floors', (c) => {
  const block = c.req.query('block')
  if (!block) return c.json({ error: 'block required' }, 400)
  const bolim = c.req.query('bolim')
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  const rows = bolim
    ? db.prepare('SELECT DISTINCT floor FROM apartments WHERE block=? AND bolim=? ORDER BY floor').all(block, parseInt(bolim))
    : db.prepare('SELECT DISTINCT floor FROM apartments WHERE block=? ORDER BY floor').all(block)
  return c.json(rows.map(r => r.floor))
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
  return c.json({ id: row.id, user_id: row.user_id, ism: row.ism, manager_name: row.manager_name, created_at: row.created_at, type: row.type })
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

// ─── SALES LOCKS ─────────────────────────────────────────────────────────────

app.get('/api/sales-locks', requireAuth, (c) => {
  return c.json(q.allLocks.all())
})

app.post('/api/sales-locks', requireAuth, requireAdmin, async (c) => {
  const { block, bolim, floor, reason } = await c.req.json()
  if (!block || bolim == null || floor == null) return c.json({ error: 'block, bolim, floor required' }, 400)
  if (!reason?.trim()) return c.json({ error: 'Sabab kiritish majburiy' }, 400)
  const user = c.get('user')
  const locked_at = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
  q.upsertLock.run({ block: String(block).toUpperCase(), bolim: parseInt(bolim), floor: parseInt(floor), reason: reason.trim(), locked_at, locked_by: user?.name ?? 'Admin' })
  return c.json({ ok: true })
})

app.delete('/api/sales-locks', requireAuth, requireAdmin, async (c) => {
  const { block, bolim, floor } = await c.req.json()
  if (!block || bolim == null || floor == null) return c.json({ error: 'block, bolim, floor required' }, 400)
  q.deleteLock.run({ block: String(block).toUpperCase(), bolim: parseInt(bolim), floor: parseInt(floor) })
  return c.json({ ok: true })
})

app.patch('/api/apartments/:id/status', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')
  const { status, reason } = await c.req.json()
  if (!['EMPTY', 'RESERVED', 'SOLD', 'NOT_SALE'].includes(status)) return c.json({ error: "Status: EMPTY | RESERVED | SOLD | NOT_SALE" }, 400)
  if (status === 'NOT_SALE' && !reason?.trim()) return c.json({ error: "NOT_SALE uchun sabab kiritish majburiy" }, 400)
  db.exec('BEGIN')
  try {
    if (status === 'NOT_SALE') {
      q.updateStatusReason.run({ status, reason: reason.trim(), id })
    } else {
      q.updateStatus.run({ status, id })
      if (status === 'EMPTY') q.cancelBooking.run({ apartment_id: id })
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return c.json({ error: e.message }, 500)
  }
  broadcast('apartment', { id, status, not_sale_reason: status === 'NOT_SALE' ? reason.trim() : null })
  broadcast('booking', { cancelled: true })
  return c.json({ ok: true })
})

app.get('/api/shops', requireAuth, requireAdmin, (c) => {
  const block  = c.req.query('block')  || ''
  const bolim  = c.req.query('bolim')  || ''
  const floor  = c.req.query('floor')  || ''
  const status = c.req.query('status') || ''
  const search = c.req.query('search') || ''
  const limit  = Math.min(parseInt(c.req.query('limit')  || '50'), 100)
  const offset = parseInt(c.req.query('offset') || '0')

  const conditions = ['a.is_shop = 1']
  const params = { limit, offset }

  if (block)  { conditions.push('a.block = :block');  params.block  = block }
  if (bolim)  { conditions.push('a.bolim = :bolim');  params.bolim  = parseInt(bolim) }
  if (floor)  { conditions.push('a.floor = :floor');  params.floor  = parseInt(floor) }
  if (status) { conditions.push('a.status = :status'); params.status = status }
  if (search) {
    conditions.push("(a.id LIKE :search OR CAST(a.bolim AS TEXT) LIKE :search OR CAST(a.floor AS TEXT) LIKE :search)")
    params.search = `%${search}%`
  }

  const where = 'WHERE ' + conditions.join(' AND ')
  const rows = db.prepare(`
    SELECT a.id AS address, a.block, a.bolim, a.floor, a.size, a.status, a.not_sale_reason,
           COALESCE(p.price, 1000) AS price
    FROM apartments a
    LEFT JOIN prices p ON p.block = a.block AND p.bolim = a.bolim AND p.floor = a.floor
    ${where}
    ORDER BY a.block, a.bolim, a.floor, a.id
    LIMIT :limit OFFSET :offset
  `).all(params)

  return c.json(rows)
})

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────

app.post('/api/bookings', requireAuth, async (c) => {
  const user = c.get('user')
  const { apartment_id, type, ism, familiya, boshlangich, oylar, umumiy, passport, manzil, phone, passport_place, narx_m2, chegirma_m2, asl_narx_m2, assigned_user_id } = await c.req.json()
  if (!apartment_id || !type || !ism || !familiya || !boshlangich || !oylar)
    return c.json({ error: "Majburiy maydonlar to'ldirilmagan" }, 400)

  const effective_user_id = assigned_user_id ? parseInt(assigned_user_id) : user.sub

  db.exec('BEGIN')
  try {
    const apt = db.prepare("SELECT block, bolim, floor, status FROM apartments WHERE id=?").get(apartment_id)
    if (!apt) { db.exec('ROLLBACK'); return c.json({ error: "Do'kon topilmadi" }, 404) }
    if (apt.status !== 'EMPTY') { db.exec('ROLLBACK'); return c.json({ error: "Do'kon allaqachon band yoki sotilgan" }, 409) }
    const lock = db.prepare("SELECT reason FROM sales_locks WHERE block=? AND bolim=? AND floor=?").get(apt.block, apt.bolim, apt.floor)
    if (lock) { db.exec('ROLLBACK'); return c.json({ error: `Sotuv to'xtatilgan: ${lock.reason}` }, 403) }
    q.insertBooking.run({ apartment_id, user_id: effective_user_id, type, ism, familiya, boshlangich, oylar: parseInt(oylar), umumiy: umumiy ?? null, passport: passport ?? null, manzil: manzil ?? null, phone: phone ?? null, passport_place: passport_place ?? null, narx_m2: narx_m2 ?? null, chegirma_m2: chegirma_m2 ?? null, asl_narx_m2: asl_narx_m2 ?? null })
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
  const user      = c.get('user')
  const cancelled = c.req.query('cancelled') === '1'
  const limit     = Math.min(parseInt(c.req.query('limit')  ?? '50'), 100)
  const offset    = parseInt(c.req.query('offset') ?? '0')
  const search    = c.req.query('search') || ''
  const type      = c.req.query('type')   || ''
  const block     = c.req.query('block')  || ''
  const bolim     = c.req.query('bolim')  || ''
  const floor     = c.req.query('floor')  || ''
  const dateFrom  = c.req.query('from')   || ''
  const dateTo    = c.req.query('to')     || ''

  const dateField = cancelled ? 'b.cancelled_at' : 'b.created_at'
  const conditions = [cancelled ? 'b.cancelled_at IS NOT NULL' : 'b.cancelled_at IS NULL']
  const params = { limit, offset }

  if (user.role !== 'admin') { conditions.push('b.user_id = :user_id'); params.user_id = user.sub }
  if (search) {
    conditions.push('(b.apartment_id LIKE :search OR b.ism LIKE :search OR b.familiya LIKE :search OR COALESCE(b.phone,\'\') LIKE :search)')
    params.search = `%${search}%`
  }
  if (type)     { conditions.push('b.type = :type');          params.type  = type }
  if (block)    { conditions.push('a.block = :block');        params.block = block }
  if (bolim)    { conditions.push('a.bolim = :bolim');        params.bolim = parseInt(bolim) }
  if (floor)    { conditions.push('a.floor = :floor');        params.floor = parseInt(floor) }
  if (dateFrom) { conditions.push(`${dateField} >= :dateFrom`); params.dateFrom = dateFrom }
  if (dateTo)   { conditions.push(`${dateField} <= :dateTo || ' 23:59:59'`); params.dateTo = dateTo }

  const where = 'WHERE ' + conditions.join(' AND ')
  const rows = db.prepare(`
    SELECT b.*, u.name AS manager_name, a.block, a.bolim, a.floor
    FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    LEFT JOIN apartments a ON a.id = b.apartment_id
    ${where}
    ORDER BY ${dateField} DESC
    LIMIT :limit OFFSET :offset
  `).all(params)
  return c.json(rows)
})

app.get('/api/bookings/apartment/:id', requireAuth, (c) => {
  return c.json(q.aptBookings.all({ apartment_id: c.req.param('id') }))
})

app.patch('/api/bookings/:id/convert', requireAuth, async (c) => {
  const { sub: userId } = c.get('user')
  const id = parseInt(c.req.param('id'))
  const booking = db.prepare('SELECT b.*, a.block, a.bolim, a.floor FROM bookings b JOIN apartments a ON a.id=b.apartment_id WHERE b.id=? AND b.cancelled_at IS NULL').get(id)
  if (!booking) return c.json({ error: 'Topilmadi' }, 404)
  if (booking.type !== 'bron') return c.json({ error: "Faqat bron qilingan do'konni sotishga o'tkazish mumkin" }, 400)
  if (booking.user_id !== userId) return c.json({ error: "Ruxsat yo'q" }, 403)
  const convertLock = db.prepare("SELECT reason FROM sales_locks WHERE block=? AND bolim=? AND floor=?").get(booking.block, booking.bolim, booking.floor)
  if (convertLock) return c.json({ error: `Sotuv to'xtatilgan: ${convertLock.reason}` }, 403)

  const body = await c.req.json().catch(() => ({}))
  const { passport, passport_place, manzil } = body

  db.exec('BEGIN')
  try {
    db.prepare('UPDATE bookings SET type=?, passport=COALESCE(?,passport), passport_place=COALESCE(?,passport_place), manzil=COALESCE(?,manzil) WHERE id=?')
      .run('sotish', passport || null, passport_place || null, manzil || null, id)
    db.prepare("UPDATE apartments SET status='SOLD' WHERE id=?").run(booking.apartment_id)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return c.json({ error: e.message }, 500)
  }

  broadcast('apartment', { id: booking.apartment_id, status: 'SOLD' })
  broadcast('booking', { updated: true })
  return c.json({ ok: true })
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

  // Barcha subscriberlarga (parallel)
  const targets = new Set()
  const subscribers = q.allSubscribers.all()
  console.log('[send-pdf] subscribers:', subscribers.length)

  for (const manager of q.allUsers.all()) {
    if (manager.telegram_id) targets.add(String(manager.telegram_id))
  }
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
  const total = { SOLD: 0, RESERVED: 0, EMPTY: 0, NOT_SALE: 0 }
  for (const row of rows) {
    if (!blocks[row.block]) blocks[row.block] = { SOLD: 0, RESERVED: 0, EMPTY: 0, NOT_SALE: 0 }
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
      if (!map[key]) map[key] = { block: r.block, [groupKey]: r[groupKey], SOLD: 0, RESERVED: 0, EMPTY: 0, NOT_SALE: 0 }
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

// ─── TELEGRAM WEBHOOK SETUP ──────────────────────────────────────────────────
async function setupTelegramWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const domain = process.env.WEBHOOK_DOMAIN // e.g. https://jahon-bozori.prohome.uz
  if (!token || !domain) {
    if (token && !domain) console.log('[telegram] WEBHOOK_DOMAIN yo\'q — webhook o\'rnatilmadi')
    return
  }
  const webhookUrl = `${domain.replace(/\/$/, '')}/api/telegram/webhook`
  try {
    const res = await proxiedFetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, drop_pending_updates: false }),
    })
    const json = await res.json()
    if (json.ok) console.log(`[telegram] Webhook o'rnatildi: ${webhookUrl}`)
    else console.error('[telegram] Webhook xato:', json.description)
  } catch (e) { console.error('[telegram] Webhook setup xato:', e.message) }
}

// Har 30 daqiqada webhook sog'ligini tekshiradi — muammo bo'lsa qayta o'rnatadi
async function checkWebhookHealth() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const domain = process.env.WEBHOOK_DOMAIN
  if (!token || !domain) return
  try {
    const res = await proxiedFetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const json = await res.json()
    if (!json.ok) return
    const info = json.result
    const expectedUrl = `${domain.replace(/\/$/, '')}/api/telegram/webhook`
    // URL noto'g'ri, xato xabari bor, yoki 100+ pending update (ishlamayapti)
    const needsFix = info.url !== expectedUrl || !!info.last_error_message || info.pending_update_count > 100
    if (needsFix) {
      console.log('[telegram] Webhook muammo — qayta o\'rnatilmoqda. url_ok:', info.url === expectedUrl, 'error:', info.last_error_message, 'pending:', info.pending_update_count)
      await setupTelegramWebhook()
      await proxiedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: OWNER_CHAT_ID,
          text: `⚠️ <b>Bot webhook muammo aniqlandi va qayta o'rnatildi</b>\n\nURL to'g'ri: ${info.url === expectedUrl ? 'Ha' : 'Yo\'q'}\nXato: ${info.last_error_message ?? 'yo\'q'}\nPending: ${info.pending_update_count}`,
          parse_mode: 'HTML',
        }),
      }).catch(() => {})
    }
  } catch (e) { console.error('[telegram] Webhook health check xato:', e.message) }
}

// Har 30 daqiqada webhook tekshiriladi
setInterval(() => { checkWebhookHealth().catch(console.error) }, 30 * 60_000).unref()

const port = parseInt(process.env.PORT ?? '3001')
serve({ fetch: app.fetch, port })
console.log(`[backend] http://localhost:${port}`)
setupTelegramWebhook().catch(() => {})
