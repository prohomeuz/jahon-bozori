# ── Backend: Hono.js + Node.js built-in SQLite ───────────────────────────────
# Node 22 majburiy — node:sqlite faqat 22+ da mavjud
FROM node:22-alpine

WORKDIR /app

# Faqat package fayllarni avval ko'chirish — layer cache uchun
COPY backend/package*.json ./

# Production dependency'lar — dev tools kerak emas
RUN npm ci --omit=dev && npm cache clean --force

# Backend source kodni ko'chirish
COPY backend/src ./src

# DB fayli saqlanadigan papka — Docker volume bu yerga mount bo'ladi
RUN mkdir -p /data

EXPOSE 3001

# Graceful shutdown uchun dumb-init ishlatish (signal forwarding)
RUN apk add --no-cache dumb-init

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
