# ── Frontend: React + Vite → Nginx static server ─────────────────────────────

# Stage 1 — Build
FROM node:22-alpine AS builder

WORKDIR /app

# package fayllar avval — cache layer (source o'zgarmasa qayta build yo'q)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Butun source ni ko'chirish va build qilish
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────

# Stage 2 — Serve (faqat dist/ — node_modules, source code kerak emas)
FROM nginx:1.27-alpine

# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build artifact'larni ko'chirish
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx 80 portda ishlaydi
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
