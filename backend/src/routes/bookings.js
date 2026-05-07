import { Hono } from 'hono'
import { db, q } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { broadcast } from '../lib/sse.js'
import { proxiedFetch, OWNER_CHAT_ID } from '../lib/telegram.js'

const app = new Hono()

app.get('/pair-group/:group_id', requireAuth, (c) => {
  const groupId = parseInt(c.req.param('group_id'))
  if (!groupId) return c.json([])
  return c.json(q.pairGroupBookings.all(groupId))
})

app.get('/apartment/:id', requireAuth, (c) => {
  return c.json(q.aptBookings.all({ apartment_id: c.req.param('id') }))
})

app.get('/', requireAuth, (c) => {
  const user      = c.get('user')
  const cancelled = c.req.query('cancelled') === '1'
  const limit     = Math.min(parseInt(c.req.query('limit')  ?? '50'), 100)
  const offset    = parseInt(c.req.query('offset') ?? '0')
  const search    = c.req.query('search') || ''
  const type      = c.req.query('type')   || ''
  const block     = c.req.query('block')  || ''
  const bolim     = c.req.query('bolim')  || ''
  const floor     = c.req.query('floor')  || ''
  const dateFrom  = c.req.query('from')   || ''
  const dateTo    = c.req.query('to')     || ''
  const managerId = c.req.query('manager') || ''
  const sourceId  = c.req.query('source')  || ''

  const dateField  = cancelled ? 'b.cancelled_at' : 'b.created_at'
  const conditions = [cancelled ? 'b.cancelled_at IS NOT NULL' : 'b.cancelled_at IS NULL']
  const params     = { limit, offset }

  if (user.role !== 'admin') { conditions.push('b.user_id = :user_id'); params.user_id = user.sub }
  else if (managerId)        { conditions.push('b.user_id = :manager_id'); params.manager_id = parseInt(managerId) }
  if (search) {
    conditions.push("(b.apartment_id LIKE :search OR b.ism LIKE :search OR b.familiya LIKE :search OR COALESCE(b.phone,'') LIKE :search)")
    params.search = `%${search}%`
  }
  if (type)     { conditions.push('b.type = :type');          params.type  = type }
  if (block)    { conditions.push('a.block = :block');        params.block = block }
  if (bolim)    { conditions.push('a.bolim = :bolim');        params.bolim = parseInt(bolim) }
  if (floor)    { conditions.push('a.floor = :floor');        params.floor = parseInt(floor) }
  if (dateFrom) { conditions.push(`${dateField} >= :dateFrom`); params.dateFrom = dateFrom }
  if (dateTo)   { conditions.push(`${dateField} <= :dateTo || ' 23:59:59'`); params.dateTo = dateTo }
  if (sourceId === 'none') { conditions.push('b.source_id IS NULL') }
  else if (sourceId)       { conditions.push('b.source_id = :source_id'); params.source_id = parseInt(sourceId) }

  const where = 'WHERE ' + conditions.join(' AND ')
  const { limit: _l, offset: _o, ...countParams } = params
  const total = db.prepare(`
    SELECT COUNT(*) AS n FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    LEFT JOIN apartments a ON a.id = b.apartment_id
    ${where}
  `).get(countParams)?.n ?? 0
  const rows = db.prepare(`
    SELECT b.*, u.name AS manager_name, s.name AS source_name, a.block, a.bolim, a.floor
    FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    LEFT JOIN sources s ON s.id = b.source_id
    LEFT JOIN apartments a ON a.id = b.apartment_id
    ${where}
    ORDER BY ${dateField} DESC
    LIMIT :limit OFFSET :offset
  `).all(params)
  return c.json({ rows, total })
})

