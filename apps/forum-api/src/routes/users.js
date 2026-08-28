// ─── User Routes ──────────────────────────────────────────────────
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ──────────────── GET /api/users/specialists ────────────────
router.get('/specialists', optionalAuth, async (req, res) => {
    try {
        const cacheKey = 'specialists:all';
        const cached = await cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const db = getDB();
        const specialists = await db.collection('users')
            .find(
                { role: 'specialist', banned: { $ne: true } },
                { projection: { password: 0 } }
            )
            .sort({ verified: -1, name: 1 })
            .toArray();

        const result = specialists.map(s => ({
            ...s,
            id: s._id.toString(),
        }));

        await cacheSet(cacheKey, result, 300);
        res.json(result);
    } catch (err) {
        console.error('Get specialists error:', err);
        res.status(500).json({ error: 'Failed to fetch specialists.' });
    }
});

// ──────────────── GET /api/users/:id ────────────────
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        let userId;
        try {
            userId = new ObjectId(id);
        } catch {
            return res.status(400).json({ error: 'Invalid user ID.' });
        }

        const cacheKey = `userProfile:${id}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const db = getDB();
        const user = await db.collection('users').findOne(
            { _id: userId },
            { projection: { password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Get user stats
        const [questionCount, answerCount] = await Promise.all([
            db.collection('questions').countDocuments({ userId: id, removed: { $ne: true } }),
            db.collection('answers').countDocuments({ userId: id, removed: { $ne: true } }),
        ]);

        const result = {
            ...user,
            id: user._id.toString(),
            stats: { questionCount, answerCount },
        };

        await cacheSet(cacheKey, result, 300);
        res.json(result);
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Failed to fetch user.' });
    }
});

// ──────────────── PUT /api/users/profile ────────────────
router.put('/profile', authenticate, async (req, res) => {
    try {
        const { name, avatar, profession, expertise } = req.body;

        const updates = {};
        if (name && name.length >= 2 && name.length <= 50) updates.name = name.trim();
        if (avatar) updates.avatar = avatar;
        if (profession !== undefined) updates.profession = profession;
        if (expertise !== undefined) updates.expertise = Array.isArray(expertise) ? expertise : [];
        updates.updatedAt = new Date();
        console.log(updates)
        const db = getDB();
        await db.collection('users').updateOne(
            { _id: req.user._id },
            { $set: updates }
        );

        // Invalidate caches
        await cacheDel(`user:${req.user._id}`);
        await cacheDel(`userProfile:${req.user._id}`);
        await cacheDel('specialists:all');

        const updatedUser = await db.collection('users').findOne(
            { _id: req.user._id },
            { projection: { password: 0 } }
        );

        res.json({
            message: 'Profile updated successfully.',
            user: updatedUser,
        });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// ──────────────── GET /api/users/:id/questions ────────────────
router.get('/:id/questions', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const db = getDB();

        // 🔒 Privacy Check:
        // Only the user themselves or an Admin can view the list of questions by a specific user if specific privacy rules apply.
        // However, public profiles usually show questions. 
        // Logic: 
        // - If req.query.ownerOnly is 'true', enforce that req.user is the owner.
        // - Otherwise, allow public viewing (unless you want strict privacy always).

        const isOwner = req.user && req.user._id.toString() === id;
        const isAdmin = req.user && req.user.role === 'admin';
        const ownerOnly = req.query.ownerOnly === 'true';

        if (ownerOnly && !isOwner && !isAdmin) {
            return res.status(403).json({ error: 'You are not authorized to view this user\'s reported/private history.' });
        }

        const [questions, total] = await Promise.all([
            db.collection('questions')
                .find({ userId: id, removed: { $ne: true } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            db.collection('questions').countDocuments({ userId: id, removed: { $ne: true } }),
        ]);

        res.json({
            questions: questions.map(q => ({ ...q, id: q._id.toString() })),
            pagination: {
                page: pageNum, limit: limitNum, total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (err) {
        console.error('Get user questions error:', err);
        res.status(500).json({ error: 'Failed to fetch user questions.' });
    }
});

// ──────────────── GET /api/users/:id/answers ────────────────
router.get('/:id/answers', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const isOwner = req.user && req.user._id.toString() === id;
        const isAdmin = req.user && req.user.role === 'admin';
        const ownerOnly = req.query.ownerOnly === 'true';

        if (ownerOnly && !isOwner && !isAdmin) {
            return res.status(403).json({ error: 'You are not authorized to view this user\'s private answer history.' });
        }

        const query = { userId: id, removed: { $ne: true } };

        const [answers, total] = await Promise.all([
            db.collection('answers')
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            db.collection('answers').countDocuments(query),
        ]);

        res.json({
            answers: answers.map(a => ({ ...a, id: a._id.toString() })),
            pagination: {
                page: pageNum, limit: limitNum, total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (err) {
        console.error('Get user answers error:', err);
        res.status(500).json({ error: 'Failed to fetch user answers.' });
    }
});

module.exports = router;
