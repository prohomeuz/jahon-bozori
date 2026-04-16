#!/bin/bash
set -e

echo "==> Pulling latest changes..."
git fetch origin && git reset --hard origin/main

echo "==> Installing frontend deps..."
npm install --omit=dev

echo "==> Building frontend..."
npm run build

echo "==> Installing backend deps..."
cd backend && npm install --omit=dev && cd ..

echo "==> Starting Docker containers..."
docker compose up -d --build

echo "==> Done! Running at :8080"
