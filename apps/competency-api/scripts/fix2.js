// scripts/fixQuestionSurveyIds.js
const mongoose = require('mongoose');
const Test = require('../models/TestsSchema');
const Question = require('../models/questionsSchema');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const tests = await Test.find({}, { _id: 1, surveyId: 1 }).lean();
    const byId = new Map(tests.map(t => [String(t._id), t.surveyId]));
    const bySurvey = new Set(tests.map(t => t.surveyId).filter(Boolean));

    let fixed = 0;

    // 1) Fix where surveyId is missing but legacy fields exist
    const cursor = Question.find({ $or: [{ surveyId: { $exists: false } }, { surveyId: null }] }).cursor();
    for await (const q of cursor) {
      let newSurveyId = null;

      // If question already has a surveyId but it's falsy, skip to next branch
      // Try legacy link: question.testId (string of Test._id or Test.surveyId)
      if (q.testId && byId.has(String(q.testId))) newSurveyId = byId.get(String(q.testId));
      else if (q.testId && bySurvey.has(q.testId)) newSurveyId = q.testId;

      if (newSurveyId) {
        await Question.updateOne({ _id: q._id }, { $set: { surveyId: newSurveyId } });
        fixed++;
      }
    }

    console.log(`✅ Fixed surveyId on ${fixed} questions`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('❌ Fix failed:', e);
    process.exit(1);
  }
})();
