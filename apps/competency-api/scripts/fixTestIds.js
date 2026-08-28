//   await mongoose.connect("");

/**
 * 🚀 One-Time Migration Script
 * Converts all references from "testId" → "surveyId"
 * and updates all related collections accordingly.
 *
 * Run using:  node scripts/migrateToSurveyId.js
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI

// Collection names
const collections = {
  tests: 'tests',
  questions: 'questions',
  surveyresponses: 'surveyresponses',
  results: 'results',
  testindex: 'test_index',
};

async function migrateCollection(db, name) {
  const col = db.collection(name);
  const docs = await col.find({ testId: { $exists: true } }).toArray();

  if (!docs.length) {
    console.log(`✅ No "testId" fields found in ${name}`);
    return;
  }

  console.log(`🔄 Migrating ${docs.length} documents in "${name}"...`);

  for (const doc of docs) {
    const surveyId = doc.surveyId || doc.testId;

    // Build updated object
    const update = { $set: { surveyId } };

    // Optional cleanup: remove old testId
    if ('testId' in doc) {
      update.$unset = { testId: '' };
    }

    await col.updateOne({ _id: doc._id }, update);
  }

  console.log(`✅ Finished updating "${name}"`);
}

async function runMigration() {
  try {
    console.log('🧠 Connecting to MongoDB...');
    const conn = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = conn.connection.db;

    console.log('🚀 Starting migration...\n');

    // 1️⃣ Update Tests collection
    await migrateCollection(db, collections.tests);

    // 2️⃣ Update Questions collection
    await migrateCollection(db, collections.questions);

    // 3️⃣ Update SurveyResponses collection
    await migrateCollection(db, collections.surveyresponses);

    // 4️⃣ Update Results collection
    await migrateCollection(db, collections.results);

    // 5️⃣ Update test_index collection
    await migrateCollection(db, collections.testindex);

    console.log('\n🎉 Migration completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
