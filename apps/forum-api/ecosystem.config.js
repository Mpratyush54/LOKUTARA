module.exports = {
    apps: [{
        name: "forum-backend",
        script: "./src/server.js",
        instances: "max", // Use all available CPU cores
        exec_mode: "cluster", // Enable cluster mode
        watch: false, // Don't watch files in production
        max_memory_restart: "1G", // Restart if memory usage exceeds 1GB
        env: {
            NODE_ENV: "development",
            PORT: 5000
        },
        env_production: {
            NODE_ENV: "production",
            PORT: 5000
        },
        // Log formatting
        log_date_format: "YYYY-MM-DD HH:mm:ss Z",
        error_file: "logs/pm2-error.log",
        out_file: "logs/pm2-out.log",
        merge_logs: true,
    }]
};
