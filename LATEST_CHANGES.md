# LATEST_CHANGES.md — Jahon Bozori

> Bu fayl loyihadagi **har bir o'zgarishni** qayd etib boradi.
> Har qanday o'zgarish — kichik bo'lsin, katta bo'lsin — bu yerga yoziladi.
> O'zgarish qilishdan oldin foydalanuvchidan ruxsat so'raladi.

---

## Qoidalar

- Har bir o'zgarish `## [YYYY-MM-DD] — Sarlavha` formatida yoziladi
- O'zgarish qilingan fayllar ro'yxati beriladi
- Nima uchun o'zgartirilgani izohlanadi
- Ruxsat bergan: foydalanuvchi nomi yoki "tasdiqlangan"

---

## Loyiha holati (2026-06-14 holatiga)

### Arxitektura
- **Frontend:** React 19 + Vite 8 + Tailwind CSS v4
- **Backend:** Node.js + Hono.js + SQLite
- **Deploy:** Docker + Nginx + GitHub Actions

### Asosiy sahifalar
| Sahifa | Yo'l | Maqsad |
|--------|------|--------|
| Genplan | `/` | Bloklar xaritasi (pan/zoom) |
| Blok | `/block/:id` | Qavat tanlash |
| Bo'lim | `/block/:blockId/bolim/:num` | Xonadon bron qilish |
| Admin | `/admin/*` | Boshqaruv paneli |
| Live | `/live` | Ochiq statistika |

### Ma'lum muammolar (xulosa.md dan)
1. **Backend chegirma validatsiyasi zaif** — foiz tekshirilmaydi (faqat summa)
2. `bonus_enabled` DB maydoni ishlatilmayapti (eski qoldiq)
3. `staleTime: 30s` SSE bilan birga ishlatilmoqda (Infinity yaxshiroq bo'lardi)

---

## O'zgarishlar tarixi

<!-- Yangi o'zgarishlar eng yuqoridan qo'shib boriladi -->

## [2026-06-15] — Shartnomada ism katta harf muammosi tuzatildi

**Tur:** bugfix
**Ruxsat:** tasdiqlangan
**Sabab:** Ism/familiya inputlari form state ga saqlanishidan oldin `.toUpperCase()` chaqirilardi — shu sababli shartnomada KATTA HARF chiqardi

### O'zgartirilgan fayllar
- `src/pages/bolim/ui/FormFields.jsx` — `INPUT` konstantasidan `uppercase` va `placeholder:uppercase` CSS olib tashlandi
- `src/pages/bolim/ui/ApartmentModal.jsx` — `ism`/`familiya` uchun `setBronCap` → `setBron`, `setSotishCap` → `setSotish` ga almashtirildi; yangi `setBron` handler qo'shildi

### Tafsilotlar
- Asosiy muammo: `setBronCap` va `setSotishCap` handler'lari `cap()` = `.toUpperCase()` qo'llab form state ga yozardi
- Natija: Ism/familiya inputda odatdagidek yoziladi → shartnomada ham odatdagi holatda chiqadi (Ikromov Solijon, IKROMOV SOLIJON emas)

---

## [2026-06-14] — Telegram: yangi admin qo'shildi

**Tur:** chore
**Ruxsat:** tasdiqlangan
**Sabab:** `7648984850` ID li foydalanuvchiga barcha Telegram huquqlari berildi

### O'zgartirilgan fayllar
- `backend/src/lib/telegram.js` — `OWNER_CHAT_ID` fallback `7648984850` ga o'zgartirildi (backup + barcha xabarlar)
- `backend/src/routes/bookings.js` — `ALLOWED_CHAT_IDS` fallbackga `7648984850` qo'shildi (PDF xabarlar)
- `backend/.env` — `OWNER_CHAT_ID` va `ALLOWED_CHAT_IDS` local uchun qo'shildi

### Huquqlar
| Chat ID | Tur | Nima oladi |
|---------|-----|-----------|
| `7648984850` | Owner (yangi) | Backup + barcha PDF xabarlar |
| `7874777577` | Allowed | PDF xabarlar |
| `1256520272` | Allowed | PDF xabarlar |

---

---

## O'zgarish yozish formati

```
## [YYYY-MM-DD] — O'zgarish nomi

**Tur:** bugfix | feature | refactor | style | docs | perf | chore
**Ruxsat:** foydalanuvchi tasdiqlagan
**Sabab:** Nima uchun bu o'zgarish qilindi

### O'zgartirilgan fayllar
- `fayl/yo'li.jsx` — nima o'zgartirildi

### Tafsilotlar
Batafsil izoh...

### Test
Qanday tekshirildi

---
```
