// ─── Auth Routes ──────────────────────────────────────────────────
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { cacheSet, cacheDel } = require('../config/redis');
const { authenticate, authorize } = require('../middleware/auth');
const { moderateContent } = require('../middleware/moderation');

const router = express.Router();

// ──────────────── Helper ────────────────
function generateToken(user) {
    return jwt.sign(
        { id: user._id.toString(), role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

function sanitizeUser(user) {
    const { password, ...safe } = user;
    return safe;
}

function generatePassword(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!';
    let pwd = '';
    for (let i = 0; i < length; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
}

// ──────────────── POST /api/auth/signup ────────────────
router.post('/signup', moderateContent(['name', 'profession', 'expertise']), async (req, res) => {
    try {
        const { name, email, password, role, avatar, profession, expertise } = req.body;

        // 1. Fetch launch configuration early
        const CACHE_KEY = 'config:launch_status';
        let status = await cacheGet(CACHE_KEY);
        if (!status) {
            const tempDb = getDB();
            const configDoc = await tempDb.collection('config').findOne({ _id: 'launch_status' });
            status = {
                isLaunched: configDoc?.isLaunched ?? true,
                launchDate: configDoc?.launchDate ?? new Date().toISOString(),
                bypassToken: configDoc?.bypassToken || null,
                allowSignups: configDoc?.allowSignups ?? true
            };
            await cacheSet(CACHE_KEY, status, 300);
        }

        if (status.allowSignups === false) {
            return res.status(403).json({ error: 'Signups are currently disabled by the administrator.' });
        }

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email address.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        if (name.length < 2 || name.length > 50) {
            return res.status(400).json({ error: 'Name must be between 2 and 50 characters.' });
        }

        const db = getDB();

        // Check if email already exists
        const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Determine defaults
        const userRole = role === 'specialist' ? 'specialist' : 'student';
        const defaultAvatar = userRole === 'specialist' ? '👨‍⚕️' : '👨‍🎓';

        // Create user
        const newUser = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role: userRole,
            verified: userRole === 'specialist' ? false : true,
            avatar: avatar || defaultAvatar,
            upvotedAnswers: [],
            warnings: [],
            banned: false,
            // banReason: null, // Omit to avoid validation complexity if any
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (profession) newUser.profession = profession;
        if (expertise) newUser.expertise = expertise;

        const result = await db.collection('users').insertOne(newUser);
        newUser._id = result.insertedId;

        const token = generateToken(newUser);

        res.status(201).json({
            message: 'Account created successfully!',
            token,
            user: sanitizeUser(newUser),
        });
    } catch (err) {
        console.error('Signup error:', err);
        if (err.code === 121) {
            console.error('Validation failure details:', JSON.stringify(err.errInfo, null, 2));
        }
        res.status(500).json({ error: 'Failed to create account.' });
    }
});

// ──────────────── POST /api/auth/login ────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const db = getDB();
        const user = await db.collection('users').findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        if (user.banned || !user.verified) {
            return res.status(403).json({ error: 'Your account has been suspended or is not verified.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Update last login
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date() } }
        );

        const token = generateToken(user);

        // Cache user session
        await cacheSet(`user:${user._id}`, sanitizeUser(user), 300);

        res.json({
            message: 'Login successful!',
            token,
            user: sanitizeUser(user),
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed.' });
    }
});

// ──────────────── GET /api/auth/me ────────────────
router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
});

// ──────────────── POST /api/auth/change-password ────────────────
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }

        const db = getDB();
        const user = await db.collection('users').findOne({ _id: req.user._id });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db.collection('users').updateOne(
            { _id: req.user._id },
            { $set: { password: hashedPassword, updatedAt: new Date() } }
        );

        // Invalidate cache
        await cacheDel(`user:${req.user._id}`);

        res.json({ message: 'Password changed successfully.' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Failed to change password.' });
    }
});

// ──────────────── POST /api/auth/bulk-create ────────────────
// Admin-only: Create multiple users at once from a list of emails and names
router.post('/bulk-create', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { users } = req.body;

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({
                error: 'Provide an array of users with "name" and "email" fields.',
                example: { users: [{ name: 'John Doe', email: 'john@example.com', role: 'student' }] },
            });
        }

        if (users.length > 500) {
            return res.status(400).json({ error: 'Maximum 500 users per batch.' });
        }

        const db = getDB();
        const results = [];
        const failed = [];

        for (const userData of users) {
            try {
                const { name, email, role } = userData;

                if (!name || !email) {
                    failed.push({ email: email || 'N/A', reason: 'Name and email are required.' });
                    continue;
                }

                if (!validator.isEmail(email)) {
                    failed.push({ email, reason: 'Invalid email address.' });
                    continue;
                }

                // Check if exists
                const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
                if (existing) {
                    failed.push({ email, reason: 'Email already registered.' });
                    continue;
                }

                // Generate a random password
                const plainPassword = generatePassword(10);
                const hashedPassword = await bcrypt.hash(plainPassword, 10);

                const avatarEmoji = role === 'specialist' ? '👨‍⚕️' : '👨‍🎓';
                const newUser = {
                    name: name.trim(),
                    email: email.toLowerCase().trim(),
                    password: hashedPassword,
                    role: role === 'specialist' ? 'specialist' : 'student',
                    avatar: avatarEmoji,
                    verified: false,
                    banned: false,
                    bulkCreated: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                const result = await db.collection('users').insertOne(newUser);

                results.push({
                    id: result.insertedId.toString(),
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    password: plainPassword, // Return plain password for distribution
                });
            } catch (err) {
                failed.push({ email: userData.email || 'N/A', reason: err.message });
            }
        }

        res.status(201).json({
            message: `Created ${results.length} users. ${failed.length} failed.`,
            users: results,
            failed,
        });
    } catch (err) {
        console.error('Bulk create error:', err);
        res.status(500).json({ error: 'Bulk user creation failed.' });
    }
});

// ──────────────── POST /api/auth/logout ────────────────
router.post('/logout', authenticate, async (req, res) => {
    try {
        await cacheDel(`user:${req.user._id}`);
        res.json({ message: 'Logged out successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Logout failed.' });
    }
});

module.exports = router;
