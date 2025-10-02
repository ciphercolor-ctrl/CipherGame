module.exports = {
  apps : [{
    name: 'cipher-app',
    script: 'server.js',
    instances: 1, // Single instance for development
    exec_mode: 'fork', // Fork mode instead of cluster
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    // Production optimizations
    node_args: '--max-old-space-size=1024',
    kill_timeout: 5000,
    listen_timeout: 10000,
    // Log rotation
    log_type: 'json',
    merge_logs: true,
    // Auto restart on crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};