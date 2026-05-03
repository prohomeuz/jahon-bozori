import { Hono } from 'hono'
import { db, q } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { broadcast } from '../lib/sse.js'
import { proxiedFetch } from '../lib/telegram.js'

const app = new Hono()

// ─── BOLIMS / FLOORS ───────────���────────────────────��────────────────────────

app.get('/bolims', (c) => {
  const block = c.req.query('block')
  if (!block) return c.json({ error: 'block required' }, 400)
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return c.json(q.bolims.all({ block }).map(r => r.bolim))
})

app.get('/floors', (c) => {
  const block = c.req.query('block')
  if (!block) return c.json({ error: 'block required' }, 400)
  const bolim = c.req.query('bolim')
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  const rows = bolim
    ? db.prepare('SELECT DISTINCT floor FROM apartments WHERE block=? AND bolim=? ORDER BY floor').all(block, parseInt(bolim))
    : db.prepare('SELECT DISTINCT floor FROM apartments WHERE block=? ORDER BY floor').all(block)
  return c.json(rows.map(r => r.floor))
})

// ─── APARTMENTS ──────────────────────────────���────────────────────────────────

app.get('/apartments/stats', (c) => {
  const block = c.req.query('block')
  if (!block) return c.json({ error: 'block required' }, 400)
  const bolim = c.req.query('bolim')
  const rows  = bolim ? q.bolimStats.all({ block, bolim: parseInt(bolim) }) : q.blockStats.all({ block })
  const result = { EMPTY: 0, RESERVED: 0, SOLD: 0 }
  rows.forEach(r => { result[r.status] = r.n })
  c.header('Cache-Control', 'public, max-age=5, stale-while-revalidate=30')
  return c.json(result)
})

app.get('/apartments', (c) => {
  const block = c.req.query('block')
  const bolim = parseInt(c.req.query('bolim'))
  const floor = parseInt(c.req.query('floor'))
  if (!block || isNaN(bolim) || isNaN(floor)) return c.json({ error: 'block, bolim, floor required' }, 400)
  return c.json(q.apartments.all({ block, bolim, floor }))
})

app.get('/apartments/booking', requireAuth, (c) => {
  const aptId = c.req.query('id')
  if (!aptId) return c.json({ error: 'id required' }, 400)
  const row = q.aptBookings.get({ apartment_id: aptId })
  if (!row) return c.json(null)
  return c.json({ id: row.id, user_id: row.user_id, ism: row.ism, manager_name: row.manager_name, created_at: row.created_at, type: row.type })
})

app.get('/apartments/:id/pair', requireAuth, (c) => {
  const id = c.req.param('id')
  const row = q.pairByApt.get(id, id)
  if (!row) return c.json(null)
  const partnerId = row.apartment_id_1 === id ? row.apartment_id_2 : row.apartment_id_1
  const partner = db.prepare("SELECT id AS address, size, status FROM apartments WHERE id=?").get(partnerId)
  return c.json(partner ?? null)
})

