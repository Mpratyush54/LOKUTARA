
const { getDB } = require('./database');
const { createQuestionCollection } = require('../models/Question');
const { createUserCollection } = require('../models/User');
const { createAnswerCollection } = require('../models/Answer');
const { createReportCollection } = require('../models/Report');
const { createLikesCollection } = require('../models/Likes');
const { createConfigCollection } = require('../models/Config');

async function initCollections() {
    const db = getDB();
    console.log('🔄 Initializing collections & schemas...');

    try {
        await Promise.all([
            createQuestionCollection(),
            createUserCollection(),
            createAnswerCollection(),
            createReportCollection(),
            createLikesCollection(),
            createConfigCollection(),
            initBlockedWords(db),
            initModerationLogs(db)
        ]);
        console.log('✅ All collections initialized successfully.');
    } catch (err) {
        console.error('❌ Error initializing collections:', err);
    }
}

async function initBlockedWords(db) {
    const collections = await db.listCollections({ name: 'blocked_words' }).toArray();
    if (collections.length === 0) {
        await db.createCollection('blocked_words');
        await db.collection('blocked_words').createIndex({ word: 1 }, { unique: true });
        console.log('✅ Created blocked_words collection');
    }
}

async function initModerationLogs(db) {
    // Just ensure index exists
    await db.collection('moderation_logs').createIndex({ createdAt: -1 });
    // Also index on moderatorId and action type if needed
    await db.collection('moderation_logs').createIndex({ moderatorId: 1 });
    await db.collection('moderation_logs').createIndex({ action: 1 });
}

module.exports = { initCollections };
