// database/redis.js
const Redis = require("ioredis");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, '../.env') });

// -----------------------------
// REDIS CONFIG
// -----------------------------
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,

  // Prevent "Unhandled promise rejection" from internal retries
  maxRetriesPerRequest: null,

  // Prevent long hangs if Redis is slow or unreachable
  enableReadyCheck: false,

  // Optional: Auto-reconnect strategy
  retryStrategy(times) {
    // Exponential backoff, capped at 2s
    return Math.min(times * 50, 2000);
  }
};

// -----------------------------
// CREATE CLIENT
// -----------------------------
const redisClient = new Redis(redisConfig);

// -----------------------------
// EVENT LOGS
// -----------------------------
redisClient.on("connect", () =>
  console.log("🔌 Redis connected:", `${redisConfig.host}:${redisConfig.port}`)
);

redisClient.on("ready", () =>
  console.log("⚡ Redis ready")
);

redisClient.on("error", (err) =>
  console.error("❌ Redis Error:", err.message)
);

redisClient.on("reconnecting", () =>
  console.log("♻️ Redis reconnecting...")
);

redisClient.on("close", () =>
  console.log("🔴 Redis connection closed")
);

// -----------------------------
// EXPORT
// -----------------------------
module.exports = { redisClient, redisConfig };
