import { Hono } from 'hono'
import { q } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { broadcast } from '../lib/sse.js'

const app = new Hono()

app.get('/', requireAuth, (c) => c.json(q.allDiscountBrackets.all()))

app.post('/', requireAuth, requireAdmin, async (c) => {
  const { min_percent, discount_usd } = await c.req.json()
  if (!Number.isInteger(min_percent) || min_percent < 1 || min_percent > 100)
    return c.json({ error: "min_percent 1-100 orasida bo'lishi kerak" }, 400)
  if (typeof discount_usd !== 'number' || isNaN(discount_usd) || discount_usd < 0)
    return c.json({ error: "discount_usd musbat son bo'lishi kerak" }, 400)
  try {
    q.insertDiscountBracket.run({ min_percent, discount_usd })
    const all = q.allDiscountBrackets.all()
    broadcast('discount_brackets_changed', all)
    return c.json(all)
  } catch {
    return c.json({ error: 'Bu foiz allaqachon mavjud' }, 409)
  }
})

app.put('/:id', requireAuth, requireAdmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const { min_percent, discount_usd } = await c.req.json()
  if (!Number.isInteger(min_percent) || min_percent < 1 || min_percent > 100)
    return c.json({ error: "min_percent 1-100 orasida bo'lishi kerak" }, 400)
  if (typeof discount_usd !== 'number' || isNaN(discount_usd) || discount_usd < 0)
    return c.json({ error: "discount_usd musbat son bo'lishi kerak" }, 400)
  const existing = q.allDiscountBrackets.all().find(b => b.id === id)
  if (!existing) return c.json({ error: 'Daraja topilmadi' }, 404)
  try {
    q.updateDiscountBracket.run({ id, min_percent, discount_usd })
    const all = q.allDiscountBrackets.all()
    broadcast('discount_brackets_changed', all)
    return c.json(all)
  } catch {
    return c.json({ error: 'Bu foiz allaqachon mavjud' }, 409)
  }
})

app.delete('/:id', requireAuth, requireAdmin, (c) => {
  const id = parseInt(c.req.param('id'))
  const existing = q.allDiscountBrackets.all().find(b => b.id === id)
  if (!existing) return c.json({ error: 'Daraja topilmadi' }, 404)
  q.deleteDiscountBracket.run({ id })
  const all = q.allDiscountBrackets.all()
  broadcast('discount_brackets_changed', all)
  return c.json(all)
})

export default app
