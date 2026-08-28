// ─── Redis Connection ──────────────────────────────────────────────
const Redis = require('ioredis');
require('dotenv').config();

let redis = null;

function connectRedis() {
    if (redis) return redis;

    const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        db: 0,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        reconnectOnError(err) {
            console.log(err);
            const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
            return targetErrors.some(e => err.message.includes(e));
        },
    };

    redis = new Redis(redisConfig);

    redis.on('connect', () => console.log('✅ Connected to Redis'));
    redis.on('error', (err) => console.warn('⚠️  Redis error:', err.message));

    redis.connect().catch((err) => {
        console.warn('⚠️  Redis connection failed (operating without cache):', err.message);
        redis = null;
    });

    return redis;
}

function getRedis() {
    return redis; // Can be null if Redis is not available
}

// Cache helpers
async function cacheGet(key) {
    if (!redis) return null;
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

async function cacheSet(key, data, ttlSeconds = 300) {
    if (!redis) return;
    try {
        await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch {
        // Silently fail – cache is optional
    }
}

async function cacheDel(pattern) {
    if (!redis) return;
    try {
        if (pattern.includes('*')) {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) await redis.del(...keys);
        } else {
            await redis.del(pattern);
        }
    } catch {
        // Silently fail
    }
}

async function closeRedis() {
    if (redis) {
        await redis.quit();
        redis = null;
        console.log('🔌 Redis connection closed');
    }
}

module.exports = { connectRedis, getRedis, cacheGet, cacheSet, cacheDel, closeRedis };
