import { DatabaseSync } from 'node:sqlite'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const dbPath = process.env.DB_PATH ?? join(__dirname, '../../db.sqlite')
export const db = new DatabaseSync(dbPath)

db.exec(`PRAGMA journal_mode = WAL`)
db.exec(`PRAGMA foreign_keys = ON`)
db.exec(`PRAGMA synchronous = NORMAL`)   // WAL bilan crash-safe, FULLdan tezroq
db.exec(`PRAGMA cache_size = -32000`)    // 32MB page cache
db.exec(`PRAGMA busy_timeout = 5000`)    // parallel yozuvda 5s kutadi, xato bermaydi
// Startup checkpointi — WAL faylni asosiy DBga ko'chirib, faylni nolga tushiradi
db.exec(`PRAGMA wal_checkpoint(TRUNCATE)`)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL CHECK(role IN ('admin', 'salesmanager')),
    name       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+5 hours'))
  );

  CREATE TABLE IF NOT EXISTS apartments (
    id      TEXT PRIMARY KEY,
    block   TEXT NOT NULL,
    bolim   INTEGER NOT NULL,
    floor   INTEGER NOT NULL,
    size    REAL NOT NULL,
    status  TEXT NOT NULL DEFAULT 'EMPTY',
    notes   TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    apartment_id TEXT NOT NULL REFERENCES apartments(id),
    user_id      INTEGER REFERENCES users(id),
    type         TEXT NOT NULL CHECK(type IN ('bron', 'sotish')),
    ism          TEXT NOT NULL,
    familiya     TEXT NOT NULL,
    boshlangich  TEXT NOT NULL,
    oylar        INTEGER NOT NULL,
    passport     TEXT,
    manzil       TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now', '+5 hours'))
  );
