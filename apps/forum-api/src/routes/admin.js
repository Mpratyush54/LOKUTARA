const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { cacheDel } = require('../config/redis');

const router = express.Router();

// ──────────────── Middleware: Admin Only for all routes ────────────────
router.use(authenticate, authorize('admin'));

// ──────────────── GET /api/admin/stats ────────────────
router.get('/stats', async (req, res) => {
    try {
        const db = getDB();

        // Calculate "new posts" (questions created effectively in the last 24h)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const [
            totalUsers,
            specialistsCount,
            newPosts,
            pendingReports
        ] = await Promise.all([
            db.collection('users').countDocuments({}),
            db.collection('users').countDocuments({ role: 'specialist' }),
            db.collection('questions').countDocuments({ createdAt: { $gte: yesterday } }),
            db.collection('reports').countDocuments({ status: 'pending' })
        ]);

        res.json({
            totalUsers,
            newPosts, // Questions in last 24h,
            pendingReports,
            specialistsCount
        });
    } catch (err) {
        console.error('Get admin stats error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics.' });
    }
});

// ──────────────── GET /api/admin/questions ────────────────
router.get('/questions', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const db = getDB();
        const filter = {}; // Show ALL, including removed

        if (status) filter.status = status;

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const [questions, total] = await Promise.all([
            db.collection('questions')
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            db.collection('questions').countDocuments(filter)
        ]);

        // Fetch authors
        const userIds = [...new Set(questions.map(q => q.userId))];
        const users = await db.collection('users')
            .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }, { projection: { password: 0 } })
            .toArray();

        const userMap = {};
        users.forEach(u => userMap[u._id.toString()] = u);

        const result = questions.map(q => ({
            ...q,
            id: q._id.toString(),
            user: userMap[q.userId] || null
        }));

        res.json({
            questions: result,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error('Admin get questions error:', err);
        res.status(500).json({ error: 'Failed to fetch admin questions.' });
    }
});

// ──────────────── GET /api/admin/users ────────────────
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const db = getDB();
        const filter = {};

        if (role) {
            filter.role = role;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const [users, total] = await Promise.all([
            db.collection('users')
                .find(filter, { projection: { password: 0 } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            db.collection('users').countDocuments(filter)
        ]);

        res.json({
            users: users.map(u => ({ ...u, id: u._id.toString() })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error('Get admin users error:', err);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// ──────────────── PATCH /api/admin/users/:id/approve ────────────────
router.patch('/users/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;

        let userId;
        try {
            userId = new ObjectId(id);
        } catch {
            return res.status(400).json({ error: 'Invalid user ID.' });
        }

        const db = getDB();
        const result = await db.collection('users').updateOne(
            { _id: userId },
            {
                $set: {
                    verified: true,
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Invalidate user cache
        await cacheDel(`user:${id}`);
        await cacheDel(`userProfile:${id}`);
        await cacheDel('specialists:all');

        res.json({ message: 'User approved successfully.' });
    } catch (err) {
        console.error('Approve user error:', err);
        res.status(500).json({ error: 'Failed to approve user.' });
    }
});

// ──────────────── PATCH /api/admin/users/bulk-approve ────────────────
router.post('/users/bulk-approve', async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'userIds must be a non-empty array.' });
        }

        const uniqueIds = [...new Set(userIds)];
        const objectIds = [];
        const invalidIds = [];

        uniqueIds.forEach(id => {
            try {
                objectIds.push(new ObjectId(id));
            } catch {
                invalidIds.push(id);
            }
        });

        if (invalidIds.length > 0) {
            return res.status(400).json({ error: 'Invalid user IDs provided.', invalidIds });
        }

        const db = getDB();

        // Update users
        await db.collection('users').updateMany(
            { _id: { $in: objectIds } },
            {
                $set: {
                    verified: true,
                    updatedAt: new Date()
                }
            }
        );

        // Fetch the updated users to return details
        const users = await db.collection('users')
            .find({ _id: { $in: objectIds } }, { projection: { password: 0 } })
            .toArray();

        const results = users.map(u => ({ ...u, id: u._id.toString() }));

        // Invalidate caches for all modified users
        const promises = objectIds.map(id => Promise.all([
            cacheDel(`user:${id}`),
            cacheDel(`userProfile:${id}`)
        ]));
        await Promise.all(promises);
        await cacheDel('specialists:all');

        res.json({
            message: 'Users approved successfully.',
            users: results,
            count: results.length
        });
    } catch (err) {
        console.error('Bulk approve users error:', err);
        res.status(500).json({ error: 'Failed to bulk approve users.' });
    }
});

// ──────────────── PATCH /api/admin/users/:id/ban ────────────────
router.patch('/users/:id/ban', async (req, res) => {
    try {
        const { id } = req.params;
        const { banned, reason } = req.body;

        if (banned === undefined) {
            return res.status(400).json({ error: 'Banned status is required.' });
        }

        let userId;
        try {
            userId = new ObjectId(id);
        } catch {
            return res.status(400).json({ error: 'Invalid user ID.' });
        }

        const db = getDB();
        await db.collection('users').updateOne(
            { _id: userId },
            {
                $set: {
                    banned: Boolean(banned),
                    banReason: reason || null,
                    updatedAt: new Date()
                }
            }
        );

        // Invalidate user cache
        await cacheDel(`user:${id}`);
        await cacheDel(`userProfile:${id}`);

        res.json({ message: `User ${banned ? 'banned' : 'unbanned'} successfully.` });
    } catch (err) {
        console.error('Ban user error:', err);
        res.status(500).json({ error: 'Failed to update user ban status.' });
    }
});

// ──────────────── PATCH /api/admin/users/:id/role ────────────────
router.patch('/users/:id/role', async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['student', 'specialist', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }

        let userId;
        try {
            userId = new ObjectId(id);
        } catch {
            return res.status(400).json({ error: 'Invalid user ID.' });
        }

        const db = getDB();

        // Update fields based on role
        const updates = {
            role,
            updatedAt: new Date()
        };

        if (role === 'specialist') {
            updates.verified = false; // Specialists might need re-verification or explicit setting
        } else if (role === 'student') {
            updates.verified = false; // Students don't need verification usually, or reset it
            // Maybe clear profession/expertise if moving to student? 
            // For now, keep it simple.
        }

        await db.collection('users').updateOne(
            { _id: userId },
            { $set: updates }
        );

        // Invalidate user cache
        await cacheDel(`user:${id}`);
        await cacheDel(`userProfile:${id}`);
        await cacheDel('specialists:all');

        res.json({ message: 'User role updated successfully.' });
    } catch (err) {
        console.error('Update role error:', err);
        res.status(500).json({ error: 'Failed to update user role.' });
    }
});

