# Chegirma tizimi — To'liq tahlil

> Sana: 2026-06-01
> Maqsad: hozir task berish oldidan tizimni chuqur tushunish

---

## 1. Umumiy arxitektura

```
Admin panel (SettingsPage)
  ├── chegirma_enabled toggle  →  PUT /api/settings
  └── DiscountBrackets CRUD    →  CRUD /api/discount-brackets

ApartmentModal (kalkulyator)
  ├── useSettings()            →  chegirma_enabled holati
  ├── useDiscountBrackets()    →  bracket ro'yxati
  ├── calcDerived (useMemo)    →  chegirma hisoblash
  └── transferToForm()         →  narx_m2, chegirma_m2, asl_narx_m2 → forma

Backend (bookings.js POST)
  ├── chegirma_enabled tekshir
  ├── chegirma_m2 validatsiya  →  faqat discount_usd qiymatini tekshiradi
  └── DB ga saqlash            →  narx_m2, chegirma_m2, asl_narx_m2

Real-time (SSE)
  ├── discount_brackets_changed → queryClient.setQueryData(['discount-brackets'])
  └── settings_changed          → queryClient.setQueryData(['settings'])
```

---

## 2. Ma'lumotlar bazasi strukturasi

### `discount_brackets` jadvali
```sql
CREATE TABLE discount_brackets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  min_percent  INTEGER NOT NULL UNIQUE,   -- 1-100
  discount_usd REAL    NOT NULL DEFAULT 0 -- $/m²
)
```
Default seed (db.js da):
| min_percent | discount_usd |
|-------------|-------------|
| 30          | 100         |
| 40          | 150         |
| 50          | 200         |
| 60          | 250         |
| 70          | 300         |
| 100         | 400         |

### `settings` jadvali
```sql
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)
-- seed:
INSERT OR IGNORE INTO settings VALUES ('chegirma_enabled', '1')
```

### `bookings` jadvalidagi chegirma maydonlari
```sql
narx_m2       TEXT  -- yakuniy narx $/m² (chegirma AYIRILGAN)
chegirma_m2   TEXT  -- chegirma miqdori $/m²
asl_narx_m2   TEXT  -- chegirmadan oldingi asl narx $/m²
bonus_enabled INTEGER NOT NULL DEFAULT 1  -- bonus tizimi uchun alohida
```

---

## 3. Backend logikasi (bookings.js)

### Chegirma validatsiya kodi
```js
const chegirmaEnabled = q.getSetting.get({ key: 'chegirma_enabled' })?.value === '1'
let safe_chegirma_m2 = null
let safe_asl_narx_m2 = null

if (chegirmaEnabled && chegirma_m2 != null) {
  const chegirmaNum = Number(String(chegirma_m2).replace(/\s/g, ''))
  const brackets = q.allDiscountBrackets.all()
  const validBracket = brackets.find(b => b.discount_usd === chegirmaNum)  // ← faqat shu
  if (validBracket) {
    safe_chegirma_m2 = chegirma_m2
    safe_asl_narx_m2 = asl_narx_m2 ?? null
  }
}
```

**Nima tekshiriladi:** faqat `discount_usd` qiymati DB'dagi biron bracket'ga mos kelishi.
**Nima tekshirilmaydi:** boshlang'ich to'lov foizi, narx/m² to'g'riligi, asl_narx_m2 vs narx_m2 farqi.

### Juft do'konda chegirma (pair booking)
```js
// apt1: frontend narx kiritilgan bo'lsa to'g'ridan-to'g'ri ishlatiladi (chegirma allaqachon ayirilgan)
const finalNarxM2_1 = frontendNarxNum1 > 0 ? frontendNarxNum1 : systemNarxM2_1

// apt2: frontend narx kiritilgan bo'lsa system narxdan chegirma ayiriladi
const finalNarxM2_2 = frontendNarxNum1 > 0
  ? (chegirmaM2Num > 0 ? Math.max(0, systemNarxM2_2 - chegirmaM2Num) : frontendNarxNum1)
  : systemNarxM2_2

// yakuniy (narx kiritilmagan rejimda chegirma ayiriladi)
const yakuniyM2_1 = frontendNarxNum1 > 0 ? finalNarxM2_1 : Math.max(0, finalNarxM2_1 - chegirmaM2Num)
const yakuniyM2_2 = frontendNarxNum1 > 0 ? finalNarxM2_2 : Math.max(0, finalNarxM2_2 - chegirmaM2Num)
```

