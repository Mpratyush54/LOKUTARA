const mongoose = require('mongoose');

const StepsSchema = new mongoose.Schema({
  action: { type: String },     // compute_raw_scores, sum_traits, etc.
  params: { type: Object }      // extra parameters
}, { _id: false });

const TestsSchema = new mongoose.Schema({
  surveyId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },

  categories: [{ 
    name: { type: String, required: true }
  }],

  totalQuestions: { type: Number, required: true },

  /**
   * scoringMethod:
   * "sum"     → simple sum of values (DEFAULT)
   * "keyed"   → uses per-question scoringKey (RIASEC original)
   * "avg"     → average (MLQ)
   * "weight"  → weighted sum (future SJT)
   * "custom"  → uses optional test.steps (future)
   */
  scoringMethod: { 
    type: String, 
    enum: ["sum", "keyed", "avg", "weight", "custom"],
    default: "sum"
  },

  // Optional scoring steps (future)
  steps: [StepsSchema],

  // Optional test-level formulas/norms
  scoringConfig: {
    type: Object,
    default: {}
  },

  // Category constants (Big Five)
  categoryConstants: {
    type: Map,
    of: Number,
    default: {}
  },

  // Metadata
  duration: { type: String },
  level: { type: String },
  recommended: { type: Boolean },

  time: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.Tests || mongoose.model("Tests", TestsSchema);
