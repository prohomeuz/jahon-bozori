#!/usr/bin/env node
// Bir martalik skript — SuperAdmin parolini o'zgartirish
// Ishlatish: node set-admin-password.js <yangi_parol>
// Misol:     node set-admin-password.js 19681009

import { DatabaseSync } from 'node:sqlite'
import { scryptSync, randomBytes } from 'node:crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const NEW_PASSWORD = process.argv[2]

if (!NEW_PASSWORD) {
  console.error('Xato: yangi parol berilmadi')
  console.error('Ishlatish: node set-admin-password.js <yangi_parol>')
  process.exit(1)
}

if (NEW_PASSWORD.length !== 8 || !/^\d+$/.test(NEW_PASSWORD)) {
  console.error('Xato: parol 8 ta raqamdan iborat bo\'lishi kerak')
  process.exit(1)
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const dbPath = process.env.DB_PATH ?? join(__dirname, '../db.sqlite')
console.log(`DB yo'li: ${dbPath}`)

const db = new DatabaseSync(dbPath)

const admin = db.prepare("SELECT id, username, plain_password FROM users WHERE role='admin'").get()
if (!admin) {
  console.error('Xato: admin foydalanuvchi topilmadi')
  process.exit(1)
}

console.log(`Admin topildi: id=${admin.id}, joriy_parol=${admin.plain_password}`)

const hashedPassword = hashPassword(NEW_PASSWORD)
db.prepare('UPDATE users SET username=?, password=?, plain_password=? WHERE id=?')
  .run(NEW_PASSWORD, hashedPassword, NEW_PASSWORD, admin.id)

console.log(`✓ Admin paroli muvaffaqiyatli o'zgartirildi: ${NEW_PASSWORD}`)
db.close()
