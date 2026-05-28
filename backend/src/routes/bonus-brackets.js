import { Hono } from 'hono'
import { q } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { uploadsDir } from '../lib/uploads.js'
import { writeFile } from 'fs/promises'
import { join, extname } from 'path'
import { randomBytes } from 'crypto'

const app = new Hono()
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

function getAllBrackets() {
  return q.allBonusBrackets.all().map(b => ({
    ...b,
    items: q.bonusItemsByBracket.all({ bracket_id: b.id }),
  }))
}

async function saveUpload(file) {
  const ext = extname(file.name).toLowerCase() || '.jpg'
  if (!ALLOWED_EXTS.has(ext)) throw new Error('Faqat rasm fayllar joiz')
  const filename = randomBytes(16).toString('hex') + ext
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(join(uploadsDir, filename), buffer)
  return `/uploads/${filename}`
}

// GET /api/bonus-brackets
app.get('/', requireAuth, (c) => c.json(getAllBrackets()))

// POST /api/bonus-brackets — new bracket
app.post('/', requireAdmin, async (c) => {
  const { min_percent } = await c.req.json()
  if (!Number.isInteger(min_percent) || min_percent < 1 || min_percent > 100)
    return c.json({ error: "min_percent 1-100 orasida bo'lishi kerak" }, 400)
  try {
    q.insertBonusBracket.run({ min_percent })
    return c.json(getAllBrackets())
  } catch {
    return c.json({ error: 'Bu foiz allaqachon mavjud' }, 409)
  }
})

// PUT /api/bonus-brackets/:id — update bracket %
app.put('/:id', requireAdmin, async (c) => {
  const id = parseInt(c.req.param('id'))
  const { min_percent } = await c.req.json()
  if (!Number.isInteger(min_percent) || min_percent < 1 || min_percent > 100)
    return c.json({ error: "min_percent 1-100 orasida bo'lishi kerak" }, 400)
  try {
    q.updateBonusBracket.run({ id, min_percent })
    return c.json(getAllBrackets())
  } catch {
    return c.json({ error: 'Bu foiz allaqachon mavjud' }, 409)
  }
})

// DELETE /api/bonus-brackets/:id
app.delete('/:id', requireAdmin, (c) => {
  q.deleteBonusBracket.run({ id: parseInt(c.req.param('id')) })
  return c.json(getAllBrackets())
})

// POST /api/bonus-brackets/:id/items — add item (with optional image upload)
app.post('/:id/items', requireAdmin, async (c) => {
  const bracketId = parseInt(c.req.param('id'))
  const { n: existingCount } = q.countBonusItems.get({ bracket_id: bracketId })
  if (existingCount >= 5)
    return c.json({ error: "Har bir bracketda maksimal 5 ta texnika bo'lishi mumkin" }, 400)

  let name, image_path = null
  const ct = c.req.header('content-type') ?? ''

  if (ct.includes('multipart/form-data')) {
    const body = await c.req.parseBody()
    name = String(body.name ?? '').trim()
    const file = body.image
    if (file instanceof File && file.size > 0) {
      try { image_path = await saveUpload(file) }
      catch (e) { return c.json({ error: e.message }, 400) }
    }
  } else {
    const body = await c.req.json()
    name = String(body.name ?? '').trim()
  }

  if (!name) return c.json({ error: 'Nom kiritilishi shart' }, 400)

  try {
    q.insertBonusItem.run({ bracket_id: bracketId, name, image_path })
    return c.json(getAllBrackets())
  } catch {
    return c.json({ error: 'Bu nom bu bracketda allaqachon mavjud' }, 409)
  }
})

// PUT /api/bonus-brackets/items/:itemId — update item name/image
app.put('/items/:itemId', requireAdmin, async (c) => {
  const itemId = parseInt(c.req.param('itemId'))
  const current = q.bonusItemById.get({ id: itemId })
  if (!current) return c.json({ error: 'Topilmadi' }, 404)

  let name, image_path = current.image_path
  const ct = c.req.header('content-type') ?? ''

  if (ct.includes('multipart/form-data')) {
    const body = await c.req.parseBody()
    name = String(body.name ?? '').trim()
    const file = body.image
    if (file instanceof File && file.size > 0) {
      try { image_path = await saveUpload(file) }
      catch (e) { return c.json({ error: e.message }, 400) }
    }
    if (body.remove_image === 'true') image_path = null
  } else {
    const body = await c.req.json()
    name = String(body.name ?? '').trim()
    if ('image_path' in body) image_path = body.image_path
  }

  if (!name) return c.json({ error: 'Nom kiritilishi shart' }, 400)

  q.updateBonusItem.run({ id: itemId, name, image_path })
  return c.json(getAllBrackets())
})

// DELETE /api/bonus-brackets/items/:itemId
app.delete('/items/:itemId', requireAdmin, (c) => {
  q.deleteBonusItem.run({ id: parseInt(c.req.param('itemId')) })
  return c.json(getAllBrackets())
})

export default app
