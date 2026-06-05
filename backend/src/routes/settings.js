import { Hono } from 'hono'
import { q } from '../db.js'
import { requireAuth, requireAdmin, blockNarxchi } from '../auth.js'
import { broadcast } from '../lib/sse.js'

const app = new Hono()
app.use('*', requireAuth, blockNarxchi)

app.get('/', requireAuth, (c) => {
  const rows = q.allSettings.all()
  const out = {}
  for (const row of rows) out[row.key] = row.value === '1'
  return c.json(out)
})

app.put('/', requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json()
  const allowed = ['chegirma_enabled']
  for (const key of allowed) {
    if (key in body) {
      q.upsertSetting.run({ key, value: body[key] ? '1' : '0' })
    }
  }
  const rows = q.allSettings.all()
  const out = {}
  for (const row of rows) out[row.key] = row.value === '1'
  broadcast('settings_changed', out)
  return c.json(out)
})

export default app
