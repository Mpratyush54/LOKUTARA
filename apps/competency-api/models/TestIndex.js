const mongoose = require('mongoose');

const TestIndexSchema = new mongoose.Schema({
  surveyId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  categories: Array,
  totalQuestions: { type: Number, required: true},
  scoringMethod: { type: String, required: true, },
  duration: { type: String, required: true, },
  level: { type: String, required: true, },
  recommended: { type: Boolean, required: true,},

  questions: [
    {
      text: String,
      trait: String,
      reversedScore: Boolean,
      options: [
        { value: Number, label: String }
      ]
    }
  ],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.TestIndex || mongoose.model('TestIndex', TestIndexSchema);
