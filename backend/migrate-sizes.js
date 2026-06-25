import 'dotenv/config'
import { db } from './src/db.js'

// B block 2-qavat uglovoy do'kon razmerlarini to'g'irlash
// Muammo: 2.44 (2440mm panel) va 3.51 (3510mm panel) - qurilish material o'lchamlari
// Yechim: arxitektura rejasidan olingan haqiqiy do'kon maydonlari (m²)
const CORRECTIONS = [
  { id: 'B-4-201',  size: 10.75 },
  { id: 'B-4-219',  size: 11.85 },
  { id: 'B-4-220',  size: 14.66 },
  { id: 'B-4-239',  size: 14.66 },
  { id: 'B-5-201',  size: 11.85 },
  { id: 'B-5-217',  size: 10.75 },
  { id: 'B-5-218',  size: 14.66 },
  { id: 'B-5-235',  size: 14.66 },
  { id: 'B-7-201',  size: 10.75 },
  { id: 'B-7-219',  size: 11.85 },
  { id: 'B-7-220',  size: 14.66 },
  { id: 'B-7-238',  size: 14.66 },
  { id: 'B-8-201',  size: 11.85 },
  { id: 'B-8-217',  size: 14.75 },
  { id: 'B-8-218',  size: 14.66 },
  { id: 'B-8-234',  size: 14.75 },
  { id: 'B-10-201', size: 14.66 },
  { id: 'B-10-220', size: 14.66 },
  { id: 'B-10-221', size: 10.75 },
  { id: 'B-10-239', size: 11.85 },
  { id: 'B-11-201', size: 14.66 },
  { id: 'B-11-218', size: 14.66 },
  { id: 'B-11-219', size: 11.85 },
  { id: 'B-11-235', size: 10.75 },
  { id: 'B-12-201', size: 14.95 },
  { id: 'B-12-219', size: 14.95 },
  { id: 'B-12-220', size: 14.95 },
  { id: 'B-12-236', size: 14.95 },
  { id: 'B-13-201', size: 14.95 },
  { id: 'B-13-217', size: 14.95 },
  { id: 'B-13-218', size: 14.95 },
  { id: 'B-13-232', size: 14.95 },
]

const update = db.prepare('UPDATE apartments SET size = :size WHERE id = :id')

let updated = 0
let notFound = 0

db.exec('BEGIN')
try {
  for (const { id, size } of CORRECTIONS) {
    const result = update.run({ id, size })
    if (result.changes > 0) {
      console.log(`✓ ${id}: size = ${size}`)
      updated++
    } else {
      console.log(`⚠ ${id}: topilmadi (skip)`)
      notFound++
    }
  }
  db.exec('COMMIT')
  console.log(`\nNatija: ${updated} ta yangilandi, ${notFound} ta topilmadi.`)
} catch (e) {
  db.exec('ROLLBACK')
  console.error('Xato:', e.message)
  process.exit(1)
}
