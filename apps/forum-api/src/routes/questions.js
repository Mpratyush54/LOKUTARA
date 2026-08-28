// ─── Question Routes ──────────────────────────────────────────────
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { moderateContent, cleanText } = require('../middleware/moderation');
const { emitToRooms, buildTagRooms } = require('../utils/socketEmitter');

const router = express.Router();


// ──────────────── Helper: Anonymize Question ────────────────
function anonymizeQuestion(question, viewer) {
    if (!question || !question.user) return question;

    const isAuthor = viewer && viewer._id === question.userId;

    const isAdmin = viewer && viewer.role === 'admin';

    if (isAuthor || isAdmin) return question;

    return {
        ...question,
        user: {
            ...question.user,
            id: null,
            name: 'Anonymous Student',
            avatar: null,
            verified: false
        }
    };
}


// ──────────────── GET /api/questions ────────────────
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            tag,
            status,
            search,
            sort = 'newest',
            userId,
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const { ownerOnly } = req.query;
        const cacheKey = `questions:${JSON.stringify({ page, limit, tag, status, search, sort, userId, ownerOnly })}`;
        const cached = await cacheGet(cacheKey);

        if (cached) {
            return res.json({
                ...cached,
                questions: cached.questions.map(q => anonymizeQuestion(q, req.user))
            });
        }

        const db = getDB();
        const filter = { removed: { $ne: true } };

        if (tag) filter.tags = tag;
        if (status) filter.status = status;
        if (userId) filter.userId = userId;

        // Handle ownerOnly flag
        if (req.query.ownerOnly === 'true') {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required for ownerOnly.' });
            }
            filter.userId = req.user._id.toString();
        }

        if (search) filter.$text = { $search: search };

        if (req.user?.role === 'admin' && req.query.includeRemoved === 'true') {
            delete filter.removed;
        }

        let sortObj = { createdAt: -1 };
        if (sort === 'oldest') sortObj = { createdAt: 1 };
        if (sort === 'popular') sortObj = { views: -1 };
        if (sort === 'unanswered') {
            filter.status = 'pending';
            sortObj = { createdAt: -1 };
        }

        const [questions, total] = await Promise.all([
            db.collection('questions').find(filter).sort(sortObj).skip(skip).limit(limitNum).toArray(),
            db.collection('questions').countDocuments(filter),
        ]);

        const userIds = [...new Set(questions.map(q => q.userId))];

        const users = await db.collection('users')
            .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }, { projection: { password: 0 } })
            .toArray();

        const userMap = {};
        users.forEach(u => userMap[u._id.toString()] = u);

        const result = {
            questions: questions.map(q => ({
                ...q,
                id: q._id.toString(),
                user: userMap[q.userId] || null,
                answerCount: q.answerCount || 0,
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        };

        await cacheSet(cacheKey, result, 60);

        res.json({
            ...result,
            questions: result.questions.map(q => anonymizeQuestion(q, req.user))
        });


    } catch (err) {
        // specific handling for missing text index (code 27)
        if (err.code === 27 || (err.codeName === 'IndexNotFound' && err.message.includes('text index'))) {
            console.warn('⚠️ Text index missing, falling back to regex search');

            // Remove text search and use regex instead
            delete filter.$text;
            if (search) {
                const searchRegex = new RegExp(search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
                filter.$or = [
                    { title: { $regex: searchRegex } },
                    { description: { $regex: searchRegex } }
                ];
            }

            try {
                // Retry query with regex
                const [questions, total] = await Promise.all([
                    db.collection('questions').find(filter).sort(sortObj).skip(skip).limit(limitNum).toArray(),
                    db.collection('questions').countDocuments(filter),
                ]);

                // ... reuse existing logic for mapping users since filter changed but processing is same
                // We need to duplicate the user fetching logic here or refactor.
                // For simplicity/safety, duplicating key parts, or better: 
                // Let's refactor the meaningful parts out if possible, but given constraints,
                // I'll just re-run the user fetch logic here.

                const userIds = [...new Set(questions.map(q => q.userId))];

                const users = await db.collection('users')
                    .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }, { projection: { password: 0 } })
                    .toArray();

                const userMap = {};
                users.forEach(u => userMap[u._id.toString()] = u);

                const result = {
                    questions: questions.map(q => ({
                        ...q,
                        id: q._id.toString(),
                        user: userMap[q.userId] || null,
                        answerCount: q.answerCount || 0,
                    })),
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total,
                        totalPages: Math.ceil(total / limitNum),
                    },
                };

                await cacheSet(cacheKey, result, 60);

                return res.json({
                    ...result,
                    questions: result.questions.map(q => anonymizeQuestion(q, req.user))
                });

            } catch (retryErr) {
                console.error('Retry with regex failed:', retryErr);
                return res.status(500).json({ error: 'Failed to fetch questions (retry failed).' });
            }
        }

        console.error('Get questions error:', err);
        res.status(500).json({ error: 'Failed to fetch questions.' });
    }
});


