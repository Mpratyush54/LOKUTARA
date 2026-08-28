const { getDB } = require('../config/database');

const configSchema = {
    $jsonSchema: {
        bsonType: 'object',
        properties: {
            _id: {
                bsonType: 'string', // 'launch_status'
                description: 'Unique identifier for the config object'
            },
            isLaunched: {
                bsonType: 'bool',
                description: 'Whether the application is publicly accessible'
            },
            launchDate: {
                bsonType: 'string',
                description: 'The target launch date/time in ISO string format'
            },
            bypassToken: {
                bsonType: ['string', 'null'],
                description: 'A token used by admins to bypass the launch screen'
            },
            allowSignups: {
                bsonType: 'bool',
                description: 'Whether new users are allowed to sign up'
            },
            questionRateLimit: {
                bsonType: 'number',
                description: 'The maximum number of questions a user can submit in 1 minute'
            },
            updatedAt: {
                bsonType: 'date',
                description: 'Timestamp of the last config update'
            }
        }
    }
};

async function createConfigCollection() {
    const db = getDB();
    const collections = await db.listCollections({ name: 'config' }).toArray();

    if (collections.length === 0) {
        await db.createCollection('config', { validator: configSchema });
        console.log('✅ Created config collection');

        // Populate defaults if none exists
        await db.collection('config').insertOne({
            _id: 'launch_status',
            isLaunched: true,
            launchDate: new Date().toISOString(),
            bypassToken: null,
            allowSignups: true,
            questionRateLimit: 5,
            updatedAt: new Date()
        });
        console.log('✅ Seeded default config');
    } else {
        await db.command({
            collMod: 'config',
            validator: configSchema
        });
    }
}

module.exports = { createConfigCollection };
