import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { sign, verify } from 'hono/jwt'

const SECRET         = process.env.JWT_SECRET
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET

if (!SECRET)         console.warn('[auth] JWT_SECRET muhit o\'zgaruvchisi topilmadi')
if (!REFRESH_SECRET) console.warn('[auth] JWT_REFRESH_SECRET muhit o\'zgaruvchisi topilmadi')

const WORK_START = 8   // 08:00 Tashkent
const WORK_END   = 20  // 20:00 Tashkent

export function tashkentHour() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' })).getHours()
}

export function isWorkingHours() {
  const h = tashkentHour()
  return h >= WORK_START && h < WORK_END
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  const actual   = scryptSync(password, salt, 64)
  return timingSafeEqual(expected, actual)
}

export async function createTokenPair(user) {
  const now = Math.floor(Date.now() / 1000)

  // accessToken: 10 daqiqa
  const accessToken = await sign(
    { sub: user.id, role: user.role, name: user.name, exp: now + 60 * 10 },
    SECRET, 'HS256'
  )

  // refreshToken: admin — 30 kun; salesmanager — faqat bugungi 20:00 gacha
  let refreshExp
  if (user.role === 'admin') {
    refreshExp = now + 60 * 60 * 24 * 30
  } else {
    // Bugungi 20:00 Tashkent vaqti (UTC+5 = 15:00 UTC)
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }))
    d.setHours(WORK_END, 0, 0, 0)
    refreshExp = Math.floor(d.getTime() / 1000)
    // Agar hozir allaqachon 20:00 dan o'tgan bo'lsa — darhol eskirgan (0 sekund)
    if (refreshExp <= now) refreshExp = now
  }

  const refreshToken = await sign(
    { sub: user.id, role: user.role, name: user.name, exp: refreshExp },
    REFRESH_SECRET, 'HS256'
  )

  return { accessToken, refreshToken }
}

export async function verifyRefresh(token) {
  return verify(token, REFRESH_SECRET, 'HS256')
}

function isLocalhostReq(c) {
  const host = c.req.header('host') ?? ''
  return host.startsWith('localhost') || host.startsWith('127.0.0.1')
}

export async function requireAuth(c, next) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const payload = await verify(auth.slice(7), SECRET, 'HS256')

    if (payload.role === 'salesmanager') {
      const { db } = await import('./db.js')
      const row = db.prepare('SELECT is_active FROM users WHERE id=?').get(payload.sub)
      if (!row) return c.json({ error: 'Unauthorized' }, 401)

      // Bloklangan foydalanuvchi faqat o'qish (GET) so'rovlarini amalga oshira oladi
      if (!row.is_active && c.req.method !== 'GET') {
        return c.json({ error: 'BLOCKED' }, 403)
      }

      if (!isWorkingHours() && !isLocalhostReq(c)) {
        return c.json({ error: 'OUTSIDE_HOURS', message: "Tizim faqat 08:00–20:00 orasida ishlaydi" }, 403)
      }
    }

    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

export function requireAdmin(c, next) {
  const user = c.get('user')
  if (user?.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  return next()
}