// ──────────────── GET /api/questions/:id ────────────────
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const db = getDB();
        const questionId = new ObjectId(req.params.id);

        const question = await db.collection('questions')
            .findOne({ _id: questionId, removed: { $ne: true } });

        if (!question) {
            return res.status(404).json({ error: 'Question not found.' });
        }

        // increment views
        await db.collection('questions').updateOne(
            { _id: questionId },
            { $inc: { views: 1 } }
        );

        // fetch answers
        const answers = await db.collection('answers')
            .find({ questionId: req.params.id, removed: { $ne: true } })
            .sort({ isBest: -1, upvotes: -1, createdAt: 1 })
            .toArray();

        // fetch users
        const userIds = [...new Set([question.userId, ...answers.map(a => a.userId)])];

        const users = await db.collection('users')
            .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } })
            .project({ password: 0 })
            .toArray();

        const userMap = {};
        users.forEach(u => {
            userMap[u._id.toString()] = u;
        });

        // find liked answers for current user
        let likedSet = new Set();

        if (req.user && answers.length) {
            const liked = await db.collection('likes')
                .find({
                    userId: req.user._id.toString(),
                    targetType: 'answer',
                    targetId: { $in: answers.map(a => a._id.toString()) }
                })
                .project({ targetId: 1 })
                .toArray();

            likedSet = new Set(liked.map(l => l.targetId));
        }

        // ⭐ VERY IMPORTANT — sanitize answers (NO raw spread)
        const cleanAnswers = answers.map(a => ({
            id: a._id.toString(),
            content: a.content,
            upvotes: a.upvotes || 0,
            isBest: a.isBest || false,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            user: userMap[a.userId] || null,
            isLikedByMe: likedSet.has(a._id.toString())
        }));

        const result = {
            id: question._id.toString(),
            title: question.title,
            description: question.description,
            tags: question.tags || [],
            views: question.views || 0,
            answerCount: question.answerCount || 0,
            createdAt: question.createdAt,
            updatedAt: question.updatedAt,
            user: userMap[question.userId] || null,
            answers: cleanAnswers
        };

        res.json(anonymizeQuestion(result, req.user));

    } catch (err) {
        console.error('Get question error:', err);
        res.status(500).json({ error: 'Failed to fetch question.' });
    }
});