// ──────────────── DELETE /api/admin/questions/:id ────────────────
router.delete('/questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let questionId;
        try {
            questionId = new ObjectId(id);
        } catch {
            return res.status(400).json({ error: 'Invalid question ID.' });
        }

        const db = getDB();

        // Soft delete
        const result = await db.collection('questions').updateOne(
            { _id: questionId },
            { $set: { removed: true, removedAt: new Date(), removedBy: req.user._id.toString() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Question not found.' });
        }

        // Invalidate caches
        await cacheDel(`question:${id}`);
        await cacheDel('questions:*');

        res.json({ message: 'Question force-deleted successfully.' });
    } catch (err) {
        console.error('Admin delete question error:', err);
        res.status(500).json({ error: 'Failed to delete question.' });
    }
});

// ──────────────── DELETE /api/admin/answers/:id ────────────────
router.delete('/answers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let answerId;
        try {
            answerId = new ObjectId(id);
        } catch {
            return res.status(400).json({ error: 'Invalid answer ID.' });
        }

        const db = getDB();
        const answer = await db.collection('answers').findOne({ _id: answerId });

        if (!answer) {
            return res.status(404).json({ error: 'Answer not found.' });
        }

        // Soft delete
        await db.collection('answers').updateOne(
            { _id: answerId },
            { $set: { removed: true, removedAt: new Date(), removedBy: req.user._id.toString() } }
        );

        // Update question answer count
        const answerCount = await db.collection('answers').countDocuments({
            questionId: answer.questionId,
            removed: { $ne: true },
        });

        let questionId;
        try {
            questionId = new ObjectId(answer.questionId);
        } catch {
            questionId = answer.questionId;
        }

        await db.collection('questions').updateOne(
            { _id: questionId },
            {
                $set: {
                    answerCount,
                    status: answerCount > 0 ? 'answered' : 'pending',
                    updatedAt: new Date(),
                },
            }
        );

        await cacheDel(`question:${answer.questionId}`);
        await cacheDel('questions:*');

        res.json({ message: 'Answer force-deleted successfully.' });
    } catch (err) {
        console.error('Admin delete answer error:', err);
        res.status(500).json({ error: 'Failed to delete answer.' });
    }
});

module.exports = router;
