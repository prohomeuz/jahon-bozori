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
// Add chegirma_m2 and asl_narx_m2 to bookings if missing (migration)
try { db.exec(`ALTER TABLE bookings ADD COLUMN chegirma_m2 TEXT`) } catch {}
try { db.exec(`ALTER TABLE bookings ADD COLUMN asl_narx_m2 TEXT`) } catch {}
// Add not_sale_reason to apartments if missing (migration)
try { db.exec(`ALTER TABLE apartments ADD COLUMN not_sale_reason TEXT`) } catch {}
// Add is_active to users if missing (migration)
try { db.exec(`ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`) } catch {}
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
// WC narxlar jadvali — hojatxonalar uchun alohida narx (default 2000 $/m²)
try {
  db.exec(`CREATE TABLE IF NOT EXISTS wc_prices (
    block TEXT NOT NULL,
    bolim INTEGER NOT NULL,
    floor INTEGER NOT NULL,
    price REAL NOT NULL DEFAULT 2000,
    PRIMARY KEY (block, bolim, floor)
  )`)
  db.exec(`INSERT OR IGNORE INTO wc_prices (block, bolim, floor, price)
    SELECT DISTINCT block, bolim, floor, 2000 FROM apartments WHERE is_wc=1`)
} catch {}
// Telegram subscribers — /start bosgan har kim
try { db.exec(`CREATE TABLE IF NOT EXISTS telegram_subscribers (chat_id TEXT PRIMARY KEY, first_name TEXT, joined_at TEXT NOT NULL DEFAULT (datetime('now', '+5 hours')))`) } catch {}
// Backup metadata — oxirgi yuborilgan backup message_id va chat_id
try { db.exec(`CREATE TABLE IF NOT EXISTS backup_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`) } catch {}
// Sales locks — block/bolim/floor darajasida sotuv to'xtatish
try { db.exec(`CREATE TABLE IF NOT EXISTS sales_locks (block TEXT NOT NULL, bolim INTEGER NOT NULL, floor INTEGER NOT NULL, reason TEXT NOT NULL, locked_at TEXT NOT NULL, locked_by TEXT NOT NULL, PRIMARY KEY (block, bolim, floor))`) } catch {}

// Telegram yuborilgan xabarlar — bekor qilinganda o'chirish uchun
try { db.exec(`CREATE TABLE IF NOT EXISTS telegram_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL
)`) } catch {}

