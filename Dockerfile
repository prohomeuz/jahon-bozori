# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Faqat package fayllar — layer cache (src o'zgarganda npm install qayta ishlamaydi)
COPY package*.json ./
RUN npm ci

# Butun loyiha (src, public, vite.config.js, index.html)
COPY . .

RUN npm run build

# ── Stage 2: Serve with Nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Builder stage dan faqat dist/ ni ko'chirish
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
