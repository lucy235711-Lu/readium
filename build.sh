#!/bin/bash
set -e

echo "=== Building Readium ==="

echo "→ Installing frontend dependencies..."
cd frontend
npm install

echo "→ Building frontend..."
npm run build

echo "→ Copying dist to backend/public..."
rm -rf ../backend/public
cp -r dist ../backend/public

cd ../backend

echo "→ Installing backend dependencies..."
npm install

echo "✓ Build complete!"
