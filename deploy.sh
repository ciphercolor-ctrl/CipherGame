#!/bin/bash

# CIPHER Game Production Deployment Script
echo "🚀 Starting CIPHER Game deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Please copy env.example to .env and configure it."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build production version (disable console.log)
echo "🔧 Building production version..."
npm run build:production

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop existing PM2 processes
echo "🛑 Stopping existing processes..."
pm2 stop cipher-app 2>/dev/null || true
pm2 delete cipher-app 2>/dev/null || true

# Start the application with PM2
echo "▶️ Starting application..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

echo "✅ Deployment completed!"
echo "📊 Check status with: pm2 status"
echo "📋 View logs with: pm2 logs cipher-app"
echo "🔄 Restart with: pm2 restart cipher-app"
