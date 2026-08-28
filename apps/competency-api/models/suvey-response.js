const mongoose = require('mongoose');
const { generateResultFromSurvey } = require('../utils/resultGenerator');

const answerSchema = new mongoose.Schema({
  questionId: { type: String, ref: 'Question', required: true },

  // SAFEST POSSIBLE without renaming fields
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function (v) {
        // normal MCQ / scale → number
        if (typeof v === 'number') return true;

        // rank → JSON string
        if (typeof v === 'string') {
          try {
            const arr = JSON.parse(v);
            return (
              Array.isArray(arr) &&
              arr.every(
                item =>
                  typeof item.optionId === 'string' &&
                  typeof item.rank === 'number'
              )
            );
          } catch {
            return false;
          }
        }

        return false;
      },
      message:
        'Value must be a number (MCQ) or a valid JSON encoded rank array'
    }
  }
});

const SurveyResponseSchema = new mongoose.Schema({
  username: { type: String, ref: 'User', required: true },
  surveyId: { type: String, ref: 'Test', required: true },
  answers: [answerSchema],
  scores: { type: Map, of: Number },
  completedAt: { type: Date, default: Date.now }
});

// auto generate result
// SurveyResponseSchema.post('save', async function (doc) {
//   try {
//     console.log(`📩 [local] SurveyResponse saved: ${doc.surveyId}`);
//     await generateResultFromSurvey(doc);
//   } catch (err) {
//     console.error('❌ [local] Error auto-generating result:', err.message);
//   }
// });

module.exports =
  mongoose.models.SurveyResponse ||
  mongoose.model('SurveyResponse', SurveyResponseSchema);
