// watchers/testIndexWatcher.js
const mongoose = require("mongoose");
const Test = require("../models/TestsSchema");
const Question = require("../models/questionsSchema");
const indexQueue = require("../queues/indexQueue");

const INDEX_COLLECTION = "test_index";

async function buildSingleTestIndex(surveyId) {
  try {
    // Normalize ObjectId/string
    let idQuery = surveyId;
    if (mongoose.isValidObjectId(surveyId)) {
      idQuery = new mongoose.Types.ObjectId(surveyId);
    }

    // Try both surveyId and _id
    const test =
      (await Test.findOne({ surveyId: idQuery })) ||
      (await Test.findById(idQuery));

    if (!test) {
      console.warn(`⚠️ Test not found for ${surveyId}`);
      return;
    }

    const questions = await Question.find({ surveyId: test.surveyId })
      .sort({ testIndex: 1 })
      .lean();

    const testIndexDoc = {
      surveyId: test.surveyId,
      name: test.name,
      description: test.description,
      categories: test.categories,
      totalQuestions: test.totalQuestions,
      scoringMethod: test.scoringMethod,
      duration: test.duration || "8 min",
      level: test.level || "Intermediate",
      recommended: typeof test.recommended === "boolean" ? test.recommended : true,
      questions,
      updatedAt: new Date()
    };

    await mongoose.connection
      .collection(INDEX_COLLECTION)
      .updateOne(
        { surveyId: test.surveyId },
        { $set: testIndexDoc },
        { upsert: true }
      );

    console.log(`✅ Indexed: ${test.name}`);
  } catch (err) {
    console.error("❌ Index build error:", err.message);
  }
}

async function buildAllTestIndexes() {
  try {
    const tests = await Test.find({});

    for (const t of tests) {
      if (t.surveyId) {
        indexQueue.add("buildIndex", { surveyId: t.surveyId.toString() });
      }
    }

    console.log("🏗 All test indexes queued.");
  } catch (err) {
    console.error("❌ buildAllTestIndexes:", err.message);
  }
}

async function startTestIndexWatcher() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("✅ Mongo Connected (IndexWatcher)");
    }

    await buildAllTestIndexes();

    const testStream = Test.watch();
    const questionStream = Question.watch();

    testStream.on("change", (change) => {
      const surveyId = change.fullDocument?.surveyId;
      if (!surveyId) return;

      indexQueue.add("buildIndex", { surveyId: surveyId.toString() });
    });

    questionStream.on("change", (change) => {
      const surveyId = change.fullDocument?.surveyId;
      if (!surveyId) return;

      indexQueue.add("buildIndex", { surveyId: surveyId.toString() });
    });

    console.log("👀 Watching Test & Questions…");
  } catch (err) {
    console.error("❌ startTestIndexWatcher:", err.message);
  }
}

module.exports = {
  startTestIndexWatcher,
  buildSingleTestIndex,
  buildAllTestIndexes
};
