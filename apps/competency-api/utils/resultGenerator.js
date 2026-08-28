// generateResultFromSurvey.js
const Question = require('../models/questionsSchema');
const Result = require('../models/ResultSchema');
const Test = require('../models/TestsSchema');
const SurveyResponse = require('../models/suvey-response');
const mongoose = require('mongoose');
const scoringActions = require('./scoringActions');

function toCamel(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/([-_][a-z])/g, group =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );
}

async function generateResultFromSurvey(surveyResponse) {
  if (!surveyResponse) throw new Error('Missing surveyResponse');

  // normalize answers
  let answers = surveyResponse.answers;
  if (!answers) answers = [];
  else if (!Array.isArray(answers) && typeof answers === 'object') {
    answers = Object.values(answers);
  }

  const { surveyId, username, _id: attemptId } = surveyResponse;
  if (!surveyId || !username) throw new Error('Missing surveyId or username');

  // Load test + questions
  const test = await Test.findOne({ surveyId }).lean();
  if (!test) throw new Error(`No test found for surveyId: ${surveyId}`);

  const questions = await Question.find({ surveyId }).lean();
  if (!questions.length) throw new Error(`No questions found for surveyId: ${surveyId}`);

  // Convert constants
  let constants = {};
  if (test.categoryConstants instanceof Map) constants = Object.fromEntries(test.categoryConstants);
  else if (typeof test.categoryConstants?.toObject === 'function')
    constants = test.categoryConstants.toObject();
  else if (typeof test.categoryConstants === 'object' && test.categoryConstants !== null)
    constants = { ...test.categoryConstants };

  // default scoring pipeline
  const defaultSteps = [
    { action: "compute_raw_scores" },
    { action: (String(test.scoringMethod || '').toLowerCase() === 'sum') ? "sum_traits" : "avg_traits" },
    { action: "add_constants", constants }
  ];

  const steps =
    Array.isArray(test.steps) && test.steps.length ? test.steps : defaultSteps;

  let ctx = {};

  // execute scoring pipeline
  for (const step of steps) {
    const actionName = step.action;
    const fn =
      scoringActions[actionName] ||
      scoringActions[toCamel(actionName)] ||
      scoringActions[actionName?.toLowerCase()];

    if (typeof fn !== 'function') throw new Error(`Unknown scoring action: ${actionName}`);

    ctx = await fn(ctx, step, test, answers, questions) || ctx;
  }

  // ---- Collect final scores ----
  let finalScores = {};
  const containers = [
    "final",
    "summed",
    "averaged",
    "formulaResults",
    "percentile",
    "z",
    "total"
  ];

  for (const key of containers) {
    if (ctx[key] !== undefined) {
      if (typeof ctx[key] === "object" && !Array.isArray(ctx[key])) {
        finalScores = { ...finalScores, ...ctx[key] };
      } else {
        finalScores[key] = ctx[key];
      }
    }
  }

  // FILTER technical / object values
  const filteredFinalScores = {};
  for (const [trait, value] of Object.entries(finalScores)) {
    if (["modes", "quadrants", "dominant"].includes(trait)) continue;
    if (typeof value === "object" && value !== null) continue;
    filteredFinalScores[trait] = value;
  }

  const traitBreakdown = Object.entries(filteredFinalScores).map(([trait, finalScore]) => {
    const raw = ctx.rawScores?.[trait] ?? null;
    const constant = constants?.[trait] ?? 0;

    let description = `Final score for ${trait}: ${finalScore}`;
    let parts = [];
    if (raw !== null) parts.push(`raw ${raw}`);
    if (constant !== 0) parts.push(`constant ${constant}`);
    if (parts.length) description += ` (${parts.join(" + ")} = ${finalScore})`;

    return {
      trait,
      score: String(finalScore),
      description
    };
  });

  const summary = Object.entries(finalScores).map(([t, s]) => `${t}: ${s}`).join(', ');

  // ---------------------------
  // ⭐ UPSERT-ONLY (PREVENT DUPLICATES REGARDLESS OF CLUSTER SIZE)
  // ---------------------------

  const resultUpsert = await Result.findOneAndUpdate(
    { attemptId },
    {
      $setOnInsert: {
        surveyId,
        userId: username,
        attemptId,
        overallSummary: summary,
        traitBreakdown,
        finalScores,
        advanced: ctx
      }
    },
    { new: false, upsert: true } // new:false gives old doc if existed
  );

  // If result already existed (race condition), return existing doc
  if (resultUpsert) {
    console.log(`♻️ Result already existed for attempt ${attemptId}`);
    return resultUpsert;
  }

  // If new result was created: resultUpsert is null → fetch inserted doc
  const createdResult = await Result.findOne({ attemptId });

  // update SurveyResponse with scores
  await SurveyResponse.updateOne(
    { _id: new mongoose.Types.ObjectId(attemptId) },
    { $set: { scores: finalScores, advanced: ctx } }
  );

  console.log(`✅ Result generated for ${username} (${surveyId})`);
  return createdResult;
}

module.exports = { generateResultFromSurvey };