// apartment_pairs — juft do'konlar (B va C blok, 883 juft)
try { db.exec(`CREATE TABLE IF NOT EXISTS apartment_pairs (
  apartment_id_1 TEXT NOT NULL,
  apartment_id_2 TEXT NOT NULL,
  PRIMARY KEY (apartment_id_1, apartment_id_2)
)`) } catch {}
// pair_group_id on bookings — birgalikda bron qilingan do'konlarni birlashtiradi
try { db.exec(`ALTER TABLE bookings ADD COLUMN pair_group_id INTEGER`) } catch {}
// Sources — mijoz qayerdan kelganini belgilaydi
try { db.exec(`CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+5 hours'))
)`) } catch {}
try { db.exec(`ALTER TABLE sources ADD COLUMN position INTEGER`) } catch {}
try { db.exec(`UPDATE sources SET position = id WHERE position IS NULL`) } catch {}
// source_id on bookings
try { db.exec(`ALTER TABLE bookings ADD COLUMN source_id INTEGER REFERENCES sources(id)`) } catch {}
// Seed juft do'konlar (B va C bloklar, 1 va 2 qavatlar)
try { db.exec(`INSERT OR IGNORE INTO apartment_pairs (apartment_id_1, apartment_id_2) VALUES
('B-1-101','B-1-102'),('B-1-103','B-1-104'),('B-1-107','B-1-108'),('B-1-109','B-1-110'),('B-1-111','B-1-112'),
('B-1-114','B-1-115'),('B-1-116','B-1-117'),('B-1-118','B-1-119'),('B-1-120','B-1-121'),('B-1-122','B-1-123'),
('B-1-124','B-1-125'),('B-1-126','B-1-127'),('B-1-132','B-1-133'),('B-1-134','B-1-135'),('B-1-136','B-1-137'),
('B-1-138','B-1-139'),('B-1-140','B-1-141'),('B-1-142','B-1-143'),
('B-2-101','B-2-102'),('B-2-103','B-2-104'),('B-2-105','B-2-106'),('B-2-107','B-2-108'),('B-2-109','B-2-110'),
('B-2-111','B-2-112'),('B-2-113','B-2-114'),('B-2-115','B-2-116'),('B-2-117','B-2-118'),('B-2-119','B-2-120'),
('B-2-121','B-2-122'),('B-2-123','B-2-124'),('B-2-125','B-2-126'),('B-2-127','B-2-128'),('B-2-129','B-2-130'),
('B-2-131','B-2-132'),('B-2-133','B-2-134'),('B-2-135','B-2-136'),
('B-3-101','B-3-102'),('B-3-103','B-3-104'),('B-3-105','B-3-106'),('B-3-107','B-3-108'),('B-3-110','B-3-111'),
('B-3-112','B-3-113'),('B-3-114','B-3-115'),('B-3-117','B-3-118'),('B-3-119','B-3-120'),('B-3-121','B-3-122'),
('B-3-123','B-3-124'),('B-3-125','B-3-126'),('B-3-127','B-3-128'),('B-3-129','B-3-130'),('B-3-131','B-3-132'),
('B-3-136','B-3-137'),('B-3-138','B-3-139'),('B-3-140','B-3-141'),('B-3-142','B-3-143'),
('B-4-101','B-4-102'),('B-4-103','B-4-104'),('B-4-105','B-4-106'),('B-4-107','B-4-108'),('B-4-109','B-4-110'),
('B-4-112','B-4-113'),('B-4-114','B-4-115'),('B-4-116','B-4-117'),('B-4-118','B-4-119'),('B-4-120','B-4-121'),
('B-4-122','B-4-123'),('B-4-124','B-4-125'),('B-4-126','B-4-127'),('B-4-128','B-4-129'),('B-4-130','B-4-131'),
('B-4-132','B-4-133'),('B-4-134','B-4-135'),('B-4-136','B-4-137'),('B-4-138','B-4-139'),
('B-5-101','B-5-102'),('B-5-103','B-5-104'),('B-5-105','B-5-106'),('B-5-107','B-5-108'),('B-5-110','B-5-111'),
('B-5-112','B-5-113'),('B-5-114','B-5-115'),('B-5-116','B-5-117'),('B-5-118','B-5-119'),('B-5-120','B-5-121'),
('B-5-122','B-5-123'),('B-5-124','B-5-125'),('B-5-126','B-5-127'),('B-5-128','B-5-129'),('B-5-130','B-5-131'),
('B-5-132','B-5-133'),('B-5-134','B-5-135'),
('B-6-101','B-6-102'),('B-6-103','B-6-104'),('B-6-105','B-6-106'),('B-6-107','B-6-108'),('B-6-109','B-6-110'),
('B-6-111','B-6-112'),('B-6-113','B-6-114'),('B-6-116','B-6-117'),('B-6-119','B-6-120'),('B-6-121','B-6-122'),
('B-6-123','B-6-124'),('B-6-125','B-6-126'),('B-6-127','B-6-128'),('B-6-129','B-6-130'),('B-6-132','B-6-133'),
('B-6-134','B-6-135'),('B-6-136','B-6-137'),
('B-7-101','B-7-102'),('B-7-103','B-7-104'),('B-7-105','B-7-106'),('B-7-107','B-7-108'),('B-7-109','B-7-110'),
('B-7-112','B-7-113'),('B-7-114','B-7-115'),('B-7-116','B-7-117'),('B-7-118','B-7-119'),('B-7-120','B-7-121'),
('B-7-122','B-7-123'),('B-7-124','B-7-125'),('B-7-126','B-7-127'),('B-7-128','B-7-129'),('B-7-131','B-7-132'),
('B-7-133','B-7-134'),('B-7-135','B-7-136'),('B-7-137','B-7-138'),
('B-8-101','B-8-102'),('B-8-103','B-8-104'),('B-8-105','B-8-106'),('B-8-107','B-8-108'),('B-8-110','B-8-111'),
('B-8-112','B-8-113'),('B-8-114','B-8-115'),('B-8-116','B-8-117'),('B-8-118','B-8-119'),('B-8-120','B-8-121'),
('B-8-122','B-8-123'),('B-8-124','B-8-125'),('B-8-129','B-8-130'),('B-8-131','B-8-132'),('B-8-133','B-8-134'),
('B-8-135','B-8-136'),
('B-9-101','B-9-102'),('B-9-103','B-9-104'),('B-9-105','B-9-106'),('B-9-107','B-9-108'),('B-9-109','B-9-110'),
('B-9-111','B-9-112'),('B-9-113','B-9-114'),('B-9-115','B-9-116'),('B-9-117','B-9-118'),('B-9-119','B-9-120'),
('B-9-121','B-9-122'),('B-9-123','B-9-124'),('B-9-125','B-9-126'),('B-9-128','B-9-129'),
('B-10-101','B-10-102'),('B-10-103','B-10-104'),('B-10-105','B-10-106'),('B-10-107','B-10-108'),('B-10-109','B-10-110'),
('B-10-111','B-10-112'),('B-10-113','B-10-114'),('B-10-115','B-10-116'),('B-10-117','B-10-118'),('B-10-119','B-10-120'),
('B-10-121','B-10-122'),('B-10-123','B-10-124'),('B-10-125','B-10-126'),('B-10-127','B-10-128'),('B-10-129','B-10-130'),
('B-10-132','B-10-133'),('B-10-134','B-10-135'),('B-10-136','B-10-137'),('B-10-138','B-10-139'),
('B-11-101','B-11-102'),('B-11-103','B-11-104'),('B-11-105','B-11-106'),('B-11-107','B-11-108'),('B-11-109','B-11-110'),
('B-11-111','B-11-112'),('B-11-113','B-11-114'),('B-11-115','B-11-116'),('B-11-117','B-11-118'),('B-11-119','B-11-120'),
('B-11-121','B-11-122'),('B-11-123','B-11-124'),('B-11-125','B-11-126'),('B-11-128','B-11-129'),('B-11-130','B-11-131'),
('B-11-132','B-11-133'),('B-11-134','B-11-135'),
('B-12-101','B-12-102'),('B-12-103','B-12-104'),('B-12-105','B-12-106'),('B-12-107','B-12-108'),('B-12-110','B-12-111'),
('B-12-112','B-12-113'),('B-12-114','B-12-115'),('B-12-116','B-12-117'),('B-12-118','B-12-119'),('B-12-120','B-12-121'),
('B-12-122','B-12-123'),('B-12-124','B-12-125'),('B-12-126','B-12-127'),('B-12-128','B-12-129'),('B-12-131','B-12-132'),
('B-12-133','B-12-134'),('B-12-135','B-12-136'),
('B-13-101','B-13-102'),('B-13-103','B-13-104'),('B-13-105','B-13-106'),('B-13-107','B-13-108'),('B-13-109','B-13-110'),
('B-13-112','B-13-113'),('B-13-114','B-13-115'),('B-13-116','B-13-117'),('B-13-118','B-13-119'),('B-13-120','B-13-121'),
('B-13-122','B-13-123'),('B-13-125','B-13-126'),('B-13-127','B-13-128'),('B-13-129','B-13-130'),('B-13-131','B-13-132'),
('B-1-201','B-1-204'),('B-1-202','B-1-203'),('B-1-205','B-1-206'),('B-1-209','B-1-210'),('B-1-211','B-1-212'),
('B-1-213','B-1-214'),('B-1-216','B-1-217'),('B-1-218','B-1-219'),('B-1-220','B-1-221'),('B-1-222','B-1-223'),
('B-1-224','B-1-225'),('B-1-226','B-1-229'),('B-1-227','B-1-228'),('B-1-230','B-1-231'),('B-1-235','B-1-236'),
('B-1-237','B-1-238'),('B-1-239','B-1-240'),('B-1-241','B-1-242'),
('B-2-201','B-2-202'),('B-2-203','B-2-204'),('B-2-205','B-2-206'),('B-2-207','B-2-208'),('B-2-209','B-2-210'),
('B-2-211','B-2-212'),('B-2-213','B-2-214'),('B-2-215','B-2-216'),('B-2-217','B-2-218'),('B-2-219','B-2-220'),
('B-2-222','B-2-223'),('B-2-224','B-2-225'),('B-2-226','B-2-227'),('B-2-228','B-2-229'),('B-2-230','B-2-231'),
('B-2-233','B-2-234'),
('B-3-201','B-3-204'),('B-3-202','B-3-203'),('B-3-205','B-3-206'),('B-3-207','B-3-208'),('B-3-209','B-3-210'),
('B-3-212','B-3-213'),('B-3-214','B-3-215'),('B-3-216','B-3-217'),('B-3-219','B-3-220'),('B-3-221','B-3-222'),
('B-3-223','B-3-224'),('B-3-225','B-3-228'),('B-3-226','B-3-227'),('B-3-230','B-3-231'),('B-3-232','B-3-233'),
('B-3-237','B-3-238'),('B-3-239','B-3-240'),
('B-4-201','B-4-202'),('B-4-203','B-4-204'),('B-4-205','B-4-206'),('B-4-207','B-4-208'),('B-4-209','B-4-210'),
('B-4-212','B-4-213'),('B-4-214','B-4-215'),('B-4-216','B-4-217'),('B-4-218','B-4-219'),('B-4-220','B-4-221'),
('B-4-222','B-4-223'),('B-4-224','B-4-225'),('B-4-226','B-4-227'),('B-4-228','B-4-229'),('B-4-230','B-4-231'),
('B-4-232','B-4-233'),('B-4-234','B-4-235'),('B-4-236','B-4-237'),('B-4-238','B-4-239'),
('B-5-201','B-5-202'),('B-5-203','B-5-204'),('B-5-205','B-5-206'),('B-5-207','B-5-208'),('B-5-210','B-5-211'),
('B-5-212','B-5-213'),('B-5-214','B-5-215'),('B-5-216','B-5-217'),('B-5-218','B-5-219'),('B-5-220','B-5-221'),
('B-5-222','B-5-223'),('B-5-224','B-5-225'),('B-5-226','B-5-227'),('B-5-228','B-5-229'),('B-5-230','B-5-231'),
('B-5-232','B-5-233'),('B-5-234','B-5-235'),
('B-6-201','B-6-202'),('B-6-203','B-6-204'),('B-6-205','B-6-206'),('B-6-207','B-6-208'),('B-6-209','B-6-210'),
('B-6-211','B-6-212'),('B-6-213','B-6-214'),('B-6-216','B-6-217'),('B-6-219','B-6-220'),('B-6-221','B-6-222'),
('B-6-223','B-6-224'),('B-6-225','B-6-226'),('B-6-227','B-6-228'),('B-6-229','B-6-230'),('B-6-232','B-6-233'),
('B-6-234','B-6-235'),
('B-7-201','B-7-202'),('B-7-203','B-7-204'),('B-7-205','B-7-206'),('B-7-207','B-7-208'),('B-7-209','B-7-210'),
('B-7-212','B-7-213'),('B-7-214','B-7-215'),('B-7-216','B-7-217'),('B-7-218','B-7-219'),('B-7-220','B-7-221'),
('B-7-222','B-7-223'),('B-7-224','B-7-225'),('B-7-226','B-7-227'),('B-7-228','B-7-229'),('B-7-231','B-7-232'),
('B-7-233','B-7-234'),('B-7-235','B-7-236'),('B-7-237','B-7-238'),
('B-8-201','B-8-202'),('B-8-203','B-8-204'),('B-8-205','B-8-206'),('B-8-207','B-8-208'),('B-8-210','B-8-211'),
('B-8-212','B-8-213'),('B-8-214','B-8-215'),('B-8-216','B-8-217'),('B-8-218','B-8-219'),('B-8-220','B-8-221'),
('B-8-222','B-8-223'),('B-8-224','B-8-225'),('B-8-227','B-8-228'),('B-8-229','B-8-230'),('B-8-231','B-8-232'),
('B-8-233','B-8-234'),
('B-9-201','B-9-202'),('B-9-203','B-9-204'),('B-9-205','B-9-206'),('B-9-207','B-9-208'),('B-9-209','B-9-210'),
('B-9-211','B-9-212'),('B-9-213','B-9-214'),('B-9-216','B-9-217'),('B-9-218','B-9-219'),('B-9-220','B-9-221'),
('B-9-222','B-9-223'),('B-9-224','B-9-225'),('B-9-227','B-9-228'),
('B-10-201','B-10-202'),('B-10-203','B-10-204'),('B-10-205','B-10-206'),('B-10-207','B-10-208'),('B-10-209','B-10-210'),
('B-10-211','B-10-212'),('B-10-213','B-10-214'),('B-10-215','B-10-216'),('B-10-217','B-10-218'),('B-10-219','B-10-220'),
('B-10-221','B-10-222'),('B-10-223','B-10-224'),('B-10-225','B-10-226'),('B-10-227','B-10-228'),('B-10-229','B-10-230'),
('B-10-232','B-10-233'),('B-10-234','B-10-235'),('B-10-236','B-10-237'),('B-10-238','B-10-239'),
('B-11-201','B-11-202'),('B-11-203','B-11-204'),('B-11-205','B-11-206'),('B-11-207','B-11-208'),('B-11-209','B-11-210'),
('B-11-211','B-11-212'),('B-11-213','B-11-214'),('B-11-215','B-11-216'),('B-11-217','B-11-218'),('B-11-219','B-11-220'),
('B-11-221','B-11-222'),('B-11-223','B-11-224'),('B-11-225','B-11-226'),('B-11-228','B-11-229'),('B-11-230','B-11-231'),
('B-11-232','B-11-233'),('B-11-234','B-11-235'),
('B-12-201','B-12-202'),('B-12-203','B-12-204'),('B-12-205','B-12-206'),('B-12-207','B-12-208'),('B-12-210','B-12-211'),
('B-12-212','B-12-213'),('B-12-214','B-12-215'),('B-12-216','B-12-217'),('B-12-218','B-12-219'),('B-12-220','B-12-221'),
('B-12-222','B-12-223'),('B-12-224','B-12-225'),('B-12-226','B-12-227'),('B-12-228','B-12-229'),('B-12-231','B-12-232'),
('B-12-233','B-12-234'),('B-12-235','B-12-236'),
('B-13-201','B-13-202'),('B-13-203','B-13-204'),('B-13-205','B-13-206'),('B-13-207','B-13-208'),('B-13-209','B-13-210'),
('B-13-212','B-13-213'),('B-13-214','B-13-215'),('B-13-216','B-13-217'),('B-13-218','B-13-219'),('B-13-220','B-13-221'),
('B-13-222','B-13-223'),('B-13-225','B-13-226'),('B-13-227','B-13-228'),('B-13-229','B-13-230'),('B-13-231','B-13-232'),
('C-1-101','C-1-102'),('C-1-103','C-1-104'),('C-1-105','C-1-106'),('C-1-107','C-1-108'),('C-1-110','C-1-111'),
('C-1-112','C-1-113'),('C-1-114','C-1-115'),('C-1-117','C-1-118'),('C-1-119','C-1-120'),('C-1-121','C-1-122'),
('C-1-123','C-1-124'),('C-1-125','C-1-126'),('C-1-127','C-1-128'),('C-1-129','C-1-130'),('C-1-131','C-1-132'),
('C-1-136','C-1-137'),('C-1-138','C-1-139'),('C-1-140','C-1-141'),('C-1-142','C-1-143'),
('C-2-101','C-2-102'),('C-2-103','C-2-104'),('C-2-105','C-2-106'),('C-2-107','C-2-108'),('C-2-109','C-2-110'),
('C-2-111','C-2-112'),('C-2-113','C-2-114'),('C-2-115','C-2-116'),('C-2-117','C-2-118'),('C-2-119','C-2-120'),
('C-2-121','C-2-122'),('C-2-123','C-2-124'),('C-2-125','C-2-126'),('C-2-127','C-2-128'),('C-2-129','C-2-130'),
('C-2-131','C-2-132'),('C-2-133','C-2-134'),('C-2-135','C-2-136'),
('C-3-101','C-3-102'),('C-3-103','C-3-104'),('C-3-105','C-3-106'),('C-3-107','C-3-108'),('C-3-109','C-3-110'),
('C-3-111','C-3-112'),('C-3-114','C-3-115'),('C-3-116','C-3-117'),('C-3-118','C-3-119'),('C-3-122','C-3-123'),
('C-3-124','C-3-125'),('C-3-126','C-3-127'),('C-3-128','C-3-129'),('C-3-130','C-3-131'),('C-3-132','C-3-133'),
('C-3-134','C-3-135'),('C-3-136','C-3-137'),('C-3-143','C-3-144'),
('C-4-101','C-4-102'),('C-4-103','C-4-104'),('C-4-105','C-4-106'),('C-4-107','C-4-108'),('C-4-110','C-4-111'),
('C-4-112','C-4-113'),('C-4-114','C-4-115'),('C-4-116','C-4-117'),('C-4-118','C-4-119'),('C-4-120','C-4-121'),
('C-4-122','C-4-123'),('C-4-124','C-4-125'),('C-4-126','C-4-127'),('C-4-128','C-4-129'),('C-4-130','C-4-131'),
('C-4-132','C-4-133'),('C-4-134','C-4-135'),('C-4-136','C-4-137'),('C-4-138','C-4-139'),
('C-5-101','C-5-102'),('C-5-103','C-5-104'),('C-5-105','C-5-106'),('C-5-107','C-5-108'),('C-5-110','C-5-111'),
('C-5-112','C-5-113'),('C-5-114','C-5-115'),('C-5-116','C-5-117'),('C-5-118','C-5-119'),('C-5-120','C-5-121'),
('C-5-122','C-5-123'),('C-5-124','C-5-125'),('C-5-126','C-5-127'),('C-5-128','C-5-129'),('C-5-130','C-5-131'),
('C-5-132','C-5-133'),('C-5-134','C-5-135'),
('C-6-101','C-6-102'),('C-6-103','C-6-104'),('C-6-105','C-6-106'),('C-6-107','C-6-108'),('C-6-109','C-6-110'),
('C-6-111','C-6-112'),('C-6-114','C-6-115'),('C-6-116','C-6-117'),('C-6-118','C-6-119'),('C-6-120','C-6-121'),
('C-6-122','C-6-123'),('C-6-124','C-6-125'),('C-6-126','C-6-127'),('C-6-128','C-6-129'),('C-6-130','C-6-131'),
('C-6-132','C-6-133'),('C-6-135','C-6-136'),
('C-7-101','C-7-102'),('C-7-103','C-7-104'),('C-7-105','C-7-106'),('C-7-107','C-7-108'),('C-7-110','C-7-111'),
('C-7-112','C-7-113'),('C-7-114','C-7-115'),('C-7-116','C-7-117'),('C-7-118','C-7-119'),('C-7-120','C-7-121'),
('C-7-122','C-7-123'),('C-7-124','C-7-125'),('C-7-126','C-7-127'),('C-7-129','C-7-130'),('C-7-131','C-7-132'),
('C-7-133','C-7-134'),('C-7-135','C-7-136'),('C-7-137','C-7-138'),
('C-8-101','C-8-102'),('C-8-103','C-8-104'),('C-8-105','C-8-106'),('C-8-107','C-8-108'),('C-8-110','C-8-111'),
('C-8-112','C-8-113'),('C-8-114','C-8-115'),('C-8-116','C-8-117'),('C-8-118','C-8-119'),('C-8-120','C-8-121'),
('C-8-122','C-8-123'),('C-8-124','C-8-125'),('C-8-127','C-8-128'),('C-8-129','C-8-130'),('C-8-131','C-8-132'),
('C-8-133','C-8-134'),
('C-9-101','C-9-102'),('C-9-103','C-9-104'),('C-9-105','C-9-106'),('C-9-107','C-9-108'),('C-9-109','C-9-110'),
('C-9-112','C-9-113'),('C-9-115','C-9-116'),('C-9-117','C-9-118'),('C-9-119','C-9-120'),('C-9-121','C-9-122'),
('C-9-123','C-9-124'),('C-9-125','C-9-126'),('C-9-127','C-9-128'),('C-9-129','C-9-130'),
('C-10-101','C-10-102'),('C-10-103','C-10-104'),('C-10-105','C-10-106'),('C-10-107','C-10-108'),('C-10-109','C-10-110'),
('C-10-111','C-10-112'),('C-10-113','C-10-114'),('C-10-115','C-10-116'),('C-10-117','C-10-118'),('C-10-119','C-10-120'),
('C-10-121','C-10-122'),('C-10-123','C-10-124'),('C-10-125','C-10-126'),('C-10-127','C-10-128'),('C-10-130','C-10-131'),
('C-10-132','C-10-133'),('C-10-134','C-10-135'),('C-10-136','C-10-137'),('C-10-138','C-10-139'),
('C-11-101','C-11-102'),('C-11-103','C-11-104'),('C-11-105','C-11-106'),('C-11-107','C-11-108'),('C-11-109','C-11-110'),
('C-11-111','C-11-112'),('C-11-113','C-11-114'),('C-11-115','C-11-116'),('C-11-117','C-11-118'),('C-11-119','C-11-120'),
('C-11-121','C-11-122'),('C-11-123','C-11-124'),('C-11-125','C-11-126'),('C-11-128','C-11-129'),('C-11-130','C-11-131'),
('C-11-132','C-11-133'),('C-11-134','C-11-135'),
('C-12-101','C-12-102'),('C-12-103','C-12-104'),('C-12-105','C-12-106'),('C-12-107','C-12-108'),('C-12-109','C-12-110'),
('C-12-112','C-12-113'),('C-12-114','C-12-115'),('C-12-116','C-12-117'),('C-12-118','C-12-119'),('C-12-120','C-12-121'),
('C-12-122','C-12-123'),('C-12-124','C-12-125'),('C-12-127','C-12-128'),('C-12-129','C-12-130'),('C-12-131','C-12-132'),
('C-12-133','C-12-134'),('C-12-135','C-12-136'),
('C-13-101','C-13-102'),('C-13-103','C-13-104'),('C-13-105','C-13-106'),('C-13-108','C-13-109'),('C-13-110','C-13-111'),
('C-13-112','C-13-113'),('C-13-114','C-13-115'),('C-13-116','C-13-117'),('C-13-118','C-13-119'),('C-13-120','C-13-121'),
('C-13-122','C-13-123'),('C-13-124','C-13-125'),('C-13-127','C-13-128'),('C-13-129','C-13-130'),('C-13-131','C-13-132'),
('C-1-201','C-1-204'),('C-1-202','C-1-203'),('C-1-205','C-1-206'),('C-1-207','C-1-208'),('C-1-209','C-1-210'),
('C-1-212','C-1-213'),('C-1-214','C-1-215'),('C-1-216','C-1-217'),('C-1-219','C-1-220'),('C-1-221','C-1-222'),
('C-1-223','C-1-224'),('C-1-225','C-1-228'),('C-1-226','C-1-227'),('C-1-230','C-1-231'),('C-1-232','C-1-233'),
('C-1-237','C-1-238'),('C-1-239','C-1-240'),
('C-2-201','C-2-202'),('C-2-203','C-2-204'),('C-2-205','C-2-206'),('C-2-207','C-2-208'),('C-2-209','C-2-210'),
('C-2-211','C-2-212'),('C-2-213','C-2-214'),('C-2-215','C-2-216'),('C-2-217','C-2-218'),('C-2-219','C-2-220'),
('C-2-222','C-2-223'),('C-2-224','C-2-225'),('C-2-226','C-2-227'),('C-2-228','C-2-229'),('C-2-230','C-2-231'),
('C-2-233','C-2-234'),
('C-3-201','C-3-204'),('C-3-202','C-3-203'),('C-3-205','C-3-206'),('C-3-207','C-3-208'),('C-3-209','C-3-210'),
('C-3-211','C-3-212'),('C-3-213','C-3-214'),('C-3-216','C-3-217'),('C-3-218','C-3-219'),('C-3-220','C-3-221'),
('C-3-224','C-3-225'),('C-3-226','C-3-229'),('C-3-227','C-3-228'),('C-3-231','C-3-232'),('C-3-233','C-3-234'),
('C-3-235','C-3-236'),('C-3-237','C-3-238'),
('C-4-201','C-4-202'),('C-4-203','C-4-204'),('C-4-205','C-4-206'),('C-4-207','C-4-208'),('C-4-210','C-4-211'),
('C-4-212','C-4-213'),('C-4-214','C-4-215'),('C-4-216','C-4-217'),('C-4-218','C-4-219'),('C-4-220','C-4-221'),
('C-4-222','C-4-223'),('C-4-224','C-4-225'),('C-4-226','C-4-227'),('C-4-228','C-4-229'),('C-4-230','C-4-231'),
('C-4-232','C-4-233'),('C-4-234','C-4-235'),('C-4-236','C-4-237'),('C-4-238','C-4-239'),
('C-5-201','C-5-202'),('C-5-203','C-5-204'),('C-5-205','C-5-206'),('C-5-207','C-5-208'),('C-5-210','C-5-211'),
('C-5-212','C-5-213'),('C-5-214','C-5-215'),('C-5-216','C-5-217'),('C-5-218','C-5-219'),('C-5-220','C-5-221'),
('C-5-222','C-5-223'),('C-5-224','C-5-225'),('C-5-226','C-5-227'),('C-5-228','C-5-229'),('C-5-230','C-5-231'),
('C-5-232','C-5-233'),('C-5-234','C-5-235'),
('C-6-201','C-6-202'),('C-6-203','C-6-204'),('C-6-205','C-6-206'),('C-6-207','C-6-208'),('C-6-209','C-6-210'),
('C-6-211','C-6-212'),('C-6-214','C-6-215'),('C-6-216','C-6-217'),('C-6-219','C-6-220'),('C-6-221','C-6-222'),
('C-6-223','C-6-224'),('C-6-225','C-6-226'),('C-6-227','C-6-228'),('C-6-229','C-6-230'),('C-6-231','C-6-232'),
('C-6-234','C-6-235'),
('C-7-201','C-7-202'),('C-7-203','C-7-204'),('C-7-205','C-7-206'),('C-7-207','C-7-208'),('C-7-210','C-7-211'),
('C-7-212','C-7-213'),('C-7-214','C-7-215'),('C-7-216','C-7-217'),('C-7-218','C-7-219'),('C-7-220','C-7-221'),
('C-7-222','C-7-223'),('C-7-224','C-7-225'),('C-7-226','C-7-227'),('C-7-229','C-7-230'),('C-7-231','C-7-232'),
('C-7-233','C-7-234'),('C-7-235','C-7-236'),('C-7-237','C-7-238'),
('C-8-201','C-8-202'),('C-8-203','C-8-204'),('C-8-205','C-8-206'),('C-8-207','C-8-208'),('C-8-210','C-8-211'),
('C-8-212','C-8-213'),('C-8-214','C-8-215'),('C-8-216','C-8-217'),('C-8-218','C-8-219'),('C-8-220','C-8-221'),
('C-8-222','C-8-223'),('C-8-224','C-8-225'),('C-8-227','C-8-228'),('C-8-229','C-8-230'),('C-8-231','C-8-232'),
('C-8-233','C-8-234'),
('C-9-201','C-9-202'),('C-9-203','C-9-204'),('C-9-205','C-9-206'),('C-9-207','C-9-208'),('C-9-209','C-9-210'),
('C-9-212','C-9-213'),('C-9-215','C-9-216'),('C-9-217','C-9-218'),('C-9-219','C-9-220'),('C-9-221','C-9-222'),
('C-9-223','C-9-224'),('C-9-225','C-9-226'),('C-9-227','C-9-228'),
('C-10-201','C-10-202'),('C-10-203','C-10-204'),('C-10-205','C-10-206'),('C-10-207','C-10-208'),('C-10-209','C-10-210'),
('C-10-211','C-10-212'),('C-10-213','C-10-214'),('C-10-215','C-10-216'),('C-10-217','C-10-218'),('C-10-219','C-10-220'),
('C-10-221','C-10-222'),('C-10-223','C-10-224'),('C-10-225','C-10-226'),('C-10-227','C-10-228'),('C-10-230','C-10-231'),
('C-10-232','C-10-233'),('C-10-234','C-10-235'),('C-10-236','C-10-237'),('C-10-238','C-10-239'),
('C-11-201','C-11-202'),('C-11-203','C-11-204'),('C-11-205','C-11-206'),('C-11-207','C-11-208'),('C-11-209','C-11-210'),
('C-11-211','C-11-212'),('C-11-213','C-11-214'),('C-11-215','C-11-216'),('C-11-217','C-11-218'),('C-11-219','C-11-220'),
('C-11-221','C-11-222'),('C-11-223','C-11-224'),('C-11-225','C-11-226'),('C-11-228','C-11-229'),('C-11-230','C-11-231'),
('C-11-232','C-11-233'),('C-11-234','C-11-235'),
('C-12-201','C-12-202'),('C-12-203','C-12-204'),('C-12-205','C-12-206'),('C-12-207','C-12-208'),('C-12-209','C-12-210'),
('C-12-212','C-12-213'),('C-12-214','C-12-215'),('C-12-216','C-12-217'),('C-12-218','C-12-219'),('C-12-220','C-12-221'),
('C-12-222','C-12-223'),('C-12-224','C-12-225'),('C-12-227','C-12-228'),('C-12-229','C-12-230'),('C-12-231','C-12-232'),
('C-12-233','C-12-234'),('C-12-235','C-12-236'),
('C-13-201','C-13-202'),('C-13-203','C-13-204'),('C-13-205','C-13-206'),('C-13-208','C-13-209'),('C-13-210','C-13-211'),
('C-13-212','C-13-213'),('C-13-214','C-13-215'),('C-13-216','C-13-217'),('C-13-218','C-13-219'),('C-13-220','C-13-221'),
('C-13-222','C-13-223'),('C-13-224','C-13-225'),('C-13-227','C-13-228'),('C-13-229','C-13-230'),('C-13-231','C-13-232')
`) } catch {}

