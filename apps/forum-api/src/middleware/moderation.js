// ─── Content Moderation Middleware ─────────────────────────────────
const Filter = require('bad-words');
const { getDB } = require('../config/database');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { ObjectId } = require('mongodb');

let filter = new Filter();
let lastUpdate = 0;
const CACHE_TTL = 60 * 5; // 5 minutes local cache

async function handleUserWarning(userId, reasons) {
    if (!userId || userId === 'anonymous') return;

    try {
        const db = getDB();
        const uId = new ObjectId(userId);

        // Add warning
        const warning = { reason: reasons.join(', '), date: new Date(), seen: false };
        await db.collection('users').updateOne({ _id: uId }, { $push: { warnings: warning } });

        // Check for ban
        const user = await db.collection('users').findOne({ _id: uId });
        if (user && user.warnings && user.warnings.length >= 3) {
            await db.collection('users').updateOne(
                { _id: uId },
                { $set: { banned: true, banReason: 'System Ban: Repetitive violations.' } }
            );
            await cacheDel(`user:${userId}`);
        }
    } catch (err) {
        console.error('Warning handler error:', err);
    }
}

async function refreshFilter() {
    const now = Date.now();
    if (now - lastUpdate < 30000) return; // Debounce (30s)

    try {
        let words = await cacheGet('blocked_words');

        if (!words) {
            const db = getDB();
            const docs = await db.collection('blocked_words').find({}).toArray();
            words = docs.map(d => d.word);
            await cacheSet('blocked_words', words, 3600); // 1 hour in Redis
        }

        // Always include hardcoded defaults
        const defaults = ['scam', 'spam', 'phishing'];
        const allWords = [...new Set([...defaults, ...(words || [])])];

        // Re-initialize filter to ensure clean state
        filter = new Filter();
        if (allWords.length > 0) {
            filter.addWords(...allWords);
        }

        lastUpdate = now;
    } catch (err) {
        console.error('Failed to refresh blocked words:', err);
    }
}

// Patterns that indicate spam/unwanted content
const spamPatterns = [
    /(.)\1{10,}/i,                          // Repeated characters (aaaaaaaaaa)
    /https?:\/\/[^\s]{100,}/i,              // Extremely long URLs
    /(buy|sell|cheap|discount|offer|click here|earn money|free money)/i, // Spam phrases
    /\b\d{10,}\b/,                          // Long number sequences
    /(whatsapp|telegram|signal)\s*:?\s*\+?\d/i, // Contact solicitation
];

// Severity levels
const SEVERITY = {
    CLEAN: 'clean',
    WARNING: 'warning',
    BLOCKED: 'blocked',
};

function analyzeContent(text) {
    if (!text || typeof text !== 'string') {
        return { severity: SEVERITY.CLEAN, reasons: [] };
    }

    const reasons = [];

    // Check for profanity and identify specific words
    const foundProfaneWords = [];
    const lowerText = text.toLowerCase();
    for (const badWord of filter.list) { // filter.list contains the bad words
        if (lowerText.includes(badWord)) {
            foundProfaneWords.push(badWord);
        }
    }
    if (foundProfaneWords.length > 0) {
        reasons.push(`Contains profane or abusive language: ${[...new Set(foundProfaneWords)].join(', ')}`);
        // STRICT MODE: Profanity is an immediate block
        return { severity: SEVERITY.BLOCKED, reasons };
    }

    // Check for spam patterns
    for (const pattern of spamPatterns) {
        if (pattern.test(text)) {
            reasons.push('Contains spam-like content');
            // STRICT MODE: Spam is an immediate block
            return { severity: SEVERITY.BLOCKED, reasons };
        }
    }

    // Check for excessive caps (shouting)
    const capsRatio = (text.replace(/[^A-Z]/g, '').length) / Math.max(text.replace(/\s/g, '').length, 1);
    if (text.length > 20 && capsRatio > 0.7) {
        reasons.push('Excessive use of capital letters');
    }

    // Check for repeated content
    const words = text.toLowerCase().split(/\s+/);
    if (words.length > 5) {
        const uniqueRatio = new Set(words).size / words.length;
        if (uniqueRatio < 0.3) {
            reasons.push('Repetitive content detected');
        }
    }

    // Determine severity
    let severity = SEVERITY.CLEAN;
    if (reasons.length >= 1) { // Any remaining reason (caps, repetition) is a warning
        severity = SEVERITY.WARNING;
    }

    return { severity, reasons };
}

// Middleware to moderate content in request body
function moderateContent(fields = ['title', 'description', 'content']) {
    return async (req, res, next) => {
        // Ensure filter is up-to-date (debounced)
        await refreshFilter();

        const allReasons = [];
        let maxSeverity = SEVERITY.CLEAN;

        for (const field of fields) {
            if (req.body[field]) {
                const result = analyzeContent(req.body[field]);

                // Prioritize BLOCKED status
                if (result.severity === SEVERITY.BLOCKED) {
                    maxSeverity = SEVERITY.BLOCKED;
                    allReasons.push(...result.reasons.map(r => `${field}: ${r} (BLOCKED)`));
                    break; // Stop checking other fields if one is blocked
                }

                if (result.severity === SEVERITY.WARNING) {
                    if (maxSeverity !== SEVERITY.BLOCKED) maxSeverity = SEVERITY.WARNING;
                    allReasons.push(...result.reasons.map(r => `${field}: ${r}`));
                }
            }
        }

        if (maxSeverity === SEVERITY.BLOCKED) {
            // Log the BLOCK event
            try {
                const db = getDB();
                await db.collection('moderation_logs').insertOne({
                    userId: req.user?._id?.toString() || 'anonymous',
                    action: 'content_blocked',
                    content: req.body, // Log entire body for context
                    reasons: allReasons,
                    ip: req.ip,
                    createdAt: new Date(),
                });

                // Track user warning and potential ban
                if (req.user) {
                    await handleUserWarning(req.user._id, allReasons);
                }
            } catch { /* Fail silently */ }

            return res.status(400).json({
                error: 'Content contains inappropriate or prohibited material.',
                reasons: allReasons,
            });
        }

        // Log WARNING events too (for monitoring)
        if (maxSeverity === SEVERITY.WARNING) {
            req.moderationWarnings = allReasons;
            try {
                const db = getDB();
                await db.collection('moderation_logs').insertOne({
                    userId: req.user?._id?.toString() || 'anonymous',
                    action: 'content_warning',
                    content: req.body,
                    reasons: allReasons,
                    ip: req.ip,
                    createdAt: new Date(),
                });

                // Track user warning
                if (req.user) {
                    await handleUserWarning(req.user._id, allReasons);
                }
            } catch { /* Fail silently */ }
        }

        next();
    };
}



// Clean text (replace profane words with asterisks)
function cleanText(text) {
    if (!text) return text;
    try {
        return filter.clean(text);
    } catch {
        return text;
    }
}

module.exports = { moderateContent, analyzeContent, cleanText, SEVERITY };
