
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function forceIndex() {
    const uri = process.env.MONGODB_URI;
    console.log('Connecting...');
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db();
        console.log('Connected.');

        console.log('Attempting to create text index on "questions"...');
        const start = Date.now();

        await db.collection('questions').createIndex(
            { title: 'text', description: 'text' },
            { name: 'question_text_search', background: true } // Try background build
        );

        console.log(`✅ Text index created in ${(Date.now() - start) / 1000}s`);

    } catch (err) {
        console.error('❌ Index creation failed:', err);
    } finally {
        await client.close();
        process.exit(0);
    }
}

forceIndex();
