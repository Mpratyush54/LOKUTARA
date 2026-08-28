const path = require("path");
const ROOT = path.resolve(__dirname);
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

module.exports = {
  apps: [
    // =====================================================
    // 1. MAIN API SERVERS (Cluster Mode)
    // =====================================================
    {
      name: "psych-api",
      script: "app.js",
      instances: "max",               // auto scale based on CPU
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",

      env: {
        NODE_ENV: "development",
        PORT: process.env.PORT || 3010
      },

      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3010
      },

      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000
    },

    // =====================================================
    // 2. BACKGROUND WORKERS (Cluster Mode)
    // =====================================================
    {
      name: "psych-worker",
      script: "./worker.js",
      instances: 1,               // each CPU gets a worker
      exec_mode: "fork",
      watch: false,

      env: {
        NODE_ENV: "development",
        PORT: process.env.WORKER_PORT || 3050   // worker port optional
      },

      env_production: {
        NODE_ENV: "production",
        PORT: process.env.WORKER_PORT || 3050
      },

      error_file: "./logs/worker-err.log",
      out_file: "./logs/worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 2000
    }
  ]
};
