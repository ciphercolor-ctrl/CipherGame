# Performance Optimizations for High Traffic

## Database Optimizations

### 1. Connection Pool Tuning
```javascript
// db.js - Production için optimize edilmiş
const dbConfig = {
    max: 30,                    // Artırıldı: 20 → 30
    min: 5,                     // Minimum bağlantı sayısı
    idleTimeoutMillis: 20000,   // Azaltıldı: 30s → 20s
    connectionTimeoutMillis: 1000, // Azaltıldı: 2s → 1s
    maxUses: 10000,            // Artırıldı: 7500 → 10000
    acquireTimeoutMillis: 60000, // Yeni: 60 saniye timeout
    createTimeoutMillis: 30000,  // Yeni: 30 saniye create timeout
};
```

### 2. Query Optimization
```sql
-- Ek indexler
CREATE INDEX CONCURRENTLY idx_scores_timestamp ON scores (timestamp DESC);
CREATE INDEX CONCURRENTLY idx_players_level ON players (level DESC);
CREATE INDEX CONCURRENTLY idx_messages_senderid_timestamp ON messages (senderId, timestamp DESC);

-- Partial indexes for better performance
CREATE INDEX CONCURRENTLY idx_scores_high_scores ON scores (score DESC) WHERE score > 1000;
```

### 3. Caching Strategy
```javascript
// Redis cache eklenebilir
const redis = require('redis');
const client = redis.createClient();

// Leaderboard cache
const cacheLeaderboard = async () => {
    const leaderboard = await db.query('SELECT * FROM leaderboard_materialized_view ORDER BY highestscore DESC LIMIT 20');
    await client.setex('leaderboard', 300, JSON.stringify(leaderboard.rows)); // 5 dakika cache
};
```

### 4. Load Balancing
```nginx
# Nginx configuration
upstream cipher_backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    location / {
        proxy_pass http://cipher_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring

### 1. Database Monitoring
```javascript
// db.js - Connection pool monitoring
setInterval(() => {
    console.log(`Pool stats: ${pool.totalCount} total, ${pool.idleCount} idle, ${pool.waitingCount} waiting`);
}, 30000);
```

### 2. Performance Metrics
```javascript
// Response time tracking
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 1000) { // Log slow requests
            console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
        }
    });
    next();
});
```

## Scaling Strategies

### 1. Horizontal Scaling
- Multiple server instances
- Load balancer (Nginx/HAProxy)
- Database read replicas

### 2. Vertical Scaling
- More CPU cores
- More RAM
- SSD storage
- Faster network

### 3. Database Scaling
- Read replicas for leaderboards
- Connection pooling (PgBouncer)
- Database sharding (if needed)


