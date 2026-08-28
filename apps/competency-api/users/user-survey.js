// declarations
const express = require('express');
const app = express.Router();
const SurveyResponse = require("./../models/suvey-response");
const Joi = require('joi');

// 🔥 Prometheus function timer
const startTimer = require('../utils/timer');

// ===================
// Validation schema
// ===================
const responseSchema = Joi.object({
  surveyId: Joi.string().trim().required(),
  ans: Joi.array()
    .items(
      Joi.object({
        questionId: Joi.string().required(),
        value: Joi.alternatives()
          .try(Joi.number(), Joi.string())
          .required()
      })
    )
    .min(1)
    .required()
});

// =====================
// SAVE SURVEY RESPONSE
// =====================
app.post('/', async (req, res) => {
  const t_total = startTimer("survey_total");

  const t_extract = startTimer("survey_extract");
  const surveyId = req.body.surveyId;
  const ans = req.body.ans;
  const username = req.headers['x-username'];
  t_extract();

  console.log('📩 Incoming response:', { surveyId, ans, username });

  // 1️⃣ Validate header
  const t_header = startTimer("survey_validate_header");
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    t_header();
    t_total();
    return res.status(400).json({
      Status: false,
      Error: true,
      Msg: 'Missing or invalid x-username header (expected userId)'
    });
  }
  t_header();

  // 2️⃣ Validate body
  const t_validate = startTimer("survey_validate_body");
  const { error } = responseSchema.validate({ surveyId, ans }, { abortEarly: false });
  t_validate();

  if (error) {
    t_total();
    return res.status(400).json({
      Status: false,
      Error: true,
      Msg: 'Validation failed',
      Details: error.details.map((d) => ({
        path: d.path.join('.'),
        message: d.message
      }))
    });
  }

  try {
    // 3️⃣ Prepare document
    const t_prepare = startTimer("survey_prepare_doc");
    const newResponse = new SurveyResponse({
      username,               // userId / studentId
      surveyId: surveyId,     // testId
      answers: ans,
      scores: {},             // optional scoring
    });
    t_prepare();

    // 4️⃣ Save to DB
    const t_save = startTimer("survey_db_save");
    await newResponse.save();
    t_save();

    console.log('✅ Saved SurveyResponse:', newResponse._id);

    t_total();

    return res.status(201).json({
      Status: true,
      Error: false,
      Msg: 'The Data has been saved Successfully',
      Id: newResponse._id
    });

  } catch (err) {
    console.error('❌ issue in survey/entry', err);

    t_total();

    return res.status(500).json({
      Status: false,
      Error: true,
      ErrMsg: err.message || String(err)
    });
  }
});

// exporting the module
module.exports = app;
