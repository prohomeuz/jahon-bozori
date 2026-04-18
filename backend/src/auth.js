import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { sign, verify } from 'hono/jwt'

const SECRET = process.env.JWT_SECRET

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, 64)
  return timingSafeEqual(expected, actual)
}

export async function createToken(user) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 kun
  return sign({ sub: user.id, role: user.role, name: user.name, exp }, SECRET, 'HS256')
}

export async function requireAuth(c, next) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const payload = await verify(auth.slice(7), SECRET, 'HS256')
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
}

export function requireAdmin(c, next) {
  const user = c.get('user')
  if (user?.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  return next()
}
