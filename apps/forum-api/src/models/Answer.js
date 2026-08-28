const { getDB } = require('../config/database');

const answerSchema = {
    $jsonSchema: {
        bsonType: 'object',
        required: ['questionId', 'userId', 'content'],
        properties: {
            questionId: {
                bsonType: 'string',
                description: 'must be a string referencing a question'
            },
            userId: {
                bsonType: 'string',
                description: 'must be a string referencing a user'
            },
            content: {
                bsonType: 'string',
                minLength: 10,
                description: 'must be a string at least 10 chars long'
            },
            upvotes: {
                bsonType: 'int',
                minimum: 0
            },
            isBest: {
                bsonType: 'bool'
            },
            removed: {
                bsonType: 'bool'
            },
            createdAt: {
                bsonType: 'date'
            }
        }
    }
};

async function createAnswerCollection() {
    const db = getDB();
    const collections = await db.listCollections({ name: 'answers' }).toArray();

    if (collections.length === 0) {
        await db.createCollection('answers', { validator: answerSchema });
    } else {
        await db.command({
            collMod: 'answers',
            validator: answerSchema
        });
    }

    // Create indexes
    await db.collection('answers').createIndex({ questionId: 1 });
    await db.collection('answers').createIndex({ userId: 1 });
    await db.collection('answers').createIndex({ isBest: -1 });
}

module.exports = { createAnswerCollection };
