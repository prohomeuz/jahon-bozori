import 'dotenv/config'
import { db, q } from './src/db.js'
import { hashPassword } from './src/auth.js'
import BLOCKS from '../src/pages/bolim/config/blocks.js'

const { n } = q.count.get()
if (n > 0) {
  console.log(`DB already seeded (${n} apartments). Skipping.`)
  process.exit(0)
}

const insert = db.prepare(
  'INSERT OR IGNORE INTO apartments (id, block, bolim, floor, size, status) VALUES (:id, :block, :bolim, :floor, :size, :status)'
)

db.exec('BEGIN')
let total = 0
for (const [block, floors] of Object.entries(BLOCKS)) {
  for (const [floorKey, bolims] of Object.entries(floors)) {
    const floor = floorKey === '1-FLOOR' ? 1 : 2
    for (const [bolim, apts] of Object.entries(bolims)) {
      for (const apt of apts) {
        insert.run({ id: apt.address, block, bolim: parseInt(bolim), floor, size: parseFloat(apt.size) || 0, status: apt.status ?? 'EMPTY' })
        total++
      }
    }
  }
}
db.exec('COMMIT')

console.log(`Seeded ${total} apartments.`)

// Default admin user
try {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD
  if (!adminPassword) throw new Error('ADMIN_DEFAULT_PASSWORD not set in .env')
  q.insertUser.run({ username: adminUsername, password: hashPassword(adminPassword), role: 'admin', name: 'Admin', telegram_id: null })
  console.log(`Admin user created: ${adminUsername}`)
} catch { console.log('Admin user already exists.') }
