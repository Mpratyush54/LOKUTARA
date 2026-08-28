const express = require('express');
const { getDB } = require('../config/database');
const { cacheSet, cacheDel } = require('../config/redis');
const { authenticate, authorize } = require('../middleware/auth');
const { ObjectId } = require('mongodb');

const router = express.Router();

// ──────────────── GET /api/moderation/blocked-words ────────────────
router.get('/blocked-words', authenticate, authorize('admin'), async (req, res) => {
    try {
        const db = getDB();
        const words = await db.collection('blocked_words')
            .find({})
            .sort({ word: 1 })
            .toArray();

        res.json(words.map(w => w.word));
    } catch (err) {
        console.error('Get blocked words error:', err);
        res.status(500).json({ error: 'Failed to fetch blocked words.' });
    }
});

// ──────────────── POST /api/moderation/blocked-words ────────────────
router.post('/blocked-words', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { words } = req.body;

        if (!Array.isArray(words) || words.length === 0) {
            return res.status(400).json({ error: 'Provide an array of words.' });
        }

        const db = getDB();
        const operations = words.map(word => ({
            updateOne: {
                filter: { word: word.toLowerCase().trim() },
                update: { $setOnInsert: { word: word.toLowerCase().trim(), addedAt: new Date(), addedBy: req.user._id.toString() } },
                upsert: true
            }
        }));

        await db.collection('blocked_words').bulkWrite(operations);

        // Invalidate cache so middleware refreshes immediately on next check (after 30s debounce or tweak debounce)
        // Ideally we should force refresh, but the debounce prevents it. 
        // We will clear the REDIS cache, so other instances will pick it up.
        await cacheDel('blocked_words');

        res.status(201).json({ message: 'Blocked words updated successfully.' });
    } catch (err) {
        console.error('Add blocked words error:', err);
        res.status(500).json({ error: 'Failed to add blocked words.' });
    }
});

// ──────────────── DELETE /api/moderation/blocked-words/:word ────────────────
router.delete('/blocked-words/:word', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { word } = req.params;
        const db = getDB();

        await db.collection('blocked_words').deleteOne({ word: word.toLowerCase().trim() });
        await cacheDel('blocked_words');

        res.json({ message: 'Blocked word removed.' });
    } catch (err) {
        console.error('Remove blocked word error:', err);
        res.status(500).json({ error: 'Failed to remove blocked word.' });
    }
});

// ──────────────── GET /api/moderation/reports ────────────────
// (Existing reports route - moving here if not already or keeping in server.js?)
// Reports route was defined in Swagger but handled where? 
// It seems I missed implementing the routes for Reports! 
// I will add them here.

router.post('/report', authenticate, async (req, res) => {
    try {
        const { targetType, targetId, reason, details } = req.body;

        if (!['question', 'answer', 'user'].includes(targetType)) {
            return res.status(400).json({ error: 'Invalid target type.' });
        }

        const db = getDB();
        const report = {
            reporterId: req.user._id.toString(),
            targetType,
            targetId,
            reason,
            details,
            status: 'pending',
            createdAt: new Date(),
        };

        await db.collection('reports').insertOne(report);
        res.status(201).json({ message: 'Report submitted successfully.' });
    } catch (err) {
        console.error('Report error:', err);
        res.status(500).json({ error: 'Failed to submit report.' });
    }
});

router.get('/reports', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { status = 'pending', page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const db = getDB();

        const [reports, total] = await Promise.all([
            db.collection('reports')
                .find({ status })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            db.collection('reports').countDocuments({ status })
        ]);

        // Enrich reports with reporter and target details
        const reporterIds = [...new Set(reports.map(r => r.reporterId).filter(id => id))];

        // Collect target IDs by type
        const userIds = [];
        const questionIds = [];
        const answerIds = [];

        reports.forEach(r => {
            try {
                if (!r.targetId) return;
                const id = new ObjectId(r.targetId);

                if (r.targetType === 'user') userIds.push(id);
                if (r.targetType === 'question') questionIds.push(id);
                if (r.targetType === 'answer') answerIds.push(id);
            } catch (e) { /* ignore invalid ids */ }
        });

        const [reporters, targetUsers, targetQuestions, targetAnswers] = await Promise.all([
            // Fetch reporters
            reporterIds.length > 0
                ? db.collection('users').find({ _id: { $in: reporterIds.map(id => new ObjectId(id)) } }).project({ name: 1, email: 1, avatar: 1 }).toArray()
                : [],
            // Fetch target users
            userIds.length > 0
                ? db.collection('users').find({ _id: { $in: userIds } }).project({ name: 1, email: 1, avatar: 1, role: 1 }).toArray()
                : [],
            // Fetch target questions
            questionIds.length > 0
                ? db.collection('questions').find({ _id: { $in: questionIds } }).project({ title: 1, description: 1, userId: 1 }).toArray()
                : [],
            // Fetch target answers
            answerIds.length > 0
                ? db.collection('answers').find({ _id: { $in: answerIds } }).project({ content: 1, questionId: 1, userId: 1 }).toArray()
                : []
        ]);

        const reporterMap = {};
        reporters.forEach(u => reporterMap[u._id.toString()] = u);

        const targetMap = {
            user: {},
            question: {},
            answer: {}
        };
        targetUsers.forEach(u => targetMap.user[u._id.toString()] = { ...u, type: 'User' });
        targetQuestions.forEach(q => targetMap.question[q._id.toString()] = { ...q, type: 'Question' });
        targetAnswers.forEach(a => targetMap.answer[a._id.toString()] = { ...a, type: 'Answer' });

        const enrichedReports = reports.map(r => ({
            ...r,
            reporter: r.reporterId ? (reporterMap[r.reporterId] || { name: 'Unknown' }) : { name: 'System (Auto)' },
            target: targetMap[r.targetType] ? (targetMap[r.targetType][r.targetId] || null) : null
        }));

        res.json({
            reports: enrichedReports,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error('Get reports error:', err);
        res.status(500).json({ error: 'Failed to fetch reports.' });
    }
});

// ──────────────── GET /api/moderation/logs ────────────────
router.get('/logs', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const db = getDB();

        const [logs, total] = await Promise.all([
            db.collection('moderation_logs')
                .find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            db.collection('moderation_logs').countDocuments({})
        ]);

        res.json({
            logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error('Get moderation logs error:', err);
        res.status(500).json({ error: 'Failed to fetch moderation logs.' });
    }
});

// ──────────────── PATCH /api/moderation/reports/:id ────────────────
router.patch('/reports/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['resolved', 'dismissed', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }

        const { ObjectId } = require('mongodb');
        let reportId;
        try {
            reportId = new ObjectId(id);
        } catch {
            return res.status(400).json({ error: 'Invalid report ID.' });
        }

        const db = getDB();
        const result = await db.collection('reports').updateOne(
            { _id: reportId },
            {
                $set: {
                    status,
                    resolvedAt: new Date(),
                    resolvedBy: req.user._id.toString()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Report not found.' });
        }

        res.json({ message: `Report marked as ${status}.` });
    } catch (err) {
        console.error('Update report status error:', err);
        res.status(500).json({ error: 'Failed to update report status.' });
    }
});

module.exports = router;
