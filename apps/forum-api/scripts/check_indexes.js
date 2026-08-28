
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkIndexes() {
    console.log('Starting script...');
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set');
        return;
    }
    console.log('Connecting to:', uri.replace(/:([^:@]{1,})@/, ':****@')); // Mask password

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db();
        console.log('Connected to MongoDB');

        const collections = await db.listCollections({ name: 'questions' }).toArray();
        if (collections.length === 0) {
            console.log('Questions collection does not exist.');
        } else {
            console.log('Questions collection exists.');
            const indexes = await db.collection('questions').indexes();
            console.log('Existing indexes:', JSON.stringify(indexes, null, 2));

            // Try creating simple index
            console.log('Creating simple index { userId: 1 }...');
            try {
                await db.collection('questions').createIndex({ userId: 1 });
                console.log('Simple index created.');
            } catch (err) {
                console.error('Failed simple index creation:', err);
            }

            // Try creating text index
            console.log('Creating text index { title: "text", description: "text" }...');
            try {
                const result = await db.collection('questions').createIndex(
                    { title: 'text', description: 'text' },
                    { name: 'question_text_search' } // Optional name
                );
                console.log('Index creation result:', result);
            } catch (err) {
                console.error('Error creating text index:', err);
            }
        }

    } catch (err) {
        console.error('Global error:', err);
    } finally {
        await client.close();
        console.log('Closed connection');
    }
}

checkIndexes();
