#!/bin/bash
set -e

echo "📦 Yangi kodni olish..."
git fetch origin main
git reset --hard origin/main

echo "🔧 Frontend dependencies (build uchun devDeps ham kerak)..."
npm ci

echo "🏗️  Frontend build..."
npm run build

echo "📦 Backend dependencies (production only)..."
cd backend && npm ci --omit=dev && cd ..

echo "🐳 Docker containers restart..."
docker compose up -d --build --remove-orphans

echo "🧹 Eski Docker image'larni tozalash..."
docker image prune -f

echo "✅ Deploy muvaffaqiyatli!"
docker compose ps
