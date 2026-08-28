const express = require('express');
const router = express.Router();

const { getDB } = require('../config/database');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { authenticate, authorize } = require('../middleware/auth');
const crypto = require('crypto');

/**
 * @swagger
 * /api/config/launch:
 *   get:
 *     summary: Get application launch status
 *     tags: [Config]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Bypass token to access the site if not launched
 *     responses:
 *       200:
 *         description: Launch status and date
 */
router.get('/launch', async (req, res) => {
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
                allowSignups: configDoc?.allowSignups,
                questionRateLimit: configDoc?.questionRateLimit
            };

            await cacheSet(CACHE_KEY, status, 300); // RTL 5 mins (300 seconds)
        }

        // Support for admin bypass token
        const providedToken = req.query.token || req.headers['x-admin-bypass-token'];
        let responsePayload = {
            isLaunched: status.isLaunched,
            launchDate: status.launchDate,
            allowSignups: status.allowSignups !== false, // default true
            questionRateLimit: status.questionRateLimit || 5
        };

        if (!status.isLaunched && providedToken && status.bypassToken === providedToken) {
            // Admin successfully bypassed the launch screen
            responsePayload.isLaunched = true;
            responsePayload.bypassed = true;
        }

        res.json(responsePayload);
    } catch (error) {
        console.error('Error fetching launch status:', error);
        // Default fallback if all fails to prevent frontend locking
        res.json({ isLaunched: true, launchDate: new Date().toISOString() });
    }
});

/**
 * @swagger
 * /api/config/launch:
 *   post:
 *     summary: Update application launch status (Admin only)
 *     tags: [Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isLaunched:
 *                 type: boolean
 *               launchDate:
 *                 type: string
 *               generateToken:
 *                 type: boolean
 *                 description: Set to true to generate a new bypass token
 *     responses:
 *       200:
 *         description: Launch status updated successfully
 */
router.post('/launch', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { isLaunched, launchDate, generateToken, allowSignups, questionRateLimit } = req.body;
        const db = getDB();

        let updates = {
            isLaunched: Boolean(isLaunched),
            launchDate: launchDate || new Date().toISOString(),
            allowSignups: allowSignups !== undefined ? Boolean(allowSignups) : true,
            questionRateLimit: questionRateLimit !== undefined ? Number(questionRateLimit) : 5,
            updatedAt: new Date()
        };

        // Generate a new secure bypass token if requested
        if (generateToken) {
            updates.bypassToken = crypto.randomBytes(16).toString('hex');
        }

        await db.collection('config').updateOne(
            { _id: 'launch_status' },
            { $set: updates },
            { upsert: true }
        );

        await cacheDel('config:launch_status');

        const updatedDoc = await db.collection('config').findOne({ _id: 'launch_status' });

        res.json({
            message: 'Launch status updated successfully',
            bypassToken: updatedDoc.bypassToken // Expose token back to the admin caller
        });
    } catch (error) {
        console.error('Error updating launch status:', error);
        res.status(500).json({ error: 'Failed to update launch configuration' });
    }
});

module.exports = router;