app.post('/', requireAuth, async (c) => {
  const user = c.get('user')
  const {
    apartment_id, type, ism, familiya, boshlangich, oylar, umumiy,
    passport, manzil, phone, passport_place, narx_m2, chegirma_m2,
    asl_narx_m2, assigned_user_id, pair_with, source_id,
  } = await c.req.json()
  if (!apartment_id || !type || !ism || !familiya || !boshlangich || !oylar)
    return c.json({ error: "Majburiy maydonlar to'ldirilmagan" }, 400)

  const effective_user_id = assigned_user_id ? parseInt(assigned_user_id) : user.sub

  if (pair_with) {
    db.exec('BEGIN')
    try {
      const apt1 = db.prepare("SELECT block, bolim, floor, status, size FROM apartments WHERE id=?").get(apartment_id)
      if (!apt1) { db.exec('ROLLBACK'); return c.json({ error: "Do'kon topilmadi" }, 404) }
      if (apt1.status !== 'EMPTY') { db.exec('ROLLBACK'); return c.json({ error: "Do'kon allaqachon band" }, 409) }

      const apt2 = db.prepare("SELECT block, bolim, floor, status, size FROM apartments WHERE id=?").get(pair_with)
      if (!apt2) { db.exec('ROLLBACK'); return c.json({ error: "Juft do'kon topilmadi" }, 404) }
      if (apt2.status !== 'EMPTY') { db.exec('ROLLBACK'); return c.json({ error: "Juft do'kon allaqachon band" }, 409) }

      const pairRow = q.pairByApt.get(apartment_id, apartment_id)
      const expectedPartner = pairRow
        ? (pairRow.apartment_id_1 === apartment_id ? pairRow.apartment_id_2 : pairRow.apartment_id_1)
        : null
      if (expectedPartner !== pair_with) { db.exec('ROLLBACK'); return c.json({ error: "Bu do'konlar juft emas" }, 400) }

      const lock = db.prepare("SELECT reason FROM sales_locks WHERE block=? AND bolim=? AND floor=?").get(apt1.block, apt1.bolim, apt1.floor)
      if (lock) { db.exec('ROLLBACK'); return c.json({ error: `Sotuv to'xtatilgan: ${lock.reason}` }, 403) }

      const boshlangichNum = Number(String(boshlangich).replace(/\s/g, '')) || 0
      const half1 = Math.round(boshlangichNum / 2)
      const half2 = boshlangichNum - half1

      const narxM2Num    = Number(String(narx_m2   || '').replace(/\s/g, '')) || 0
      const chegirmaM2Num = Number(String(chegirma_m2 || '').replace(/\s/g, '')) || 0
      const yakuniyM2    = narxM2Num > 0 ? Math.max(0, narxM2Num - chegirmaM2Num) : 0
      let umumiy1, umumiy2
      if (yakuniyM2 > 0) {
        umumiy1 = String(Math.round(yakuniyM2 * apt1.size))
        umumiy2 = String(Math.round(yakuniyM2 * apt2.size))
      } else if (umumiy) {
        const umumiyNum = Number(String(umumiy).replace(/\s/g, '')) || 0
        const u1 = Math.round(umumiyNum / 2)
        umumiy1 = String(u1)
        umumiy2 = String(umumiyNum - u1)
      } else {
        umumiy1 = null; umumiy2 = null
      }

      const newStatus    = type === 'sotish' ? 'SOLD' : 'RESERVED'
      const sharedFields = {
        user_id: effective_user_id, type, ism, familiya, oylar: parseInt(oylar),
        passport: passport ?? null, manzil: manzil ?? null, phone: phone ?? null,
        passport_place: passport_place ?? null, narx_m2: narx_m2 ?? null,
        chegirma_m2: chegirma_m2 ?? null, asl_narx_m2: asl_narx_m2 ?? null,
        source_id: source_id ? parseInt(source_id) : null,
      }

      q.insertBooking.run({ ...sharedFields, apartment_id, boshlangich: String(half1), umumiy: umumiy1 })
      const booking1 = q.lastBooking.get()
      db.prepare("UPDATE bookings SET pair_group_id=? WHERE id=?").run(booking1.id, booking1.id)

      q.insertBooking.run({ ...sharedFields, apartment_id: pair_with, boshlangich: String(half2), umumiy: umumiy2 })
      const booking2 = q.lastBooking.get()
      db.prepare("UPDATE bookings SET pair_group_id=? WHERE id=?").run(booking1.id, booking2.id)

      q.updateStatus.run({ status: newStatus, id: apartment_id })
      q.updateStatus.run({ status: newStatus, id: pair_with })

      db.exec('COMMIT')

      broadcast('apartment', { id: apartment_id, status: newStatus })
      broadcast('apartment', { id: pair_with, status: newStatus })
      broadcast('booking', {
        id: booking1.id, apartment_id, type: type === 'sotish' ? 'Sotish' : 'Bron',
        ism: booking1.ism, familiya: booking1.familiya, manager: booking1.manager_name ?? '',
      })

      return c.json({ ...booking1, pair_group_id: booking1.id, pair_booking: { ...booking2, pair_group_id: booking1.id } }, 201)
    } catch (e) {
      db.exec('ROLLBACK')
      return c.json({ error: e.message }, 500)
    }
  }

  db.exec('BEGIN')
  try {
    const apt = db.prepare("SELECT block, bolim, floor, status FROM apartments WHERE id=?").get(apartment_id)
    if (!apt) { db.exec('ROLLBACK'); return c.json({ error: "Do'kon topilmadi" }, 404) }
    if (apt.status !== 'EMPTY') { db.exec('ROLLBACK'); return c.json({ error: "Do'kon allaqachon band yoki sotilgan" }, 409) }
    const lock = db.prepare("SELECT reason FROM sales_locks WHERE block=? AND bolim=? AND floor=?").get(apt.block, apt.bolim, apt.floor)
    if (lock) { db.exec('ROLLBACK'); return c.json({ error: `Sotuv to'xtatilgan: ${lock.reason}` }, 403) }
    q.insertBooking.run({
      apartment_id, user_id: effective_user_id, type, ism, familiya,
      boshlangich, oylar: parseInt(oylar), umumiy: umumiy ?? null,
      passport: passport ?? null, manzil: manzil ?? null, phone: phone ?? null,
      passport_place: passport_place ?? null, narx_m2: narx_m2 ?? null,
      chegirma_m2: chegirma_m2 ?? null, asl_narx_m2: asl_narx_m2 ?? null,
      source_id: source_id ? parseInt(source_id) : null,
    })
    const newStatus = type === 'sotish' ? 'SOLD' : 'RESERVED'
    q.updateStatus.run({ status: newStatus, id: apartment_id })
    const booking = q.lastBooking.get()
    db.exec('COMMIT')
    broadcast('apartment', { id: apartment_id, status: newStatus })
    broadcast('booking', {
      id: booking.id, apartment_id, type: type === 'sotish' ? 'Sotish' : 'Bron',
      ism: booking.ism, familiya: booking.familiya, manager: booking.manager_name ?? booking.username ?? '',
    })
    return c.json(booking, 201)
  } catch (e) {
    db.exec('ROLLBACK')
    return c.json({ error: e.message }, 500)
  }
})