// ──────────────── POST /api/questions ────────────────
router.post('/', authenticate, moderateContent(['title', 'description']), async (req, res) => {
    try {
        const { title, description, tags } = req.body;
        const db = getDB();

        // Check dynamic rate limit from Config
        const CACHE_KEY = 'config:launch_status';
        let configStatus = await cacheGet(CACHE_KEY);
        if (!configStatus) {
            const configDoc = await db.collection('config').findOne({ _id: 'launch_status' });
            configStatus = { questionRateLimit: configDoc?.questionRateLimit || 5 };
            await cacheSet(CACHE_KEY, configStatus, 300);
        }

        const maxQuestions = configStatus.questionRateLimit || 5;
        const rateLimitKey = `rate_limit:questions:${req.user._id}`;

        const currentCount = await cacheGet(rateLimitKey);
        if (currentCount && currentCount >= maxQuestions) {
            return res.status(429).json({ error: `You have reached the limit of ${maxQuestions} questions per minute. Please wait.` });
        }

        // Increment user's question count (TTL 60 seconds)
        await cacheSet(rateLimitKey, (currentCount || 0) + 1, 60);

        const newQuestion = {
            userId: req.user._id.toString(),
            title: cleanText(title.trim()),
            description: cleanText(description.trim()),
            tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
            views: 0,
            answerCount: 0,
            status: 'pending',
            removed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('questions').insertOne(newQuestion);
        newQuestion._id = result.insertedId;
        newQuestion.id = result.insertedId.toString();

        // Auto-generate report for moderation warnings
        if (req.moderationWarnings && req.moderationWarnings.length > 0) {
            try {
                await db.collection('reports').insertOne({
                    reporterId: null, // System
                    targetType: 'question',
                    targetId: newQuestion.id,
                    reason: 'Automated Warning: ' + req.moderationWarnings.join(', '),
                    details: 'Content flagged by auto-moderation but allowed with warning.',
                    status: 'pending',
                    createdAt: new Date(),
                });
            } catch (rErr) {
                console.error('Failed to auto-report question:', rErr);
            }
        }

        await cacheDel('questions:*');

        if (req.io) {
            const tags = newQuestion.tags || [];
            const rooms = ['explore_feed', ...buildTagRooms(tags)];
            emitToRooms(req.io, {
                rooms,
                event: 'new_question',
                data: { ...newQuestion, user: req.user },
                tags,
            });
        }

        res.status(201).json({
            message: 'Question posted successfully!',
            question: newQuestion,
        });

    } catch (err) {
        console.error('Create question error:', err);
        res.status(500).json({ error: 'Failed to post question.' });
    }
});


// ──────────────── PUT /api/questions/:id ────────────────
router.put('/:id', authenticate, moderateContent(['title', 'description']), async (req, res) => {
    try {
        const questionId = new ObjectId(req.params.id);
        const db = getDB();

        const question = await db.collection('questions')
            .findOne({ _id: questionId, removed: { $ne: true } });

        if (!question) return res.status(404).json({ error: 'Question not found.' });

        if (question.userId !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'You can only edit your own questions.' });
        }

        const updates = {};
        if (req.body.title) updates.title = cleanText(req.body.title.trim());
        if (req.body.description) updates.description = cleanText(req.body.description.trim());
        if (req.body.tags) updates.tags = req.body.tags.slice(0, 5);
        updates.updatedAt = new Date();

        await db.collection('questions').updateOne({ _id: questionId }, { $set: updates });

        const updatedQuestion = await db.collection('questions').findOne({ _id: questionId });

        await cacheDel(`question:${req.params.id}`);
        await cacheDel('questions:*');

        if (req.io && updatedQuestion) {
            const tags = updatedQuestion.tags || [];
            const rooms = ['explore_feed', ...buildTagRooms(tags)];
            emitToRooms(req.io, {
                rooms,
                event: 'question_updated',
                data: updatedQuestion,
                tags,
            });
        }

        res.json({ message: 'Question updated successfully.', question: updatedQuestion });

    } catch (err) {
        console.error('Update question error:', err);
        res.status(500).json({ error: 'Failed to update question.' });
    }
});


// ──────────────── DELETE /api/questions/:id ────────────────
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const questionId = new ObjectId(req.params.id);
        const db = getDB();

        const question = await db.collection('questions')
            .findOne({ _id: questionId, removed: { $ne: true } });

        if (!question) return res.status(404).json({ error: 'Question not found.' });

        if (question.userId !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'You can only delete your own questions.' });
        }

        await db.collection('questions').updateOne(
            { _id: questionId },
            { $set: { removed: true, removedAt: new Date(), removedBy: req.user._id.toString() } }
        );

        await cacheDel(`question:${req.params.id}`);
        await cacheDel('questions:*');

        if (req.io) {
            const tags = question.tags || [];
            const rooms = ['explore_feed', ...buildTagRooms(tags)];
            emitToRooms(req.io, {
                rooms,
                event: 'question_deleted',
                data: { id: questionId.toString() },
                tags,
            });
        }

        res.json({ message: 'Question deleted successfully.' });

    } catch (err) {
        console.error('Delete question error:', err);
        res.status(500).json({ error: 'Failed to delete question.' });
    }
});

module.exports = router;
