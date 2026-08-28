// watchers/resultWatcher.js
const mongoose = require("mongoose");
const Result = require("../models/ResultSchema");
const SurveyResponse = require("../models/suvey-response");
const resultQueue = require("../queues/resultQueue");

async function processPendingSurveyResponses() {
  try {
    const collection = mongoose.connection.collection("surveyresponses");
    const all = await collection.find({}).toArray();

    console.log(`📦 Total SurveyResponses: ${all.length}`);

    let count = 0;

    for (const doc of all) {
      const exists = await Result.findOne({ attemptId: doc._id });
      if (!exists) {
        await resultQueue.add("generateResult", {
          attemptId: doc._id.toString(),
        });
        count++;
      }
    }

    console.log(`🔥 Queued ${count} pending jobs`);
  } catch (err) {
    console.error("❌ processPendingSurveyResponses:", err.message);
  }
}

async function startSurveyResponseWatcher() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("✅ Mongo Connected (ResultWatcher)");
    }

    await processPendingSurveyResponses();

    const collection = mongoose.connection.collection("surveyresponses");

    const changeStream = collection.watch([
      { $match: { operationType: "insert" } },
    ]);

    console.log("👀 Watching SurveyResponse inserts…");

    changeStream.on("change", (change) => {
      const doc = change.fullDocument;
      resultQueue.add("generateResult", {
        attemptId: doc._id.toString(),
      });
      console.log(`📥 New job queued: ${doc._id}`);
    });

    changeStream.on("error", (err) => {
      console.error("⚠️ ChangeStream error:", err.message);
      setTimeout(startSurveyResponseWatcher, 3000);
    });

  } catch (err) {
    console.error("❌ startSurveyResponseWatcher:", err.message);
  }
}

module.exports = {
  startSurveyResponseWatcher,
};
