// utils/cache.js
const { redisClient } = require('../database/redis');
const startTimer = require('./timer');

function cache(keyBuilder, ttlSeconds = 60) {
  return async (req, res, next) => {

    // ❌ Do NOT cache POST, PUT, DELETE
    if (req.method !== "GET") return next();

    const cacheKey = keyBuilder(req);
    const t_total = startTimer("cache_total");

    try {
      const t_read = startTimer("cache_read");
      const cached = await redisClient.get(cacheKey);
      t_read();

      if (cached) {
        startTimer("cache_hit")();
        t_total();
        return res.json(JSON.parse(cached));
      }

      // MISS
      startTimer("cache_miss")();

      const oldJson = res.json.bind(res);
      res.json = async (body) => {
        try {
          const t_write = startTimer("cache_write");
          await redisClient.setex(cacheKey, ttlSeconds, JSON.stringify(body));
          t_write();
        } catch (e) {
          console.error("❌ Cache Write Error:", e.message);
        }

        t_total();
        return oldJson(body);
      };

      next();

    } catch (err) {
      console.error("⚠️ Cache error:", err.message);
      t_total();
      next();
    }
  };
}

module.exports = cache;
