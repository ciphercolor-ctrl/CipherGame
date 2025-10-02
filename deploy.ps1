# CIPHER Game Production Deployment Script for Windows
Write-Host "🚀 Starting CIPHER Game deployment..." -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found! Please copy env.example to .env and configure it." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm ci --production

# Build production version (disable console.log)
Write-Host "🔧 Building production version..." -ForegroundColor Yellow
npm run build:production

# Create logs directory if it doesn't exist
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs"
}

# Stop existing PM2 processes
Write-Host "🛑 Stopping existing processes..." -ForegroundColor Yellow
pm2 stop cipher-app 2>$null
pm2 delete cipher-app 2>$null

# Start the application with PM2
Write-Host "▶️ Starting application..." -ForegroundColor Yellow
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "📊 Check status with: pm2 status" -ForegroundColor Cyan
Write-Host "📋 View logs with: pm2 logs cipher-app" -ForegroundColor Cyan
Write-Host "🔄 Restart with: pm2 restart cipher-app" -ForegroundColor Cyan
