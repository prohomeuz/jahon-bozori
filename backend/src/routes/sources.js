import { Hono } from 'hono'
import { q } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'

const app = new Hono()

app.get('/', requireAuth, (c) => c.json(q.allSources.all()))

app.post('/', requireAuth, requireAdmin, async (c) => {
  const { name } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'Nom kiritilishi shart' }, 400)
  try {
    q.insertSource.run({ name: name.trim() })
    return c.json(q.allSources.all())
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return c.json({ error: 'Bu nom allaqachon mavjud' }, 409)
    return c.json({ error: e.message }, 500)
  }
})

app.patch('/reorder', requireAuth, requireAdmin, async (c) => {
  const { ids } = await c.req.json()
  if (!Array.isArray(ids)) return c.json({ error: 'ids array kerak' }, 400)
  ids.forEach((id, i) => q.updateSourcePos.run({ id, position: i + 1 }))
  return c.json(q.allSources.all())
})

app.patch('/:id', requireAuth, requireAdmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const { name } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'Nom kiritilishi shart' }, 400)
  try {
    q.updateSource.run({ id, name: name.trim() })
    return c.json(q.allSources.all())
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return c.json({ error: 'Bu nom allaqachon mavjud' }, 409)
    return c.json({ error: e.message }, 500)
  }
})

app.delete('/:id', requireAuth, requireAdmin, (c) => {
  const id = parseInt(c.req.param('id'))
  q.deleteSource.run({ id })
  return c.json(q.allSources.all())
})

export default app