app.patch('/:id/convert', requireAuth, async (c) => {
  const { sub: userId, role } = c.get('user')
  const id = parseInt(c.req.param('id'))
  const booking = db.prepare(
    'SELECT b.*, a.block, a.bolim, a.floor FROM bookings b JOIN apartments a ON a.id=b.apartment_id WHERE b.id=? AND b.cancelled_at IS NULL'
  ).get(id)
  if (!booking) return c.json({ error: 'Topilmadi' }, 404)
  if (booking.type !== 'bron') return c.json({ error: "Faqat bron qilingan do'konni sotishga o'tkazish mumkin" }, 400)
  if (booking.user_id !== userId && role !== 'admin') return c.json({ error: "Ruxsat yo'q" }, 403)
  const lock = db.prepare("SELECT reason FROM sales_locks WHERE block=? AND bolim=? AND floor=?").get(booking.block, booking.bolim, booking.floor)
  if (lock) return c.json({ error: `Sotuv to'xtatilgan: ${lock.reason}` }, 403)

  const { passport, passport_place, manzil } = await c.req.json().catch(() => ({}))
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE bookings SET type=?, passport=COALESCE(?,passport), passport_place=COALESCE(?,passport_place), manzil=COALESCE(?,manzil) WHERE id=?')
      .run('sotish', passport || null, passport_place || null, manzil || null, id)
    db.prepare("UPDATE apartments SET status='SOLD' WHERE id=?").run(booking.apartment_id)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return c.json({ error: e.message }, 500)
  }
  broadcast('apartment', { id: booking.apartment_id, status: 'SOLD' })
  broadcast('booking', { updated: true })
  return c.json({ ok: true })
})

app.patch('/bulk-source', requireAuth, requireAdmin, async (c) => {
  const { ids, source_id } = await c.req.json()
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'ids kerak' }, 400)
  const sid  = source_id ? parseInt(source_id) : null
  const stmt = db.prepare('UPDATE bookings SET source_id=? WHERE id=?')
  db.exec('BEGIN')
  try {
    for (const id of ids) stmt.run(sid, id)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return c.json({ error: e.message }, 500)
  }
  return c.json({ ok: true, updated: ids.length })
})

