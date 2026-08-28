// ─── Database Connection ───────────────────────────────────────────
const { MongoClient } = require('mongodb');
require('dotenv').config();

let db = null;
let client = null;

async function connectDB() {
    if (db) return db;

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/forum';
    client = new MongoClient(uri);

    await client.connect();
    db = client.db();
    console.log('✅ Connected to MongoDB');

    return db;
}

function getDB() {
    if (!db) throw new Error('Database not initialized. Call connectDB() first.');
    return db;
}

async function closeDB() {
    if (client) {
        await client.close();
        db = null;
        client = null;
        console.log('🔌 MongoDB connection closed');
    }
}

module.exports = { connectDB, getDB, closeDB };
