const { getDB } = require('../config/database');

const questionSchema = {
    $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'title', 'description', 'status'],
        properties: {
            userId: {
                bsonType: 'string',
                description: 'must be a string referencing a user'
            },
            title: {
                bsonType: 'string',
                minLength: 10,
                maxLength: 300,
                description: 'must be a string between 10 and 300 chars and is required'
            },
            description: {
                bsonType: 'string',
                minLength: 20,
                description: 'must be a string at least 20 chars long'
            },
            tags: {
                bsonType: 'array',
                maxItems: 5,
                items: {
                    bsonType: 'string'
                }
            },
            views: {
                bsonType: 'number',
                minimum: 0
            },
            answerCount: {
                bsonType: 'number',
                minimum: 0
            },
            status: {
                enum: ['pending', 'answered', 'closed'],
                description: 'can only be one of the enum values and is required'
            },
            createdAt: {
                bsonType: 'date'
            },
            removed: {
                bsonType: 'bool'
            }
        }
    }
};

async function createQuestionCollection() {
    const db = getDB();
    const collections = await db.listCollections({ name: 'questions' }).toArray();

    if (collections.length === 0) {
        await db.createCollection('questions', { validator: questionSchema });
    } else {
        await db.command({
            collMod: 'questions',
            validator: questionSchema
        });
    }

    // Create indexes
    await db.collection('questions').createIndex({ userId: 1 });
    await db.collection('questions').createIndex({ tags: 1 });
    await db.collection('questions').createIndex({ status: 1 });
    await db.collection('questions').createIndex({ createdAt: -1 });
    await db.collection('questions').createIndex(
        { title: 'text', description: 'text' },
        { name: 'question_text_search' }
    );
}

module.exports = { createQuestionCollection };