app.post('/send-pdf', requireAuth, async (c) => {
  const formData    = await c.req.formData()
  const file        = formData.get('pdf')
  const bookingId   = parseInt(formData.get('booking_id'))
  const pairBookingId = parseInt(formData.get('pair_booking_id') || '0') || null
  if (!file || !bookingId) return c.json({ error: 'pdf va booking_id kerak' }, 400)

  const booking = q.bookingById.get({ id: bookingId })
  if (!booking) return c.json({ error: 'Topilmadi' }, 404)

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return c.json({ ok: true })

  const aptInfo  = db.prepare('SELECT is_wc FROM apartments WHERE id=?').get(booking.apartment_id)
  const unitLabel = aptInfo?.is_wc ? 'Hojatxona' : "Do'kon"

  const fmtMoney = (val) => {
    const n = Number(String(val ?? '').replace(/\s/g, ''))
    if (!n) return String(val ?? '')
    return n.toLocaleString('ru-RU').replace(/,/g, ' ') + ' USD'
  }

  let aptIdLabel = booking.apartment_id
  let totalBoshlangich = booking.boshlangich
  if (pairBookingId) {
    const pairBooking = q.bookingById.get({ id: pairBookingId })
    if (pairBooking) {
      const [,,apt1] = booking.apartment_id.split('-')
      const [,,apt2] = pairBooking.apartment_id.split('-')
      const [lo, hi] = [Number(apt1), Number(apt2)].sort((a, b) => a - b)
      aptIdLabel = `${booking.apartment_id.split('-').slice(0,2).join('-')}-${lo}/${hi}`
      const b1 = Number(String(booking.boshlangich).replace(/\s/g,'')) || 0
      const b2 = Number(String(pairBooking.boshlangich).replace(/\s/g,'')) || 0
      totalBoshlangich = String(b1 + b2)
    }
  }

  const caption = `🟡 <b>Bron</b>\n` +
    `🏢 <b>${unitLabel}:</b> ${aptIdLabel}\n` +
    `👤 <b>Mijoz:</b> ${booking.ism} ${booking.familiya}\n` +
    (booking.phone ? `📞 <b>Telefon:</b> ${booking.phone}\n` : '') +
    `💰 <b>Boshlang'ich:</b> ${fmtMoney(totalBoshlangich)}\n` +
    `📅 <b>Muddat:</b> ${booking.oylar} oy\n` +
    `🤵 <b>Manager:</b> ${booking.manager_name ?? ''}`

  const buffer   = Buffer.from(await file.arrayBuffer())
  const filename = `${booking.ism} ${booking.familiya} - shartnoma-${aptIdLabel.replace('/', '_')}.pdf`

  async function sendDoc(chatId) {
    const fd = new FormData()
    fd.append('chat_id',  String(chatId))
    fd.append('document', new Blob([buffer], { type: 'application/pdf' }), filename)
    fd.append('caption',  caption)
    fd.append('parse_mode', 'HTML')
    try {
      const res  = await proxiedFetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!json.ok) {
        console.error('[sendDoc] Telegram xato:', JSON.stringify(json), 'chatId:', chatId)
        if (json.error_code === 403 || json.error_code === 400) {
          db.prepare('DELETE FROM telegram_subscribers WHERE chat_id=?').run(String(chatId))
        }
      } else {
        console.log('[sendDoc] OK → chatId:', chatId)
        if (json.result?.message_id) {
          try { q.saveTgMsg.run(bookingId, String(chatId), json.result.message_id) } catch {}
          if (pairBookingId) {
            try { q.saveTgMsg.run(pairBookingId, String(chatId), json.result.message_id) } catch {}
          }
        }
      }
    } catch (e) {
      console.error('[sendDoc] fetch xato:', e?.message, 'chatId:', chatId)
    }
  }

  const targets = new Set()
  if (OWNER_CHAT_ID) targets.add(String(OWNER_CHAT_ID))
  const subscribers = q.allSubscribers.all()
  console.log('[send-pdf] subscribers:', subscribers.length)
  for (const sub of subscribers) targets.add(sub.chat_id)

  await Promise.all([...targets].map(chatId => sendDoc(chatId)))
  console.log('[send-pdf] yuborildi:', targets.size, 'ta')
  return c.json({ ok: true })
})

export default app
