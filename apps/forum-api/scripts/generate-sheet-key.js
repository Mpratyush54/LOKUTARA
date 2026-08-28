require('dotenv').config();
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// Get MONGO_URI from env or use default local URI
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forum';

async function generateSheetKey() {
    let client;
    try {
        console.log('Connecting to database...');
        client = new MongoClient(MONGO_URI);
        await client.connect();

        const db = client.db(); // It uses the database from the URI

        // Generate a 32-byte secure random hex key
        const validKey = crypto.randomBytes(32).toString('hex');

        console.log('Inserting key into config collection...');
        await db.collection('config').updateOne(
            { _id: 'sheet_api_key' },
            { $set: { key: validKey, updatedAt: new Date() } },
            { upsert: true }
        );

        console.log(`\n\n✅ [SUCCESS] Generated and saved a new SHEET_API_KEY!`);
        console.log(`Key: ${validKey}`);
        console.log(`Please copy this exact key and use it in your Google Apps Script.\n\n`);

    } catch (err) {
        console.error('❌ Error generating key:', err);
    } finally {
        if (client) {
            await client.close();
            console.log('Database connection closed.');
        }
        process.exit(0);
    }
}

generateSheetKey();
