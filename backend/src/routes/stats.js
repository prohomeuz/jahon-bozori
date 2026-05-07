import { Hono } from 'hono'
import { q } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'

const app = new Hono()

// ─── DASHBOARD — GET /api/dashboard ─────────────────────────────────────────

app.get('/dashboard', requireAuth, (c) => {
  const user = c.get('user')

  function buildBlocks(rows) {
    const blocks = {}
    const total  = { SOLD: 0, RESERVED: 0, EMPTY: 0, NOT_SALE: 0 }
    for (const row of rows) {
      if (!blocks[row.block]) blocks[row.block] = { SOLD: 0, RESERVED: 0, EMPTY: 0, NOT_SALE: 0 }
      blocks[row.block][row.status] = row.n
      total[row.status] = (total[row.status] || 0) + row.n
    }
    return { blocks, total }
  }

  const { blocks: shopBlocks, total: shopTotal } = buildBlocks(q.statsShops.all())
  const { blocks: wcBlocks,   total: wcTotal   } = buildBlocks(q.statsWc.all())

  if (user.role === 'admin') {
    const bookings = q.allBookings.all({ limit: 20, offset: 0 })
    const totalB   = q.totalBookings.get()
    return c.json({ shopBlocks, wcBlocks, shopTotal, wcTotal, bookings, totalBookings: totalB.n })
  }

  const myStats    = q.statsUser.all({ user_id: user.sub })
  const myTotal    = q.bookingsCount.get({ user_id: user.sub })
  const bookings   = q.myBookings.all({ user_id: user.sub, limit: 20, offset: 0 })
  const myStatsMap = Object.fromEntries(myStats.map(r => [r.type, r.n]))
  return c.json({ shopBlocks, wcBlocks, shopTotal, wcTotal, bookings, myStats: myStatsMap, totalBookings: myTotal.n })
})

// ─── STATS — GET /api/stats ──────────────────────────────────────────────────

app.get('/stats', requireAuth, (c) => {
  function pivot(rows, groupKey) {
    const map = {}
    for (const r of rows) {
      const key = r.block + '|' + r[groupKey]
      if (!map[key]) map[key] = { block: r.block, [groupKey]: r[groupKey], SOLD: 0, RESERVED: 0, EMPTY: 0, NOT_SALE: 0 }
      map[key][r.status] = r.n
    }
    return Object.values(map)
  }
  return c.json({
    byBolim:      pivot(q.statsByBolim.all(),      'bolim'),
    byBolimShops: pivot(q.statsByBolimShops.all(), 'bolim'),
    byBolimWc:    pivot(q.statsByBolimWc.all(),    'bolim'),
    byFloor:      pivot(q.statsByFloor.all(),      'floor'),
    byFloorShops: pivot(q.statsByFloorShops.all(), 'floor'),
    byFloorWc:    pivot(q.statsByFloorWc.all(),    'floor'),
    byDate:       q.bookingsByDate.all(),
  })
})

app.get('/stats/managers', requireAuth, (c) => {
  const from = c.req.query('from') ?? ''
  const to   = c.req.query('to')   ?? ''
  return c.json(q.managerStats.all({ from, to }))
})

app.get('/stats/snapshot', requireAuth, (c) => {
  const block   = c.req.query('block') ?? 'A'
  const date    = c.req.query('date')  ?? new Date().toISOString().slice(0, 10)
  const endDate = date + ' 23:59:59'
  const snap    = q.snapshotByBlock.get({ block, endDate })
  const total   = q.totalByBlock.get({ block })?.n ?? 0
  const sold     = snap?.sold     ?? 0
  const reserved = snap?.reserved ?? 0
  return c.json({ sold, reserved, empty: total - sold - reserved, total, date, block })
})

app.get('/stats/sources', requireAuth, requireAdmin, (c) => {
  const from      = c.req.query('from') || ''
  const to        = c.req.query('to')   || ''
  const cancelled = c.req.query('cancelled') === '1' ? 1 : 0
  const rows      = q.sourceStats.all({ from, to, cancelled })
  const nullRow   = q.nullSourceCount.get({ from, to, cancelled })
  return c.json({ rows, noSource: nullRow?.n ?? 0 })
})

export default app
