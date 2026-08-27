import Redis from "ioredis";
import type { RateLimiter } from "./memory";

export type RedisStatus = "disabled" | "connecting" | "ready" | "error";

export type RedisBundle = {
  rateLimiter: RateLimiter;
  status: () => RedisStatus;
  ping: () => Promise<boolean>;
  close: () => Promise<void>;
};

export function createRedisBundle(url: string): RedisBundle {
  let lastError = false;
  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  redis.on("ready", () => {
    lastError = false;
  });
  redis.on("error", () => {
    lastError = true;
  });

  async function ensureConnected(): Promise<void> {
    if (redis.status === "wait") await redis.connect();
  }

  const rateLimiter: RateLimiter = {
    async allow(key, limit, windowMs) {
      try {
        await ensureConnected();
        const redisKey = `rl:${key}`;
        const count = await redis.incr(redisKey);
        if (count === 1) await redis.pexpire(redisKey, windowMs);
        return count <= limit;
      } catch {
        // Fail open so a Redis outage does not block lead capture.
        return true;
      }
    },
  };

  return {
    rateLimiter,
    status() {
      if (lastError && redis.status !== "ready") return "error";
      if (redis.status === "ready") return "ready";
      if (redis.status === "connecting" || redis.status === "connect" || redis.status === "wait") return "connecting";
      return "error";
    },
    async ping() {
      try {
        await ensureConnected();
        const pong = await redis.ping();
        return pong === "PONG";
      } catch {
        return false;
      }
    },
    async close() {
      try {
        await redis.quit();
      } catch {
        redis.disconnect();
      }
    },
  };
}

/** @deprecated Prefer createRedisBundle for health visibility. */
export function createRedisRateLimiter(url: string): RateLimiter {
  return createRedisBundle(url).rateLimiter;
}