// Performance indexes
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_apts_block_bolim_floor ON apartments(block, bolim, floor)`) } catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_apartment_id  ON bookings(apartment_id)`) } catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_user_id       ON bookings(user_id)`) } catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_at  ON bookings(cancelled_at)`) } catch {}
// is_shop — overlay config'da rect mavjud bo'lgan do'konlar (single source of truth)
try { db.exec(`ALTER TABLE apartments ADD COLUMN is_shop INTEGER NOT NULL DEFAULT 1`) } catch {}
try {
  db.exec(`UPDATE apartments SET is_shop = 0 WHERE id IN (
    'A-1-121','A-1-122','A-1-123',
    'A-1-215','A-1-216',
    'A-3-122','A-3-123','A-3-124',
    'A-3-222','A-3-223','A-3-224',
    'B-1-129','B-1-130','B-1-131',
    'B-1-233','B-1-234',
    'B-3-133','B-3-134','B-3-135',
    'B-3-234','B-3-235',
    'B-8-127','B-8-128',
    'C-1-133','C-1-134','C-1-135',
    'C-1-235','C-1-236',
    'C-3-138','C-3-139','C-3-140',
    'C-3-239','C-3-240'
  )`)
} catch {}
// is_wc — hojatxonalar (is_shop=0 bo'lsa ham o'chirilmaydi)
try { db.exec(`ALTER TABLE apartments ADD COLUMN is_wc INTEGER NOT NULL DEFAULT 0`) } catch {}
// Do'kon bo'lmagan va hojatxona ham bo'lmagan apartamentlarni o'chirish
try { db.exec(`DELETE FROM apartments WHERE is_shop = 0 AND is_wc = 0`) } catch {}
// 31 ta hojatxona yozuvlarini qo'shish
try {
  db.exec(`INSERT OR IGNORE INTO apartments (id, block, bolim, floor, size, status, is_shop, is_wc) VALUES
    ('A-1-121','A',1,1,14.41,'EMPTY',0,1),
    ('A-1-122','A',1,1,24.18,'EMPTY',0,1),
    ('A-1-123','A',1,1,19.45,'EMPTY',0,1),
    ('A-1-215','A',1,2,15.30,'EMPTY',0,1),
    ('A-1-216','A',1,2,23.34,'EMPTY',0,1),
    ('A-3-122','A',3,1, 8.10,'EMPTY',0,1),
    ('A-3-123','A',3,1,25.59,'EMPTY',0,1),
    ('A-3-124','A',3,1,19.19,'EMPTY',0,1),
    ('A-3-222','A',3,2, 8.05,'EMPTY',0,1),
    ('A-3-223','A',3,2,17.21,'EMPTY',0,1),
    ('A-3-224','A',3,2,18.44,'EMPTY',0,1),
    ('B-1-129','B',1,1,23.18,'EMPTY',0,1),
    ('B-1-130','B',1,1,28.46,'EMPTY',0,1),
    ('B-1-131','B',1,1, 5.34,'EMPTY',0,1),
    ('B-1-233','B',1,2,18.82,'EMPTY',0,1),
    ('B-1-234','B',1,2,25.84,'EMPTY',0,1),
    ('B-3-133','B',3,1,27.90,'EMPTY',0,1),
    ('B-3-134','B',3,1,23.18,'EMPTY',0,1),
    ('B-3-135','B',3,1, 5.14,'EMPTY',0,1),
    ('B-3-234','B',3,2,25.84,'EMPTY',0,1),
    ('B-3-235','B',3,2,18.59,'EMPTY',0,1),
    ('C-1-133','C',1,1,23.18,'EMPTY',0,1),
    ('C-1-134','C',1,1,27.90,'EMPTY',0,1),
    ('C-1-135','C',1,1, 5.14,'EMPTY',0,1),
    ('C-1-235','C',1,2,18.59,'EMPTY',0,1),
    ('C-1-236','C',1,2,25.84,'EMPTY',0,1),
    ('C-3-138','C',3,1,28.46,'EMPTY',0,1),
    ('C-3-139','C',3,1,23.18,'EMPTY',0,1),
    ('C-3-140','C',3,1, 5.34,'EMPTY',0,1),
    ('C-3-239','C',3,2,25.84,'EMPTY',0,1),
    ('C-3-240','C',3,2,18.82,'EMPTY',0,1)
  `)
} catch {}
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
  userById:            db.prepare('SELECT id, role, name, is_active, created_at FROM users WHERE id=:id'),
  insertUser:          db.prepare("INSERT INTO users (username, password, plain_password, role, name, telegram_id, created_at) VALUES (:plain_password, :password, :plain_password, :role, :name, NULL, datetime('now', '+5 hours'))"),
  allUsers:            db.prepare("SELECT id, name, plain_password, role, is_active, telegram_id, created_at FROM users WHERE role='salesmanager' ORDER BY created_at DESC"),
  userTelegramId:      db.prepare('SELECT telegram_id FROM users WHERE id=:id'),

  // telegram subscribers
  upsertSubscriber:  db.prepare("INSERT OR REPLACE INTO telegram_subscribers (chat_id, first_name) VALUES (:chat_id, :first_name)"),
  allSubscribers:    db.prepare("SELECT chat_id FROM telegram_subscribers"),

  // apartments
  apartments:         db.prepare('SELECT id AS address, size, status, is_wc, notes, not_sale_reason FROM apartments WHERE block=:block AND bolim=:bolim AND floor=:floor ORDER BY id'),
  bolims:             db.prepare('SELECT DISTINCT bolim FROM apartments WHERE block=:block ORDER BY bolim'),
  updateStatus:       db.prepare('UPDATE apartments SET status=:status, not_sale_reason=NULL WHERE id=:id'),
  updateStatusReason: db.prepare('UPDATE apartments SET status=:status, not_sale_reason=:reason WHERE id=:id'),
  count:              db.prepare('SELECT COUNT(*) AS n FROM apartments'),

  // sources
  allSources:       db.prepare("SELECT id, name, position, created_at FROM sources ORDER BY COALESCE(position, id) ASC"),
  insertSource:     db.prepare("INSERT INTO sources (name, position) VALUES (:name, (SELECT COALESCE(MAX(position), 0) + 1 FROM sources))"),
  updateSource:     db.prepare("UPDATE sources SET name=:name WHERE id=:id"),
  updateSourcePos:  db.prepare("UPDATE sources SET position=:position WHERE id=:id"),
  deleteSource:     db.prepare("DELETE FROM sources WHERE id=:id"),
  sourceStats:   db.prepare(`
    SELECT s.id, s.name, COUNT(b.id) AS n
    FROM sources s
    LEFT JOIN bookings b ON b.source_id = s.id
      AND (:cancelled = 1 OR b.cancelled_at IS NULL)
      AND (:from = '' OR b.created_at >= :from)
      AND (:to   = '' OR b.created_at <= :to || ' 23:59:59')
    GROUP BY s.id ORDER BY n DESC
  `),
  nullSourceCount: db.prepare(`
    SELECT COUNT(*) AS n FROM bookings b
    WHERE b.source_id IS NULL
      AND (:cancelled = 1 OR b.cancelled_at IS NULL)
      AND (:from = '' OR b.created_at >= :from)
      AND (:to   = '' OR b.created_at <= :to || ' 23:59:59')
  `),

  // bookings
  insertBooking:  db.prepare("INSERT INTO bookings (apartment_id,user_id,type,ism,familiya,boshlangich,oylar,umumiy,passport,manzil,phone,passport_place,narx_m2,chegirma_m2,asl_narx_m2,source_id,created_at) VALUES (:apartment_id,:user_id,:type,:ism,:familiya,:boshlangich,:oylar,:umumiy,:passport,:manzil,:phone,:passport_place,:narx_m2,:chegirma_m2,:asl_narx_m2,:source_id,datetime('now', '+5 hours'))"),
  lastBooking:    db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.id=last_insert_rowid()'),
  bookingById:    db.prepare('SELECT b.*, u.telegram_id AS manager_tg_id, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.id=:id'),
  allBookings:    db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.cancelled_at IS NULL ORDER BY b.created_at DESC LIMIT :limit OFFSET :offset'),
  allCancelled:   db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.cancelled_at IS NOT NULL ORDER BY b.cancelled_at DESC LIMIT :limit OFFSET :offset'),
  myBookings:     db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.user_id=:user_id AND b.cancelled_at IS NULL ORDER BY b.created_at DESC LIMIT :limit OFFSET :offset'),
  myCancelled:    db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.user_id=:user_id AND b.cancelled_at IS NOT NULL ORDER BY b.cancelled_at DESC LIMIT :limit OFFSET :offset'),
  aptBookings:    db.prepare('SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.apartment_id=:apartment_id ORDER BY b.created_at DESC'),
  cancelBooking:  db.prepare("UPDATE bookings SET cancelled_at=datetime('now', '+5 hours') WHERE apartment_id=:apartment_id AND cancelled_at IS NULL"),
  activeBookingByApt: db.prepare("SELECT id FROM bookings WHERE apartment_id=? AND cancelled_at IS NULL"),
  saveTgMsg:      db.prepare("INSERT INTO telegram_messages (booking_id, chat_id, message_id) VALUES (?, ?, ?)"),
  tgMsgsByBooking: db.prepare("SELECT chat_id, message_id FROM telegram_messages WHERE booking_id=?"),
  delTgMsgsByBooking: db.prepare("DELETE FROM telegram_messages WHERE booking_id=?"),

  // juft do'konlar
  pairByApt: db.prepare("SELECT apartment_id_1, apartment_id_2 FROM apartment_pairs WHERE apartment_id_1=? OR apartment_id_2=?"),
  pairPartnerBooking: db.prepare("SELECT b.id, b.apartment_id FROM bookings b WHERE b.pair_group_id=? AND b.id!=? AND b.cancelled_at IS NULL"),
  pairGroupBookings: db.prepare("SELECT b.*, u.name AS manager_name FROM bookings b LEFT JOIN users u ON b.user_id=u.id WHERE b.pair_group_id=? AND b.cancelled_at IS NULL"),

  // dashboard stats
  statsAll:       db.prepare("SELECT block, status, COUNT(*) AS n FROM apartments GROUP BY block, status"),
  statsShops:     db.prepare("SELECT block, status, COUNT(*) AS n FROM apartments WHERE is_shop=1 GROUP BY block, status"),
  statsWc:        db.prepare("SELECT block, status, COUNT(*) AS n FROM apartments WHERE is_wc=1 GROUP BY block, status"),
  blockStats:     db.prepare("SELECT status, COUNT(*) AS n FROM apartments WHERE block=:block GROUP BY status"),
  bolimStats:     db.prepare("SELECT status, COUNT(*) AS n FROM apartments WHERE block=:block AND bolim=:bolim GROUP BY status"),
  statsUser:      db.prepare("SELECT type, COUNT(*) AS n FROM bookings WHERE user_id=:user_id GROUP BY type"),
  bookingsCount:  db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE user_id=:user_id'),
  totalBookings:  db.prepare('SELECT COUNT(*) AS n FROM bookings'),

  // detailed stats
  statsByBolim:      db.prepare("SELECT block, bolim, status, COUNT(*) AS n FROM apartments GROUP BY block, bolim, status ORDER BY block, bolim"),
  statsByBolimShops: db.prepare("SELECT block, bolim, status, COUNT(*) AS n FROM apartments WHERE is_shop=1 GROUP BY block, bolim, status ORDER BY block, bolim"),
  statsByBolimWc:    db.prepare("SELECT block, bolim, status, COUNT(*) AS n FROM apartments WHERE is_wc=1 GROUP BY block, bolim, status ORDER BY block, bolim"),
  statsByFloor:      db.prepare("SELECT block, floor, status, COUNT(*) AS n FROM apartments GROUP BY block, floor, status ORDER BY block, floor"),
  statsByFloorShops: db.prepare("SELECT block, floor, status, COUNT(*) AS n FROM apartments WHERE is_shop=1 GROUP BY block, floor, status ORDER BY block, floor"),
  statsByFloorWc:    db.prepare("SELECT block, floor, status, COUNT(*) AS n FROM apartments WHERE is_wc=1 GROUP BY block, floor, status ORDER BY block, floor"),
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
  // sales locks
  allLocks:    db.prepare("SELECT block, bolim, floor, reason, locked_at, locked_by FROM sales_locks"),
  upsertLock:  db.prepare("INSERT OR REPLACE INTO sales_locks (block, bolim, floor, reason, locked_at, locked_by) VALUES (:block, :bolim, :floor, :reason, :locked_at, :locked_by)"),
  deleteLock:  db.prepare("DELETE FROM sales_locks WHERE block=:block AND bolim=:bolim AND floor=:floor"),

  // prices (do'konlar)
  getPrice:        db.prepare("SELECT price FROM prices WHERE block=:block AND bolim=:bolim AND floor=:floor"),
  upsertPrice:     db.prepare("INSERT OR REPLACE INTO prices (block, bolim, floor, price) VALUES (:block, :bolim, :floor, :price)"),
  allPrices:       db.prepare("SELECT block, bolim, floor, price FROM prices ORDER BY block, bolim, floor"),
  // wc narxlar
  getWcPrice:      db.prepare("SELECT price FROM wc_prices WHERE block=:block AND bolim=:bolim AND floor=:floor"),
  upsertWcPrice:   db.prepare("INSERT OR REPLACE INTO wc_prices (block, bolim, floor, price) VALUES (:block, :bolim, :floor, :price)"),
  allWcPrices:     db.prepare("SELECT block, bolim, floor, price FROM wc_prices ORDER BY block, bolim, floor"),

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
