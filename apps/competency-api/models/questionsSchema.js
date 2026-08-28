const mongoose = require('mongoose');

const optionsSchema = new mongoose.Schema({
    value: { type: Number, required: true },
    label: { type: String, required: true }
})
const questionsSchema = new mongoose.Schema({

    surveyId: { type: String, required: true },
    questionId: { type: String, required: true },
    text: { type: String, required: true },
    options: [optionsSchema],
    trait: { type: String,   required: true },
    reversedScore: { type: String, required: true }
})
module.exports = mongoose.models.questions || mongoose.model("questions", questionsSchema)