Mantiq: kalkulyator narxi yuborsa → frontend allaqachon chegirma ayirib yuborgan (narx_m2 = yakuniy narx). Backend esa apt2 uchun system narxdan chegirma ayiradi.

---

## 4. Frontend kalkulyator logikasi (ApartmentModal.jsx)

### Chegirma faol bo'lishi uchun barcha shartlar
```js
const chegirma = (
  apartment.is_wc       // ← hojatxona: HECH QACHON chegirma yo'q
  || !chegirmaEnabled   // ← admin toggle o'chirilgan
  || !narxIsLocked      // ← foydalanuvchi custom narx kiritgan
) ? 0 : (activeBracket?.discount_usd ?? 0)
```

Demak chegirma faqat:
1. `chegirmaEnabled = true`
2. Do'kon (is_wc = false)
3. `narxIsLocked = true` (tizim narxi, foydalanuvchi o'zgartirmagan)
4. Boshlang'ich to'lov foizi ≥ biron bracket'ning `min_percent`

### Bracket tanlash algoritmi
```js
const sortedDisc = [...discountBrackets].sort((a, b) => b.min_percent - a.min_percent)
const activeBracket = sortedDisc.find(b => pctOfBase >= b.min_percent) ?? null
```
Eng katta mos bracket tanlanadi:
- Foiz 65% → 60% bracket (100$ emas, 250$)
- Foiz 100% → 100% bracket (400$)

### `narxIsLocked` mexanizmi
- `narxIsLocked = true` → narx DBdan yuklangan (tizim narxi), kalkulyatorda greyed out
- `narxIsLocked = false` → foydalanuvchi long-press bilan custom narx kiritgan
- Custom rejimda chegirma ko'rsatilmaydi (UI va backend ikkalasi ham)

### Formaga o'tkazish (transferToForm)
```js
{
  narx_m2:     String(yakuniy),     // chegirma AYIRILGAN narx
  boshlangich: ...,
  oylar:       ...,
  umumiy:      String(total),       // chegirma AYIRILGAN umumiy
  chegirma_m2: chegirma > 0 ? String(chegirma) : '',
  asl_narx_m2: chegirma > 0 ? String(narxVal)  : '',
}
```

### Vizual effektlar (chegirma faollashganda)
- Ovoz: Web Audio API orqali 4 nota (do-mi-sol-do akkord)
- Confetti: canvas-confetti kutubxonasi (lazy import)
- Vibro: `navigator.vibrate([80, 40, 120, 40, 200])`
- Trigger: `pctBracket` o'zgarganda va `chegirmaEnabled` bo'lganda

---

## 5. Real-time yangilanish (SSE)

`useRealtimeApts.js` — barcha SSE eventlarni boshqaradi:
```js
if (event === 'discount_brackets_changed') {
  queryClient.setQueryData(['discount-brackets'], JSON.parse(rawData))
}
if (event === 'settings_changed') {
  queryClient.setQueryData(['settings'], JSON.parse(rawData))
}
```

Backend har bir CRUD operatsiyasidan keyin broadcast qiladi:
- `broadcast('discount_brackets_changed', all)` — barcha bracketlar
- `broadcast('settings_changed', out)` — barcha settings

**Ishlash tartibi:** admin bracket o'zgartirganda → barcha ochiq tablar real-time yangilanadi.

---

## 6. PDF integratsiya

### Bron PDFi (ContractPDF.jsx)
```js
const hasChegirma = chegirmaM2 > 0 && aslNarxM2 > 0
```
Agar chegirma bo'lsa:
- Grid'da qo'shimcha yashil satr: Asl narx/m², Chegirma/m² (qizil), Umumiy tejam (yashil)
- Umumiy narx ustiga chizib, chegirmali narx yonida ko'rsatiladi
- Floor plan balandligi qisqaradi: 220 → 178 px (joy uchun)

### Sotuv PDFi (ShartnomaPDF.jsx)
Sotuv shartnomasi uchun alohida komponent — u ham `chegirma_m2` va `asl_narx_m2` ni form'dan oladi.

### Admin booking PDF (bookingPdf.jsx)
Mavjud bronlar ro'yxatidan PDF yuklab olishda ham saqlanган `chegirma_m2`/`asl_narx_m2` qiymatlar ishlatiladi.

---

## 7. Topilgan muammolar va zaifliklar

### #1 — Backend validatsiya zaif (KRITIK)
**Muammo:** Backend boshlang'ich to'lov foizini tekshirmaydi.
```js
// Hozirgi kod:
const validBracket = brackets.find(b => b.discount_usd === chegirmaNum)
// Bu faqat: "bu summa (masalan 100$) mavjud bracketda bormi?" deb tekshiradi

// To'g'ri bo'lishi kerak:
// 1. narx_m2 va umumiy asosida foiz hisoblash
// 2. Hisoblangan foiz >= min_percent ekanligini tekshirish
```
**Xatar:** Bir manager boshlang'ich 10% kiritib, chegirma_m2=100 yuborsa → backend qabul qiladi.
Frontend `narxIsLocked` orqali himoyalangan, lekin API to'g'ridan-to'g'ri chaqirilsa buziladi.

**Yechim:** Backendda ham foizni hisoblash:
```js
const narxNum = Number(String(narx_m2).replace(/\s/g,'')) || 0
const aslNum  = Number(String(asl_narx_m2).replace(/\s/g,'')) || 0
const umumiyNum = aslNum > 0 ? Math.round(aslNum * size) : 0
const boshlNum  = Number(String(boshlangich).replace(/\s/g,'')) || 0
const pct = umumiyNum > 0 ? Math.floor(boshlNum / umumiyNum * 100) : 0
const validBracket = brackets.find(b => b.discount_usd === chegirmaNum && pct >= b.min_percent)
```

Lekin bu uchun bookings route'da apartment size kerak bo'ladi — JOIN yoki alohida query.

### #2 — `staleTime: 30_000` ortiqcha (kichik)
**Muammo:** `useSettings` va `useDiscountBrackets` 30 soniyalik kesh.
**Lekin:** SSE real-time yangilanish bor. Demak `staleTime` aslida muhim emas — SSE setQueryData orqali yangilaydi.
**Yechim:** `staleTime: Infinity` + SSE orqali yangilash (hozir ham ishlaydi, faqat 30s stale metrikalari noto'g'ri).

### #3 — Juft do'kon chegirma qo'llanilish tartibi chalkash
**Muammo:** Juft do'konda apt1 narxi "frontend narx" (yakuniy), apt2 narxi "system narx - chegirma".
Ikki xil hisoblash usuli bir xil natijani berishi shart — lekin hozircha log emas.
**Misol potensial xato:**
```
apt1 system narxi: 900, chegirma: 100 → yakuniy: 800
apt2 system narxi: 850, chegirma: 100 → yakuniy: 750

Frontend yuborgani: narx_m2 = 800 (apt1 yakuniy)
Backend apt2 uchun: systemNarxM2_2 - chegirmaM2Num = 850 - 100 = 750 ✓
```
Hozircha to'g'ri ishlaydi.

### #4 — `bonus_enabled` maydoni ishlatilmayapti
**Muammo:** `bookings.bonus_enabled` (INTEGER DEFAULT 1) jadvaldа bor, lekin:
- `insertBooking` prepare'da yo'q (INSERT'ga qo'shilmagan)
- Hech qayerda o'qilmaydi
- Bu maydon ehtimol eski bonus tizimining qoldig'i

### #5 — `asl_narx_m2` bo'lsa ham `null` saqlash xatari
**Kod:**
```js
safe_asl_narx_m2 = asl_narx_m2 ?? null
```
Agar frontend `asl_narx_m2` yubormasа — `null` saqlanadi. PDF'da `hasChegirma = chegirmaM2 > 0 && aslNarxM2 > 0` bo'lgani uchun chegirma ko'rinmaydi. Bu yaxshi himoya.

---

## 8. Tizim ishlash oqimi (end-to-end)

```
1. Admin bracketlarni sozlaydi
   POST /api/discount-brackets { min_percent: 50, discount_usd: 200 }
   → DB'ga yoziladi
   → broadcast('discount_brackets_changed', [...]) — barcha klientlarga

2. Manager kalkulyatorni ochadi
   GET /api/prices → narx/m² oladi → narxIsLocked = true

3. Boshlang'ich to'lov kiritiladi
   pctOfBase = floor(boshlangich / baseTotal * 100)
   activeBracket = eng katta mos bracket
   chegirma = activeBracket.discount_usd
   [ovoz + confetti + vibro]

4. "Formaga o'tkazish" bosiladi
   narx_m2 = narxVal - chegirma  (yakuniy narx)
   chegirma_m2 = chegirma
   asl_narx_m2 = narxVal         (asl narx)

5. Bron/Sotish bosiladi
   POST /api/bookings {
     narx_m2, chegirma_m2, asl_narx_m2, boshlangich, ...
   }
   Backend: chegirma_m2 = 200 → DB'da 200$ bracket bormi? → ha → safe_chegirma_m2 = 200
   Saqlash: narx_m2=narxYakuniy, chegirma_m2=200, asl_narx_m2=aslNarx

6. PDF yaratiladi
   hasChegirma = chegirmaM2 > 0 && aslNarxM2 > 0 → true
   → Chegirma grid qatori ko'rsatiladi
   → Umumiy narx ustiga chiziladi
```

---

## 9. Texnik qarzlar va qarorlar

| Mavzu | Hozirgi holat | Bahosi |
|-------|--------------|--------|
| Backend foiz tekshiruvi | Yo'q (faqat summa) | Xavfli lekin amalda past risk |
| SSE + staleTime | Ishlaydi, staleTime 30s | Yaxshi, Infinity ham bo'lardi |
| Bonus brackets | Fayl o'chirilgan (D) | Eski kod, tozalangan ✓ |
| bonusConfig.js | O'chirilgan (D) | Tozalangan ✓ |
| useBonusBrackets.js | O'chirilgan (D) | Tozalangan ✓ |
| WC chegirma | Qo'llanilmaydi | To'g'ri qaror ✓ |
| Custom narxda chegirma | O'chiriladi | To'g'ri qaror ✓ |
| narxIsLocked | Frontend himoyasi | Yaxshi UX ✓ |

---

## 10. Git diff holati (hozirgi branch: test)

**O'chirilgan fayllar (D):**
- `backend/src/routes/bonus-brackets.js` — bonus bracket route
- `src/shared/config/bonusConfig.js` — static bonus config
- `src/shared/hooks/useBonusBrackets.js` — bonus hook

**O'zgartirilgan fayllar (M):**
- `backend/src/db.js` — discount_brackets jadvali + queries qo'shilgan
- `backend/src/index.js` — discount-brackets route mount qilingan
- `backend/src/routes/bookings.js` — chegirma validatsiya + saqlash
- `backend/src/routes/discount-brackets.js` — to'liq CRUD
- `backend/src/routes/settings.js` — chegirma_enabled sozlama
- `src/pages/admin/lib/bookingPdf.jsx` — bonus → chegirma
- `src/pages/admin/ui/SettingsPage.jsx` — DiscountBrackets komponenti
- `src/pages/bolim/lib/pdfExport.jsx` — chegirma PDF
- `src/pages/bolim/ui/ApartmentModal.jsx` — kalkulyator chegirma logikasi
- `src/pages/bolim/ui/ContractPDF.jsx` — chegirma qatori

---

## 11. Xulosa — Tizimning kuchli va zaif tomonlari

### Kuchli tomonlar
- Real-time SSE yangilanish to'liq ishlaydi (brackets + settings)
- `narxIsLocked` UX himoyasi mukammal — custom narxda chegirma yo'q
- WC'larda chegirma to'g'ri o'chirilgan
- PDF'da chegirma chiroyli ko'rsatiladi (green tint, strike-through)
- Vizual effektlar (ovoz, confetti) sotuvchini rag'batlantiradi
- Admin panel real-time optimistic update bilan ishlaydi
- Bonus tizimi koddan to'liq tozalangan

### Zaif tomonlar
- **Backend chegirma validatsiyasi zaif** — foiz tekshirilmaydi, faqat summa
- `bonus_enabled` DB maydoni ishlatilmayapti (eski qoldiq)
- Juft do'kon chegirma logikasi backend'da ikki xil yo'l tutadi
