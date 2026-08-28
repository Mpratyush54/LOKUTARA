const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGO_URI;

if (!uri) {
    console.error('❌ MONGO_URI missing from .env');
    process.exit(1);
}

async function connectDB() {
    try {
        await mongoose.connect(uri, {
            maxPoolSize: 500,       // allow high concurrency
            minPoolSize: 20,        // keep warm connections ready
            socketTimeoutMS: 60000, // allow long ops but not too long
            connectTimeoutMS: 5000, // fail fast
            serverSelectionTimeoutMS: 3000,
            retryWrites: true,
            heartbeatFrequencyMS: 5000,
            autoIndex: false,        // IMPORTANT for performance in prod
        });

        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        setTimeout(connectDB, 5000); // Retry every 5 seconds
    }
}

mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('🔄 MongoDB reconnected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err));

connectDB();

module.exports = mongoose;
