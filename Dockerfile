# ── Frontend: Pre-built React → Nginx static server ───────────────────────────
# dist/ hostda build qilinadi: npm run build
# Docker faqat nginx + dist/ ni o'z ichiga oladi

FROM nginx:1.27-alpine

# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build artifact'larni ko'chirish
COPY dist /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html

# nginx 80 portda ishlaydi
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