app.patch('/apartments/:id/status', requireAuth, async (c) => {
  const { sub: userId, role } = c.get('user')
  const id = c.req.param('id')
  const { status, reason } = await c.req.json()
  if (!['EMPTY', 'RESERVED', 'SOLD', 'NOT_SALE'].includes(status))
    return c.json({ error: "Status: EMPTY | RESERVED | SOLD | NOT_SALE" }, 400)
  if (status === 'NOT_SALE' && !reason?.trim())
    return c.json({ error: "NOT_SALE uchun sabab kiritish majburiy" }, 400)
  if (role !== 'admin') {
    if (status !== 'EMPTY') return c.json({ error: "Ruxsat yo'q" }, 403)
    const booking = db.prepare("SELECT user_id FROM bookings WHERE apartment_id=? AND cancelled_at IS NULL").get(id)
    if (!booking || booking.user_id !== userId) return c.json({ error: "Ruxsat yo'q" }, 403)
  }

  let tgMsgs = [], pairCancelledAptId = null
  db.exec('BEGIN')
  try {
    if (status === 'NOT_SALE') {
      q.updateStatusReason.run({ status, reason: reason.trim(), id })
    } else {
      q.updateStatus.run({ status, id })
      if (status === 'EMPTY') {
        const activeBooking = q.activeBookingByApt.get(id)
        if (activeBooking) {
          tgMsgs = q.tgMsgsByBooking.all(activeBooking.id)
          q.delTgMsgsByBooking.run(activeBooking.id)
          const fullBooking = db.prepare("SELECT pair_group_id FROM bookings WHERE id=?").get(activeBooking.id)
          if (fullBooking?.pair_group_id) {
            const partnerBooking = q.pairPartnerBooking.get(fullBooking.pair_group_id, activeBooking.id)
            if (partnerBooking) {
              tgMsgs = [...tgMsgs, ...q.tgMsgsByBooking.all(partnerBooking.id)]
              q.delTgMsgsByBooking.run(partnerBooking.id)
              q.cancelBooking.run({ apartment_id: partnerBooking.apartment_id })
              q.updateStatus.run({ status: 'EMPTY', id: partnerBooking.apartment_id })
              pairCancelledAptId = partnerBooking.apartment_id
            }
          }
        }
        q.cancelBooking.run({ apartment_id: id })
      }
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return c.json({ error: e.message }, 500)
  }

  if (tgMsgs.length > 0) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (token) {
      Promise.all(tgMsgs.map(({ chat_id, message_id }) =>
        proxiedFetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id, message_id }),
        }).catch(() => {})
      )).catch(() => {})
    }
  }
  broadcast('apartment', { id, status, not_sale_reason: status === 'NOT_SALE' ? reason.trim() : null })
  if (pairCancelledAptId) broadcast('apartment', { id: pairCancelledAptId, status: 'EMPTY', not_sale_reason: null })
  broadcast('booking', { cancelled: true })
  return c.json({ ok: true })
})

// ─── PRICES ───────────────��───────────────────────────────────────────────────

app.get('/prices', requireAuth, (c) => {
  const block = c.req.query('block')
  const bolim = parseInt(c.req.query('bolim'))
  const floor = parseInt(c.req.query('floor'))
  const isWc  = c.req.query('is_wc') === '1'
  if (!block || isNaN(bolim) || isNaN(floor)) return c.json({ error: 'block, bolim, floor required' }, 400)
  const row = isWc ? q.getWcPrice.get({ block, bolim, floor }) : q.getPrice.get({ block, bolim, floor })
  return c.json({ price: row?.price ?? (isWc ? 2000 : 1000) })
})

app.get('/prices/all', requireAuth, requireAdmin, (c) => {
  const isWc = c.req.query('is_wc') === '1'
  return c.json(isWc ? q.allWcPrices.all() : q.allPrices.all())
})

app.patch('/prices', requireAuth, requireAdmin, async (c) => {
  const { block, bolim, floor, price, isWc } = await c.req.json()
  if (!block || bolim == null || floor == null || price == null) return c.json({ error: 'block, bolim, floor, price required' }, 400)
  if (typeof price !== 'number' || price < 0) return c.json({ error: 'price must be non-negative number' }, 400)
  if (isWc) q.upsertWcPrice.run({ block, bolim: parseInt(bolim), floor: parseInt(floor), price })
  else      q.upsertPrice.run({ block, bolim: parseInt(bolim), floor: parseInt(floor), price })
  return c.json({ ok: true })
})

// ─── SALES LOCKS ────────────────────────────────────────────────────��────────

app.get('/sales-locks', requireAuth, (c) => c.json(q.allLocks.all()))

