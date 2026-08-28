
const { getDB } = require('../config/database');

const reportSchema = {
    $jsonSchema: {
        bsonType: 'object',
        required: ['reporterId', 'targetType', 'targetId', 'reason', 'status', 'createdAt'],
        properties: {
            reporterId: {
                bsonType: ['string', 'null'],
                description: 'User ID of the reporter'
            },
            targetType: {
                enum: ['question', 'answer', 'user'],
                description: 'Type of content being reported'
            },
            targetId: {
                bsonType: 'string',
                description: 'ID of the reported content'
            },
            reason: {
                bsonType: 'string',
                minLength: 1,
                description: 'Reason for the report'
            },
            details: {
                bsonType: ['string', 'null'],
                description: 'Additional details (optional)'
            },
            status: {
                enum: ['pending', 'resolved', 'dismissed'],
                description: 'Status of the report'
            },
            createdAt: {
                bsonType: 'date'
            },
            resolvedAt: {
                bsonType: ['date', 'null']
            },
            resolvedBy: {
                bsonType: ['string', 'null']
            }
        }
    }
};

async function createReportCollection() {
    const db = getDB();
    const collections = await db.listCollections({ name: 'reports' }).toArray();

    if (collections.length === 0) {
        await db.createCollection('reports', { validator: reportSchema });
        console.log('✅ Created reports collection with schema validation');
    } else {
        await db.command({
            collMod: 'reports',
            validator: reportSchema
        });
        console.log('✅ Updated reports collection schema validation');
    }

    // Create indexes
    await db.collection('reports').createIndex({ status: 1 });
    await db.collection('reports').createIndex({ targetType: 1, targetId: 1 });
    await db.collection('reports').createIndex({ createdAt: -1 });
    await db.collection('reports').createIndex({ reporterId: 1 });
}

module.exports = { createReportCollection };
