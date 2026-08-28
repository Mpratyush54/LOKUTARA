const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function migrateUpvotes() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/forum_db'; // Adjust if needed
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db();

        const users = await db.collection('users').find({}).toArray();
        console.log(`Found ${users.length} users to process.`);

        for (const user of users) {
            const userIdStr = user._id.toString();

            // Find all answers where this user is in the 'upvotedBy' array
            const upvotedAnswers = await db.collection('answers').find({
                upvotedBy: userIdStr
            }).toArray();

            if (upvotedAnswers.length > 0) {
                const upvotedAnswerIds = upvotedAnswers.map(a => a._id);

                // Update the user document
                await db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { upvotedAnswers: upvotedAnswerIds } }
                );
                console.log(`Updated user ${user.name} (${user._id}) with ${upvotedAnswerIds.length} upvotes.`);
            } else {
                // Initialize empty array if none
                await db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { upvotedAnswers: [] } }
                );
            }
        }

        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.close();
    }
}

migrateUpvotes();
