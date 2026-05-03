import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { db, q } from './db.js'
import { hashPassword, requireAuth } from './auth.js'
import { broadcast } from './lib/sse.js'
import { notifyBackupAll, setupTelegramWebhook, checkWebhookHealth } from './lib/telegram.js'

import authRoutes      from './routes/auth.js'
import usersRoutes     from './routes/users.js'
import apartmentRoutes from './routes/apartments.js'
import bookingRoutes   from './routes/bookings.js'
import sourceRoutes    from './routes/sources.js'
import statsRoutes     from './routes/stats.js'
import telegramRoutes  from './routes/telegram.js'

const app = new Hono()

app.use('/api/*', cors({
  origin: process.env.CORS_ORIGIN ?? process.env.WEBHOOK_DOMAIN ?? '*',
  credentials: false,
}))

// ─── ROUTES ──────────────────────────────────────────────────────────────────

app.route('/api/auth',      authRoutes)
app.route('/api/users',     usersRoutes)
app.route('/api',           apartmentRoutes)
app.route('/api/bookings',  bookingRoutes)
app.route('/api/sources',   sourceRoutes)
app.route('/api',           statsRoutes)
app.route('/api',           telegramRoutes)

// Legacy endpoint — manager dropdown uses /api/managers, not /api/users/managers
app.get('/api/managers', requireAuth, (c) => c.json(q.allUsers.all()))

app.get('/api/health', (c) => c.json({ ok: true }))

// ─── ADMIN SEED ──────────────────────────────────────────────────────────────
{
  const admin = db.prepare("SELECT id FROM users WHERE role='admin'").get()
  if (!admin) {
    const defaultPass = process.env.ADMIN_DEFAULT_PASSWORD ?? '00001111'
    db.prepare("INSERT INTO users (username, password, plain_password, role, name, telegram_id, created_at) VALUES (?,?,?,'admin',?,NULL,datetime('now','+5 hours'))")
      .run(defaultPass, hashPassword(defaultPass), defaultPass, 'Admin')
    console.log('[seed] Admin yaratildi')
  }
}

// ─── WORKING HOURS BROADCAST — aniq 20:00 da ─────────────────────────────────
function scheduleWorkEnd() {
  const now    = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }))
  const target = new Date(now)
  target.setHours(20, 0, 0, 0)
  let ms = target - now
  if (ms <= 0) ms += 24 * 60 * 60 * 1000
  setTimeout(() => {
    broadcast('working_hours_ended', { message: "Ish vaqti tugadi. Tizimdan chiqarilmoqdasiz." })
    scheduleWorkEnd()
  }, ms).unref()
}
scheduleWorkEnd()

// ─── BACKUP CRON — har 1 soatda ──────────────────────────────────────────────
setInterval(() => { notifyBackupAll().catch(console.error) }, 60 * 60_000).unref()

// ─── WEBHOOK HEALTH — har 30 daqiqada ────────────────────────────────────────
setInterval(() => { checkWebhookHealth().catch(console.error) }, 30 * 60_000).unref()

// ─── START ───────────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? '3001')
serve({ fetch: app.fetch, port })
console.log(`[backend] http://localhost:${port}`)
setupTelegramWebhook().catch(() => {})
