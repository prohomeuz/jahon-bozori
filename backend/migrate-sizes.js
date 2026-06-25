import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH ?? join(__dirname, '../db.sqlite')

console.log('DB path:', dbPath)

const db = new DatabaseSync(dbPath)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

const CORRECTIONS = [
  // B-4 bolim
  { id: 'B-4-201',  size: 10.65 },
  { id: 'B-4-219',  size: 11.92 },
  { id: 'B-4-220',  size: 14.49 },
  { id: 'B-4-239',  size: 14.75 },
  // B-5 bolim
  { id: 'B-5-201',  size: 11.92 },
  { id: 'B-5-217',  size: 10.65 },
  { id: 'B-5-218',  size: 14.75 },
  { id: 'B-5-235',  size: 14.49 },
  // B-7 bolim
  { id: 'B-7-201',  size: 14.49 },
  { id: 'B-7-219',  size: 11.92 },
  { id: 'B-7-220',  size: 14.49 },
  { id: 'B-7-238',  size: 14.75 },
  // B-8 bolim
  { id: 'B-8-201',  size: 11.92 },
  { id: 'B-8-217',  size: 14.49 },
  { id: 'B-8-218',  size: 14.75 },
  { id: 'B-8-234',  size: 14.49 },
  // B-10 bolim
  { id: 'B-10-201', size: 10.65 },
  { id: 'B-10-220', size: 11.92 },
  { id: 'B-10-221', size: 14.49 },
  { id: 'B-10-239', size: 14.75 },
  // B-11 bolim
  { id: 'B-11-201', size: 11.92 },
  { id: 'B-11-218', size: 10.65 },
  { id: 'B-11-219', size: 14.75 },
  { id: 'B-11-235', size: 14.49 },
  // B-12 bolim
  { id: 'B-12-201', size: 15.03 },
  { id: 'B-12-219', size: 12.20 },
  { id: 'B-12-220', size: 15.03 },
  { id: 'B-12-236', size: 15.03 },
  // B-13 bolim
  { id: 'B-13-201', size: 12.20 },
  { id: 'B-13-217', size: 15.15 },
  { id: 'B-13-218', size: 15.03 },
  { id: 'B-13-232', size: 15.15 },
]

// Avval DB dagi qiymatlarni ko'rsatamiz
console.log('\n--- HOZIRGI QIYMATLAR ---')
const check = db.prepare('SELECT id, size FROM apartments WHERE id = ?')
for (const { id } of CORRECTIONS) {
  const row = check.get(id)
  if (row) {
    console.log(`${id}: ${row.size}`)
  } else {
    console.log(`${id}: TOPILMADI`)
  }
}

// Yangilash
console.log('\n--- YANGILASH ---')
const update = db.prepare('UPDATE apartments SET size = ? WHERE id = ?')

let updated = 0
let notFound = 0

db.exec('BEGIN')
try {
  for (const { id, size } of CORRECTIONS) {
    const result = update.run(size, id)
    if (result.changes > 0) {
      console.log(`OK  ${id}: ${size}`)
      updated++
    } else {
      console.log(`--- ${id}: topilmadi`)
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
