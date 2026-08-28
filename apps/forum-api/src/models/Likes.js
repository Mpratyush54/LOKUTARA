const { getDB } = require('../config/database');

const likeSchema = {
    $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'targetId', 'targetType', 'createdAt'],
        properties: {
            userId: {
                bsonType: 'string',
                description: 'must be a string referencing the user who liked'
            },

            targetId: {
                bsonType: 'string',
                description: 'must be a string referencing question or answer id'
            },

            targetType: {
                enum: ['question', 'answer'],
                description: 'defines what is being liked'
            },

            createdAt: {
                bsonType: 'date',
                description: 'timestamp of like'
            }
        }
    }
};

async function createLikesCollection() {
    const db = getDB();
    const collections = await db.listCollections({ name: 'likes' }).toArray();

    if (collections.length === 0) {
        await db.createCollection('likes', { validator: likeSchema });
    } else {
        await db.command({
            collMod: 'likes',
            validator: likeSchema
        });
    }

    // 🔥 Prevent duplicate likes
    await db.collection('likes').createIndex(
        { userId: 1, targetId: 1, targetType: 1 },
        { unique: true }
    );

    // 🔥 Fast count likes on target
    await db.collection('likes').createIndex({ targetId: 1 });

    // 🔥 Get everything user liked
    await db.collection('likes').createIndex({ userId: 1 });

    // 🔥 Feed performance
    await db.collection('likes').createIndex({ targetType: 1 });

    // 🔥 Sort by time (optional analytics)
    await db.collection('likes').createIndex({ createdAt: -1 });
}

module.exports = { createLikesCollection };
