# CLAUDE.md — Jahon Bozori

## Loyiha haqida
Vizual effektlarga boy, ammo **ultrafast** ishlashi shart bo'lgan marketplace. Asosiy maqsad: past internet (2G/3G, 100ms+ latency) sharoitida ham foydalanuvchi "tez" his qilishi.

---

## Arxitektura: Feature-Sliced Design (FSD)

```
src/
├── app/          # Provider'lar, router, global style import
├── pages/        # Sahifa komponentlari (route'ga to'g'ri keladi)
├── widgets/      # Mustaqil katta UI bloklari (Header, Sidebar, ProductGrid)
├── features/     # Foydalanuvchi action'lari (search, cart-add, auth-form)
├── entities/     # Biznes ob'ektlari (product, user, order, category)
└── shared/       # Hech kimga bog'liq bo'lmagan kod
    ├── ui/       # shadcn komponentlari + custom primitiv'lar
    ├── lib/      # Utility funksiyalar (cn, format, debounce)
    ├── api/      # Fetch wrapper, endpoint'lar
    ├── config/   # Konstanta'lar, env, routes
    ├── hooks/    # useIntersection, useMediaQuery va boshqalar
    └── types/    # Global TypeScript tiplar
```

### FSD qoidalari
- Har bir layer faqat **o'zidan pastki** layer'ni import qila oladi
- `pages` → `widgets` → `features` → `entities` → `shared`
- Bir xil layer ichida cross-import **taqiqlangan** (feature → feature yo'q)
- Har bir slice `index.js` orqali public API chiqaradi (barrel export)
- Layer ichida: `ui/`, `model/`, `api/`, `lib/` papkalari bo'lishi mumkin

---

## Performance — Asosiy Qoidalar

### Bundle va kod bo'lish
- Har bir **page** `React.lazy()` + `Suspense` bilan lazy load qilinadi
- Og'ir kutubxonalar (animation, chart) faqat kerak bo'lganda dynamic import
- `vite-bundle-visualizer` bilan har release oldidan bundle tekshiriladi
- Bitta JS chunk **150KB gzip'dan** oshmasligi kerak

### Rasm va media
- Barcha rasmlar **WebP** formatida, `<picture>` + AVIF fallback
- Har bir rasm `loading="lazy"` va aniq `width`/`height` atributlari bilan
- Hero rasmlari `fetchpriority="high"` + `preload` link tag
- `srcset` bilan responsive rasm — mobil uchun kichik versiya
- Placeholder: **blur hash** yoki solid color skeleton (hech qachon bo'sh joy yo'q)

### Animatsiya va vizual effektlar
- **CSS animatsiyalar** JS animatsiyalardan ustun (transform, opacity only)
- `will-change` faqat trigger oldidan qo'shiladi, animatsiya tugagach olib tashlanadi
- `@media (prefers-reduced-motion)` — barcha animatsiyalar uchun majburiy
- Scroll animatsiyalar faqat `IntersectionObserver` orqali (scroll event yo'q)
- 60fps saqlash: faqat `transform` va `opacity` animate qilish (layout trigger yo'q)
- Og'ir blur/glassmorphism effektlari: `contain: paint` bilan izolyatsiya

### Critical render yo'li
- Above-the-fold kontenti SSR yoki inline CSS bilan darhol chiqishi kerak
- Font: `font-display: swap` + preload faqat bitta asosiy font (Geist Variable)
- LCP element `fetchpriority="high"` bilan
- CSS `@layer` orqali unused style'larni tree-shake qilish

### Tarmoq va caching
- API javoblari `stale-while-revalidate` strategiyasi bilan cache'lanadi
- Optimistic UI — server javobini kutmasdan UI yangilanadi
- Retry mantiq: exponential backoff, 3 urinish
- Oflayn holat uchun Service Worker (Workbox) — statik asset'lar cache'da

### Ro'yxat va ko'p ma'lumot
- 50+ elementli ro'yxatlar uchun virtual scroll (`@tanstack/react-virtual`)
- Pagination o'rniga infinite scroll — faqat ko'rinadigan DOM elementi bor
- Debounce: search inputda 300ms, resize handlerda 100ms

---

## Komponent yozish qoidalari

### Tuzilma
```jsx
// shared/ui/Button/Button.jsx
// Faqat props'dan keladigan ma'lumot — ichki state minimum
// className prop har doim qabul qiladi (cn() orqali merge)
// forwardRef — barcha interaktiv elementlarda
```

### State boshqaruv
- **Server state**: `@tanstack/react-query` — loading/error/cache avtomatik
- **Global client state**: Zustand (kichik, tree-shakable)
- **Form state**: React Hook Form + Zod validation
- **URL state**: query params (filter, sort, page) — URL davlatning haqiqiy manbai

### Kod sifati
- Komponent fayli **300-400 satrdan** oshmasligi kerak — oshsa darhol bo'lib yozing
- Custom hook — agar mantiq 2+ joyda takrorlansa yoki komponent og'irlashsa
- `useMemo`/`useCallback` — faqat profiler ko'rsatganda (premature optimization yo'q)
- `React.memo` — faqat render benchmark bilan asoslanganda

---

## Texnologiyalar steki

| Soha | Tanlov | Sabab |
|------|--------|-------|
| Build | Vite 8 | Eng tez HMR, native ESM |
| UI primitiv | shadcn/ui + Radix | Accessible, headless |
| Stil | Tailwind CSS v4 | Zero-runtime, utility-first |
| Animatsiya | CSS + Framer Motion (lazy) | CSS birinchi, JS faqat kerakda |
| Server state | TanStack Query | Caching, background refetch |
| Global state | Zustand | 1KB, tree-shakable |
| Form | React Hook Form + Zod | Minimal re-render |
| Router | React Router v7 | Code splitting built-in |
| Virtual list | TanStack Virtual | 0 dependency, performant |

---

## File nomlash konvensiyasi

```
PascalCase   → Komponentlar (ProductCard.jsx)
camelCase    → Hook'lar, utility (useCart.js, formatPrice.js)
kebab-case   → Papka nomlari (product-card/)
UPPER_CASE   → Konstanta'lar (API_BASE_URL)
index.js     → Har bir slice'ning public export'i
```

---

## CSS va Tailwind qoidalari

- `@apply` faqat `@layer base` ichida (komponentlarda class string ishlatiladi)
- `cn()` (`clsx` + `tailwind-merge`) — barcha conditional className'lar uchun
- Design token'lar CSS variable orqali (`--color-primary`) — Tailwind'ga map qilingan
- `container` class ishlatilmaydi — har bir layout o'z max-width'ini belgilaydi
- Dark mode: `class` strategiyasi (`.dark` class `<html>`da)

---

## Performance byudjet

| Metrika | Maqsad |
|---------|--------|
| LCP | < 2.5s (3G da) |
| FID / INP | < 100ms |
| CLS | < 0.1 |
| TTI | < 3.5s (3G da) |
| JS (gzip) | < 200KB birinchi yuklashda |
| CSS (gzip) | < 30KB |

---

## Nima qilmaslik

- `useEffect` ichida data fetch — React Query ishlatiladi
- `index.css`ga komponent-spetsifik stil — Tailwind class ishlatiladi
- Inline `style={{}}` animatsiya — Tailwind yoki CSS class
- `any` tipi TypeScript'da — har doim aniq tip
- Default export'dan ko'p komponent bir faylda
- `document.querySelector` React komponentida — `ref` ishlatiladi
- Unnecessary `useEffect` — [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- `npm install` paket agar native CSS/JS bilan qilsa bo'lsa
- Murakkab yechim qidirish — eng oddiy ishlaydigani yoziladi (KISS)
- **shadcn komponentlarini to'g'ridan-to'g'ri tahrirlash** — `src/shared/ui/` dagi shadcn fayllari o'zgartirilmaydi. Kengaytirish kerak bo'lsa, wrapper komponent yoziladi
