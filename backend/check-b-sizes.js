import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH ?? join(__dirname, '../db.sqlite')

console.log('DB path:', dbPath)

const db = new DatabaseSync(dbPath)

const total = db.prepare("SELECT COUNT(*) as n FROM apartments WHERE block='B' AND floor=2").get()
console.log('B blok 2-qavat jami:', total.n)

const b7_219 = db.prepare("SELECT id, size FROM apartments WHERE id='B-7-219'").get()
console.log('B-7-219:', b7_219 ?? 'TOPILMADI')

const b4_201 = db.prepare("SELECT id, size FROM apartments WHERE id='B-4-201'").get()
console.log('B-4-201:', b4_201 ?? 'TOPILMADI')

const sample = db.prepare("SELECT id, size FROM apartments WHERE block='B' AND floor=2 LIMIT 3").all()
console.log('Birinchi 3 ta:', sample)
