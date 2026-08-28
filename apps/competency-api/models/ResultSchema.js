const mongoose = require('mongoose');

const traitBreakdownSchema = new mongoose.Schema({
  trait: String,
  description: String,
  score: String
});

const ResultSchema = new mongoose.Schema({
  surveyId: { type: String, ref: 'Test', required: true },
  userId: { type: String, ref: 'User', required: true },
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'SurveyResponse', required: true },
  overallSummary: String,
  traitBreakdown: [traitBreakdownSchema],
  generatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Result || mongoose.model('Result', ResultSchema);
