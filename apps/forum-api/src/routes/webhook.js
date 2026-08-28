// ─── Webhook Routes ──────────────────────────────────────────────────
const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');
const { getDB } = require('../config/database');

const router = express.Router();

function generatePassword(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!';
    let pwd = '';
    for (let i = 0; i < length; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
}

// ──────────────── SECURE API KEY MIDDLEWARE ────────────────
async function requireSheetApiKey(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'] || req.body?.apiKey || req.query?.apiKey;

        const db = getDB();
        let configDoc = await db.collection('config').findOne({ _id: 'sheet_api_key' });
        let validKey = configDoc?.key;

        if (!validKey) {
            validKey = crypto.randomBytes(32).toString('hex');
            await db.collection('config').updateOne(
                { _id: 'sheet_api_key' },
                { $set: { key: validKey } },
                { upsert: true }
            );
            console.warn(`\n\n[⚠️ WEBHOOK ALERT] Generated a new SHEET_API_KEY for Google Sheets integrations!`);
            console.warn(`Key: ${validKey}`);
            console.warn(`Please copy this and use it in your Google Apps Script.\n\n`);
        }

        if (!apiKey) {
            return res.status(401).json({ error: 'API key missing. Provide x-api-key header.' });
        }

        const keyBuffer = Buffer.from(apiKey);
        const validKeyBuffer = Buffer.from(validKey);

        // Using timingSafeEqual prevents timing attacks, ensuring it "never gets compromised"
        if (keyBuffer.length !== validKeyBuffer.length || !crypto.timingSafeEqual(keyBuffer, validKeyBuffer)) {
            return res.status(403).json({ error: 'Invalid API key.' });
        }

        next();
    } catch (err) {
        console.error('API Key error:', err);
        res.status(500).json({ error: 'Server auth error.' });
    }
}

// ──────────────── POST /create-user ────────────────
// Exposed specifically for Google Sheets integrations
router.post('/create-user', requireSheetApiKey, async (req, res) => {
    try {
        const { name, email, role, profession, expertise } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required.' });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email address.' });
        }

        const db = getDB();

        // Check if user already exists
        const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        // Generate a strong random password
        const plainPassword = generatePassword(12);
        const hashedPassword = await bcrypt.hash(plainPassword, 12);

        const userRole = role === 'specialist' ? 'specialist' : 'student';
        const avatarEmoji = userRole === 'specialist' ? '👨‍⚕️' : '👨‍🎓';

        const newUser = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role: userRole,
            avatar: avatarEmoji,
            verified: userRole === 'specialist' ? false : true,
            banned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            upvotedAnswers: [],
            warnings: [],
            source: 'google_sheet_api'
        };

        if (profession) newUser.profession = profession;
        if (expertise) newUser.expertise = expertise;

        const result = await db.collection('users').insertOne(newUser);

        res.status(201).json({
            message: 'User created successfully.',
            user: {
                id: result.insertedId.toString(),
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                password: plainPassword, // Returned once so the Google Sheet script can email it or store it temporarily
            }
        });
    } catch (err) {
        console.error('Webhook create-user error:', err);
        res.status(500).json({ error: 'Failed to create user.' });
    }
});

module.exports = router;
