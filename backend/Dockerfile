# ── Backend: Hono.js + Node.js built-in SQLite ───────────────────────────────
# Node 22 majburiy — node:sqlite faqat 22+ da mavjud
FROM node:22-alpine

WORKDIR /app

# Avval faqat package fayllar — layer cache (src o'zgarganda npm install qayta ishlamaydi)
COPY backend/package*.json ./

# Production dependencies only
RUN npm ci --omit=dev

# Backend source kodni ko'chirish
COPY backend/src ./src

# DB fayli saqlanadigan papka — Docker volume bu yerga mount bo'ladi
RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
