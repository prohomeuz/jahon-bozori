import 'dotenv/config'
import { db } from './src/db.js'
import BLOCKS from '../src/pages/bolim/config/blocks.js'

// D blok — do'konlar (1-5) + rastalar (6-18) ni qayta seed qiladi
db.exec("DELETE FROM apartments WHERE block='D'")
db.exec("DELETE FROM prices WHERE block='D'")

const insApt = db.prepare(
  "INSERT OR IGNORE INTO apartments (id, block, bolim, floor, size, status, is_shop) VALUES (?, 'D', ?, 1, ?, 'EMPTY', 1)"
)
const insPrice = db.prepare(
  "INSERT OR IGNORE INTO prices (block, bolim, floor, price) VALUES ('D', ?, 1, 1000)"
)

let total = 0
db.exec('BEGIN')
for (const [bolim, apts] of Object.entries(BLOCKS.D['1-FLOOR'])) {
  for (const apt of apts) {
    insApt.run(apt.address, parseInt(bolim), apt.size)
    total++
  }
  insPrice.run(parseInt(bolim))
}
db.exec('COMMIT')

console.log(`D blok: ${total} ta joy qo'shildi (do'kon 1-5 + 13 rasta)`)
