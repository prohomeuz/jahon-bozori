// Sessiya davomida yuklangan rasm src URL'larini saqlaydi.
// Kalit — Vite tomonidan hash qilingan to'liq src string (har doim bir xil).
const loaded = new Set()

export const imgCache = {
  has: (src) => !!src && loaded.has(src),
  add: (src) => src && loaded.add(src),
}
