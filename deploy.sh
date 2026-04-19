#!/bin/bash
set -e

echo "📦 Yangi kodni olish..."
git fetch origin main
git reset --hard origin/main

echo "🐳 Docker containers rebuild va restart..."
docker compose up -d --build --remove-orphans

echo "🧹 Eski Docker image'larni tozalash..."
docker image prune -f

echo "✅ Deploy muvaffaqiyatli!"
docker compose ps