app.post('/sales-locks', requireAuth, requireAdmin, async (c) => {
  const { block, bolim, floor, reason } = await c.req.json()
  if (!block || bolim == null || floor == null) return c.json({ error: 'block, bolim, floor required' }, 400)
  if (!reason?.trim()) return c.json({ error: 'Sabab kiritish majburiy' }, 400)
  const user     = c.get('user')
  const locked_at = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
  q.upsertLock.run({ block: String(block).toUpperCase(), bolim: parseInt(bolim), floor: parseInt(floor), reason: reason.trim(), locked_at, locked_by: user?.name ?? 'Admin' })
  return c.json({ ok: true })
})

app.delete('/sales-locks', requireAuth, requireAdmin, async (c) => {
  const { block, bolim, floor } = await c.req.json()
  if (!block || bolim == null || floor == null) return c.json({ error: 'block, bolim, floor required' }, 400)
  q.deleteLock.run({ block: String(block).toUpperCase(), bolim: parseInt(bolim), floor: parseInt(floor) })
  return c.json({ ok: true })
})

// ─── SHOPS / WC ─────────────────────���──────────────────────────────��──────────

function buildFilteredQuery(c, extraWhere) {
  const block  = c.req.query('block')  || ''
  const bolim  = c.req.query('bolim')  || ''
  const floor  = c.req.query('floor')  || ''
  const status = c.req.query('status') || ''
  const search = c.req.query('search') || ''
  const limit  = Math.min(parseInt(c.req.query('limit')  || '50'), 100)
  const offset = parseInt(c.req.query('offset') || '0')
  const conditions = [extraWhere]
  const params = { limit, offset }
  if (block)  { conditions.push('a.block = :block');   params.block  = block }
  if (bolim)  { conditions.push('a.bolim = :bolim');   params.bolim  = parseInt(bolim) }
  if (floor)  { conditions.push('a.floor = :floor');   params.floor  = parseInt(floor) }
  if (status) { conditions.push('a.status = :status'); params.status = status }
  if (search) {
    conditions.push("(a.id LIKE :search OR CAST(a.bolim AS TEXT) LIKE :search OR CAST(a.floor AS TEXT) LIKE :search)")
    params.search = `%${search}%`
  }
  return { conditions, params, limit, offset }
}

app.get('/wc', requireAuth, (c) => {
  const { conditions, params } = buildFilteredQuery(c, 'a.is_wc = 1')
  const where = 'WHERE ' + conditions.join(' AND ')
  const { limit: _l, offset: _o, ...countParams } = params
  const total = db.prepare(`SELECT COUNT(*) AS n FROM apartments a ${where}`).get(countParams)?.n ?? 0
  const rows  = db.prepare(`
    SELECT a.id AS address, a.block, a.bolim, a.floor, a.size, a.status, a.not_sale_reason,
           a.is_wc, COALESCE(wp.price, 2000) AS price
    FROM apartments a
    LEFT JOIN wc_prices wp ON wp.block = a.block AND wp.bolim = a.bolim AND wp.floor = a.floor
    ${where}
    ORDER BY a.block, a.bolim, a.floor, a.id
    LIMIT :limit OFFSET :offset
  `).all(params)
  return c.json({ rows, total })
})

app.get('/shops', requireAuth, (c) => {
  const { conditions, params } = buildFilteredQuery(c, 'a.is_shop = 1')
  const where = 'WHERE ' + conditions.join(' AND ')
  const { limit: _l, offset: _o, ...countParams } = params
  const total = db.prepare(`SELECT COUNT(*) AS n FROM apartments a ${where}`).get(countParams)?.n ?? 0
  const rows  = db.prepare(`
    SELECT a.id AS address, a.block, a.bolim, a.floor, a.size, a.status, a.not_sale_reason,
           COALESCE(p.price, 1000) AS price
    FROM apartments a
    LEFT JOIN prices p ON p.block = a.block AND p.bolim = a.bolim AND p.floor = a.floor
    ${where}
    ORDER BY a.block, a.bolim, a.floor, a.id
    LIMIT :limit OFFSET :offset
  `).all(params)
  return c.json({ rows, total })
})

export default app
