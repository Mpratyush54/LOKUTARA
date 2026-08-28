// ─── Tags Routes ──────────────────────────────────────────────────
const express = require('express');
const { getDB } = require('../config/database');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Default tags (seeded)
const DEFAULT_TAGS = [
    { name: 'mental-health', category: 'psychology' },
    { name: 'stress-management', category: 'psychology' },
    { name: 'motivation', category: 'psychology' },
    { name: 'counselling', category: 'psychology' },
    { name: 'interview', category: 'corporate' },
    { name: 'resume', category: 'corporate' },
    { name: 'leadership', category: 'corporate' },
    { name: 'teamwork', category: 'corporate' },
    { name: 'productivity', category: 'corporate' },
    { name: 'software', category: 'industry' },
    { name: 'ai-ml', category: 'industry' },
    { name: 'internship', category: 'industry' },
    { name: 'startup', category: 'industry' },
    { name: 'project-help', category: 'industry' },
];

// ──────────────── GET /api/tags ────────────────
router.get('/', async (req, res) => {
    try {
        const cacheKey = 'tags:all';
        const cached = await cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const db = getDB();
        let tags = await db.collection('tags').find({}).sort({ category: 1, name: 1 }).toArray();

        // If no tags exist, seed them
        if (tags.length === 0) {
            await db.collection('tags').insertMany(DEFAULT_TAGS);
            tags = DEFAULT_TAGS;
        }

        const result = tags.map(t => ({ ...t, id: t._id?.toString() }));

        await cacheSet(cacheKey, result, 600);
        res.json(result);
    } catch (err) {
        console.error('Get tags error:', err);
        res.status(500).json({ error: 'Failed to fetch tags.' });
    }
});

// ──────────────── POST /api/tags ────────────────
// Admin only: add a new tag
router.post('/', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { name, category } = req.body;

        if (!name || !category) {
            return res.status(400).json({ error: 'name and category are required.' });
        }

        if (!['psychology', 'corporate', 'industry'].includes(category)) {
            return res.status(400).json({ error: 'category must be psychology, corporate, or industry.' });
        }

        const db = getDB();
        const existing = await db.collection('tags').findOne({ name: name.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'Tag already exists.' });
        }

        const tag = { name: name.toLowerCase(), category, createdAt: new Date() };
        await db.collection('tags').insertOne(tag);

        await cacheDel('tags:all');

        res.status(201).json({ message: 'Tag created.', tag });
    } catch (err) {
        console.error('Create tag error:', err);
        res.status(500).json({ error: 'Failed to create tag.' });
    }
});

// ──────────────── DELETE /api/tags/:name ────────────────
router.delete('/:name', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { name } = req.params;
        const db = getDB();

        const result = await db.collection('tags').deleteOne({ name: name.toLowerCase() });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Tag not found.' });
        }

        await cacheDel('tags:all');
        res.json({ message: 'Tag deleted.' });
    } catch (err) {
        console.error('Delete tag error:', err);
        res.status(500).json({ error: 'Failed to delete tag.' });
    }
});

module.exports = router;
