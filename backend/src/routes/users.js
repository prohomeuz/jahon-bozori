import { Hono } from 'hono'
import { db, q } from '../db.js'
import { hashPassword } from '../auth.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { broadcast } from '../lib/sse.js'

const app = new Hono()

app.get('/', requireAuth, requireAdmin, (c) => c.json(q.allUsers.all()))

app.post('/', requireAuth, requireAdmin, async (c) => {
  const { name, password } = await c.req.json()
  if (!name || !password) return c.json({ error: 'ism-familiya va parol majburiy' }, 400)
  if (password.length !== 8 || !/^\d+$/.test(password)) return c.json({ error: "Parol 8 ta raqamdan iborat bo'lishi kerak" }, 400)
  try {
    q.insertUser.run({ plain_password: password, password: hashPassword(password), role: 'salesmanager', name })
    return c.json({ ok: true }, 201)
  } catch (e) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'Bu parol allaqachon mavjud' }, 409)
    return c.json({ error: e.message }, 500)
  }
})

app.patch('/:id', requireAuth, requireAdmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const { name, password } = await c.req.json()
  if (!name) return c.json({ error: 'ism-familiya majburiy' }, 400)
  try {
    if (password) {
      if (password.length !== 8 || !/^\d+$/.test(password)) return c.json({ error: "Parol 8 ta raqamdan iborat bo'lishi kerak" }, 400)
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

app.patch('/:id/active', requireAuth, requireAdmin, (c) => {
  const id = parseInt(c.req.param('id'))
  const user = db.prepare("SELECT is_active FROM users WHERE id=? AND role='salesmanager'").get(id)
  if (!user) return c.json({ error: 'Not found' }, 404)
  const newActive = user.is_active ? 0 : 1
  db.prepare('UPDATE users SET is_active=? WHERE id=?').run(newActive, id)
  broadcast('user_invalidated', { id, blocked: !newActive })
  return c.json({ ok: true, is_active: newActive })
})

app.delete('/:id', requireAuth, requireAdmin, (c) => {
  const id = parseInt(c.req.param('id'))
  db.prepare('UPDATE bookings SET user_id=NULL WHERE user_id=?').run(id)
  db.prepare("DELETE FROM users WHERE id=? AND role='salesmanager'").run(id)
  broadcast('user_invalidated', { id })
  return c.json({ ok: true })
})

export default app
