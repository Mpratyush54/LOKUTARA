const { getDB } = require('../config/database');
const { cacheGet, cacheSet } = require('../config/redis');

async function launchCheck(req, res, next) {
    try {
        const CACHE_KEY = 'config:launch_status';
        let status = await cacheGet(CACHE_KEY);

        if (!status) {
            const db = getDB();
            const configDoc = await db.collection('config').findOne({ _id: 'launch_status' });

            status = {
                isLaunched: configDoc?.isLaunched ?? true,
                launchDate: configDoc?.launchDate ?? new Date().toISOString(),
                bypassToken: configDoc?.bypassToken || null,
                allowSignups: configDoc?.allowSignups ?? true,
                questionRateLimit: configDoc?.questionRateLimit || 5
            };

            await cacheSet(CACHE_KEY, status, 300);
        }

        if (status.isLaunched) {
            return next();
        }

        // Platform is closed, check for bypass token
        const providedToken = req.query.token || req.headers['x-admin-bypass-token'];
        if (providedToken && status.bypassToken === providedToken) {
            return next();
        }

        // If not launched and no valid bypass token, block the request
        return res.status(403).json({ error: 'Platform is currently closed for maintenance or pre-launch.' });

    } catch (err) {
        console.error('Launch check middleware error:', err);
        // Fail open to avoid breaking the application during DB/Cache faults
        next();
    }
}

module.exports = { launchCheck };
