import { Hono } from 'hono'
import { db, q } from '../db.js'
import { hashPassword, verifyPassword, createTokenPair, verifyRefresh, isWorkingHours } from '../auth.js'
import { broadcast } from '../lib/sse.js'

const app = new Hono()

function rateLimit(map, key, max, windowMs) {
  const now = Date.now()
  let entry = map.get(key)
  if (!entry || now > entry.resetAt) { entry = { count: 0, resetAt: now + windowMs }; map.set(key, entry) }
  entry.count++
  return entry.count <= max
}

const _rateMap = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of _rateMap) if (now > v.resetAt) _rateMap.delete(k)
}, 60_000).unref()

function isLocalhost(c) {
  const host = c.req.header('host') ?? ''
  return host.startsWith('localhost') || host.startsWith('127.0.0.1')
}

app.post('/login', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? c.req.header('x-real-ip') ?? 'unknown'
  if (!rateLimit(_rateMap, ip, 20, 60_000))
    return c.json({ error: "Juda ko'p urinish. 1 daqiqa kuting." }, 429)
  const { password } = await c.req.json()
  if (!password || password.length !== 8 || !/^\d+$/.test(password))
    return c.json({ error: "Parol 8 ta raqamdan iborat bo'lishi kerak" }, 400)
  const user = q.userByPlainPassword.get({ plain_password: password })
  if (!user) return c.json({ error: "Parol noto'g'ri" }, 401)
  if (user.role === 'salesmanager' && !isWorkingHours() && !isLocalhost(c))
    return c.json({ error: 'OUTSIDE_HOURS', message: "Tizim faqat 08:00–20:00 orasida ishlaydi" }, 403)
  const { accessToken, refreshToken } = await createTokenPair(user)
  return c.json({ token: accessToken, refreshToken, user: { id: user.id, role: user.role, name: user.name } })
})

app.post('/refresh', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? c.req.header('x-real-ip') ?? 'unknown'
  if (!rateLimit(_rateMap, `refresh:${ip}`, 30, 60_000))
    return c.json({ error: "Juda ko'p urinish. 1 daqiqa kuting." }, 429)
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (!refreshToken) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const payload = await verifyRefresh(refreshToken)
    if (payload.role === 'salesmanager' && !isWorkingHours() && !isLocalhost(c))
      return c.json({ error: 'OUTSIDE_HOURS', message: "Tizim faqat 08:00–20:00 orasida ishlaydi" }, 403)
    const user = q.userById.get({ id: payload.sub })
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const { accessToken, refreshToken: newRefresh } = await createTokenPair(user)
    return c.json({ token: accessToken, refreshToken: newRefresh })
  } catch { return c.json({ error: 'Unauthorized' }, 401) }
})

app.get('/me', (c) => {
  const { sub: id } = c.get('user')
  const user = q.userById.get({ id })
  return c.json(user ?? { error: 'Not found' })
})

app.patch('/change-password', async (c) => {
  const { sub: id, role } = c.get('user')
  if (role === 'admin') return c.json({ error: "Admin paroli faqat dasturchi tomonidan o'zgartiriladi" }, 403)
  const { currentPassword, newPassword } = await c.req.json()
  if (!currentPassword || !newPassword) return c.json({ error: "Maydonlar to'ldirilmagan" }, 400)
  if (newPassword.length !== 8 || !/^\d+$/.test(newPassword)) return c.json({ error: "Yangi parol 8 ta raqamdan iborat bo'lishi kerak" }, 400)
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id)
  if (!user || user.plain_password !== currentPassword) return c.json({ error: "Joriy parol noto'g'ri" }, 400)
  if (newPassword === currentPassword) return c.json({ error: "Yangi parol joriy paroldan farq qilishi kerak" }, 400)
  try {
    db.prepare('UPDATE users SET password=?, plain_password=?, username=? WHERE id=?')
      .run(hashPassword(newPassword), newPassword, newPassword, id)
    return c.json({ ok: true })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'Bu parol boshqa foydalanuvchida mavjud' }, 409)
    return c.json({ error: e.message }, 500)
  }
})

export default app
