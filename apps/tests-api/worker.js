// worker.js
require("dotenv").config();
const mongoose = require("mongoose");

// Watchers
const { startSurveyResponseWatcher } = require("./watchers/resultWatcher");
const { startTestIndexWatcher, buildSingleTestIndex } = require("./watchers/IndexWatcher");

// BullMQ queues
const resultQueue = require("./queues/resultQueue");
const indexQueue = require("./queues/indexQueue");

// Models / Utils
const SurveyResponse = require("./models/suvey-response");
const { generateResultFromSurvey } = require("./utils/resultGenerator");

// BullMQ Worker
const { Worker } = require("bullmq");
const { redisConfig } = require("./database/redis");

// -----------------------------------------
// ✔ SINGLE Redis connection used everywhere
// -----------------------------------------
const redisConnection = {
  ...redisConfig,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

console.log("🔗 Redis connected for workers:", {
  host: redisConnection.host,
  port: redisConnection.port,
});


// ===================================================
// 🟩 RESULT WORKER — consumes resultQueue jobs only
// ===================================================
new Worker(
  "resultQueue",
  async (job) => {
    const attemptId = job.data.attemptId;
    console.log(`⚙️ Processing result job: ${attemptId}`);

    const doc = await SurveyResponse.findById(attemptId).lean();
    if (!doc) {
      console.log(`❌ No SurveyResponse found: ${attemptId}`);
      return;
    }

    await generateResultFromSurvey(doc);
    console.log(`✅ Result generated for: ${attemptId}`);
  },
  { connection: redisConnection }
);


// ===================================================
// 🟦 INDEX WORKER — consumes indexQueue jobs only
// ===================================================
new Worker(
  "indexQueue",
  async (job) => {
    const surveyId = job.data.surveyId;
    console.log(`⚙️ Processing index job: ${surveyId}`);

    await buildSingleTestIndex(surveyId);

    console.log(`✅ Indexed: ${surveyId}`);
  },
  { connection: redisConnection }
);


// ===================================================
// 🚀 START WATCHERS
// ===================================================
(async () => {
  try {
    console.log("🚀 Worker starting…");

    await startSurveyResponseWatcher();  // listens → adds jobs → queue only
    await startTestIndexWatcher();       // listens → adds jobs → queue only

    console.log("✅ Worker initialized successfully");
  } catch (err) {
    console.error("❌ Worker startup error:", err);
  }
})();
