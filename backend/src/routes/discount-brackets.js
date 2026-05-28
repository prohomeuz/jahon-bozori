import { Hono } from 'hono'
import { q } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'

const app = new Hono()

app.get('/', requireAuth, (c) => c.json(q.allDiscountBrackets.all()))

app.post('/', requireAdmin, async (c) => {
  const { min_percent, discount_usd } = await c.req.json()
  if (!Number.isInteger(min_percent) || min_percent < 1 || min_percent > 100)
    return c.json({ error: "min_percent 1-100 orasida bo'lishi kerak" }, 400)
  if (typeof discount_usd !== 'number' || discount_usd < 0)
    return c.json({ error: "discount_usd musbat son bo'lishi kerak" }, 400)
  try {
    q.insertDiscountBracket.run({ min_percent, discount_usd })
    return c.json(q.allDiscountBrackets.all())
  } catch {
    return c.json({ error: 'Bu foiz allaqachon mavjud' }, 409)
  }
})

app.put('/:id', requireAdmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const { min_percent, discount_usd } = await c.req.json()
  if (!Number.isInteger(min_percent) || min_percent < 1 || min_percent > 100)
    return c.json({ error: "min_percent 1-100 orasida bo'lishi kerak" }, 400)
  if (typeof discount_usd !== 'number' || discount_usd < 0)
    return c.json({ error: "discount_usd musbat son bo'lishi kerak" }, 400)
  try {
    q.updateDiscountBracket.run({ id, min_percent, discount_usd })
    return c.json(q.allDiscountBrackets.all())
  } catch {
    return c.json({ error: 'Bu foiz allaqachon mavjud' }, 409)
  }
})

app.delete('/:id', requireAdmin, (c) => {
  q.deleteDiscountBracket.run({ id: parseInt(c.req.param('id')) })
  return c.json(q.allDiscountBrackets.all())
})

export default app
