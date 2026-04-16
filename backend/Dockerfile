# ── Backend: Hono.js + Node.js built-in SQLite ───────────────────────────────
# Node 22 majburiy — node:sqlite faqat 22+ da mavjud
FROM node:22-alpine

WORKDIR /app

# Package fayllari va node_modules ni hostdan ko'chirish (internet kerak emas)
COPY backend/package*.json ./
COPY backend/node_modules ./node_modules

# Backend source kodni ko'chirish
COPY backend/src ./src

# DB fayli saqlanadigan papka — Docker volume bu yerga mount bo'ladi
RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