`)

// Add telegram_id to users if missing (migration)
try { db.exec(`ALTER TABLE users ADD COLUMN telegram_id TEXT`) } catch {}
// Add plain_password to users if missing (migration)
try { db.exec(`ALTER TABLE users ADD COLUMN plain_password TEXT`) } catch {}
// Add user_id to bookings if missing (migration)
try { db.exec(`ALTER TABLE bookings ADD COLUMN user_id INTEGER REFERENCES users(id)`) } catch {}
// Add notes to apartments if missing (migration)
try { db.exec(`ALTER TABLE apartments ADD COLUMN notes TEXT`) } catch {}
// Add cancelled_at to bookings if missing (migration)
try { db.exec(`ALTER TABLE bookings ADD COLUMN cancelled_at TEXT`) } catch {}
// Add phone and passport_place to bookings if missing (migration)
try { db.exec(`ALTER TABLE bookings ADD COLUMN phone TEXT`) } catch {}
try { db.exec(`ALTER TABLE bookings ADD COLUMN passport_place TEXT`) } catch {}
// Add umumiy to bookings if missing (migration)
try { db.exec(`ALTER TABLE bookings ADD COLUMN umumiy TEXT`) } catch {}
// Add narx_m2 to bookings if missing (migration)
try { db.exec(`ALTER TABLE bookings ADD COLUMN narx_m2 TEXT`) } catch {}
// Prices table — har bir block/bolim/floor uchun narx (USD/m²)
try {
  db.exec(`CREATE TABLE IF NOT EXISTS prices (
    block TEXT NOT NULL,
    bolim INTEGER NOT NULL,
    floor INTEGER NOT NULL,
    price REAL NOT NULL DEFAULT 1000,
    PRIMARY KEY (block, bolim, floor)
  )`)
  // Mavjud bo'lmagan (block,bolim,floor) kombinatsiyalari uchun 1000$ seed
  db.exec(`INSERT OR IGNORE INTO prices (block, bolim, floor, price)
    SELECT DISTINCT block, bolim, floor, 1000 FROM apartments`)
} catch {}
// Telegram subscribers — /start bosgan har kim
try { db.exec(`CREATE TABLE IF NOT EXISTS telegram_subscribers (chat_id TEXT PRIMARY KEY, first_name TEXT, joined_at TEXT NOT NULL DEFAULT (datetime('now', '+5 hours')))`) } catch {}
// Backup metadata — oxirgi yuborilgan backup message_id va chat_id
try { db.exec(`CREATE TABLE IF NOT EXISTS backup_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`) } catch {}
// Translate Chinese notes → Uzbek
try { db.exec(`UPDATE apartments SET notes = 'Ko''cha bo''yi'           WHERE notes = '临街铺'`) } catch {}
try { db.exec(`UPDATE apartments SET notes = 'Ko''cha bo''yi'           WHERE notes = '临街商铺'`) } catch {}
try { db.exec(`UPDATE apartments SET notes = 'Hojatxona'               WHERE notes = '卫生间'`) } catch {}
try { db.exec(`UPDATE apartments SET notes = 'Burchak'                  WHERE notes = '端头路口'`) } catch {}
try { db.exec(`UPDATE apartments SET notes = 'Ko''cha bo''yi, Burchak'  WHERE notes = '临街铺、端头路口'`) } catch {}
try { db.exec(`UPDATE apartments SET notes = 'Ko''cha bo''yi, Burchak'  WHERE notes = '临街商铺、端头路口'`) } catch {}

export const q = {
  // users
  userByPlainPassword: db.prepare('SELECT * FROM users WHERE plain_password=:plain_password'),
  userById:            db.prepare('SELECT id, role, name, created_at FROM users WHERE id=:id'),
  insertUser:          db.prepare("INSERT INTO users (username, password, plain_password, role, name, telegram_id, created_at) VALUES (:plain_password, :password, :plain_password, :role, :name, NULL, datetime('now', '+5 hours'))"),
  allUsers:            db.prepare("SELECT id, name, plain_password, role, created_at FROM users WHERE role='salesmanager' ORDER BY created_at DESC"),
  userTelegramId:      db.prepare('SELECT telegram_id FROM users WHERE id=:id'),

  // telegram subscribers
  upsertSubscriber:  db.prepare("INSERT OR REPLACE INTO telegram_subscribers (chat_id, first_name) VALUES (:chat_id, :first_name)"),
  allSubscribers:    db.prepare("SELECT chat_id FROM telegram_subscribers"),

  // apartments
  apartments:   db.prepare('SELECT id AS address, size, status, notes FROM apartments WHERE block=:block AND bolim=:bolim AND floor=:floor ORDER BY id'),
  bolims:       db.prepare('SELECT DISTINCT bolim FROM apartments WHERE block=:block ORDER BY bolim'),
  updateStatus: db.prepare('UPDATE apartments SET status=:status WHERE id=:id'),
  count:        db.prepare('SELECT COUNT(*) AS n FROM apartments'),

  // bookings
  insertBooking:  db.prepare("INSERT INTO bookings (apartment_id,user_id,type,ism,familiya,boshlangich,oylar,umumiy,passport,manzil,phone,passport_place,narx_m2,created_at) VALUES (:apartment_id,:user_id,:type,:ism,:familiya,:boshlangich,:oylar,:umumiy,:passport,:manzil,:phone,:passport_place,:narx_m2,datetime('now', '+5 hours'))"),
  lastBooking:    db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.id=last_insert_rowid()'),
  bookingById:    db.prepare('SELECT b.*, u.telegram_id AS manager_tg_id, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.id=:id'),
  allBookings:    db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.cancelled_at IS NULL ORDER BY b.created_at DESC LIMIT :limit OFFSET :offset'),
  allCancelled:   db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.cancelled_at IS NOT NULL ORDER BY b.cancelled_at DESC LIMIT :limit OFFSET :offset'),
  myBookings:     db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.user_id=:user_id AND b.cancelled_at IS NULL ORDER BY b.created_at DESC LIMIT :limit OFFSET :offset'),
  myCancelled:    db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.user_id=:user_id AND b.cancelled_at IS NOT NULL ORDER BY b.cancelled_at DESC LIMIT :limit OFFSET :offset'),
  aptBookings:    db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.apartment_id=:apartment_id ORDER BY b.created_at DESC'),
  cancelBooking:  db.prepare("UPDATE bookings SET cancelled_at=datetime('now', '+5 hours') WHERE apartment_id=:apartment_id AND cancelled_at IS NULL"),

  // dashboard stats
  statsAll:       db.prepare("SELECT block, status, COUNT(*) AS n FROM apartments GROUP BY block, status"),
  blockStats:     db.prepare("SELECT status, COUNT(*) AS n FROM apartments WHERE block=:block GROUP BY status"),
  bolimStats:     db.prepare("SELECT status, COUNT(*) AS n FROM apartments WHERE block=:block AND bolim=:bolim GROUP BY status"),
  statsUser:      db.prepare("SELECT type, COUNT(*) AS n FROM bookings WHERE user_id=:user_id GROUP BY type"),
  bookingsCount:  db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE user_id=:user_id'),
  totalBookings:  db.prepare('SELECT COUNT(*) AS n FROM bookings'),

  // detailed stats
  statsByBolim:    db.prepare("SELECT block, bolim, status, COUNT(*) AS n FROM apartments GROUP BY block, bolim, status ORDER BY block, bolim"),
  statsByFloor:    db.prepare("SELECT block, floor, status, COUNT(*) AS n FROM apartments GROUP BY block, floor, status ORDER BY block, floor"),
  bookingsByDate:  db.prepare("SELECT date(created_at) AS date, block, COUNT(*) AS n FROM bookings b JOIN apartments a ON a.id=b.apartment_id WHERE b.cancelled_at IS NULL GROUP BY date, block ORDER BY date ASC LIMIT 180"),
  managerStats:    db.prepare(`
    SELECT u.id, u.name,
      SUM(CASE WHEN b.type='sotish' THEN 1 ELSE 0 END) AS sotish,
      SUM(CASE WHEN b.type='bron'   THEN 1 ELSE 0 END) AS bron,
      COUNT(*) AS total,
      MAX(b.created_at) AS last_at
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    WHERE b.cancelled_at IS NULL
      AND (:from = '' OR b.created_at >= :from)
      AND (:to   = '' OR b.created_at <= :to || ' 23:59:59')
    GROUP BY b.user_id
    ORDER BY total DESC
  `),
  // prices
  getPrice:        db.prepare("SELECT price FROM prices WHERE block=:block AND bolim=:bolim AND floor=:floor"),
  upsertPrice:     db.prepare("INSERT OR REPLACE INTO prices (block, bolim, floor, price) VALUES (:block, :bolim, :floor, :price)"),
  allPrices:       db.prepare("SELECT block, bolim, floor, price FROM prices ORDER BY block, bolim, floor"),

  totalByBlock:    db.prepare("SELECT COUNT(*) AS n FROM apartments WHERE block=:block"),
  snapshotByBlock: db.prepare(`
    SELECT
      SUM(CASE WHEN b.type='sotish' AND b.created_at <= :endDate AND (b.cancelled_at IS NULL OR b.cancelled_at > :endDate) THEN 1 ELSE 0 END) AS sold,
      SUM(CASE WHEN b.type='bron'   AND b.created_at <= :endDate AND (b.cancelled_at IS NULL OR b.cancelled_at > :endDate) THEN 1 ELSE 0 END) AS reserved
    FROM bookings b
    JOIN apartments a ON a.id = b.apartment_id
    WHERE a.block = :block
  `),
}
