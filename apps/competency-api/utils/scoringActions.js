// scoring/scoringActions.js
// Reusable scoring action functions for pipeline engine

// helper: safe number
function toNum(v, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// helper: escapeRegExp
function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --------------------- Basic Helpers ---------------------
function applyReverse(value, max = 5, min = 1) {
  const v = toNum(value, null);
  if (v === null) return null;
  return (max + min) - v;
}

// --------------------- 0. compute_raw_scores ---------------------
// ctx, step, test, answers (array), questions (array)
function compute_raw_scores(ctx = {}, step = {}, test = {}, answers = [], questions = []) {
  ctx.raw = ctx.raw || {};

  // initialize trait arrays from test.categories
  if (Array.isArray(test.categories)) {
    for (const c of test.categories) {
      const name = (c && c.name) ? c.name : String(c);
      if (!(name in ctx.raw)) ctx.raw[name] = [];
    }
  }

  // answers may be object or array — caller should coerce, but safe-guard
  if (!Array.isArray(answers) && answers && typeof answers === 'object') {
    answers = Object.values(answers);
  } else if (!answers) answers = [];

  // map questions by id for speed
  const qmap = {};
  for (const q of (questions || [])) {
    const id = String(q.questionId ?? q._id ?? q._id?.toString?.());
    qmap[id] = q;
  }

  for (const ans of answers) {
    if (!ans) continue;
    const qid = String(ans.questionId ?? ans.qid ?? ans._id ?? '');
    const q = qmap[qid];
    if (!q || !q.trait) continue;

    const trait = q.trait;
    const rawVal = toNum(ans.value, null);
    if (rawVal === null) continue;

    ctx.raw[trait] = ctx.raw[trait] || [];
    // store raw value (no reversal nor keying here)
    ctx.raw[trait].push(rawVal);
  }

  return ctx;
}

// --------------------- apply_scoring_key ---------------------
// This applies per-question scoring keys (preferred for RIASEC original)
function apply_scoring_key(ctx = {}, step = {}, test = {}, answers = [], questions = []) {
  ctx.rawAfterKey = ctx.rawAfterKey || {};
  // create quick answer map
  const amap = {};
  for (const a of (Array.isArray(answers) ? answers : [])) {
    const id = String(a.questionId ?? a.qid ?? a._id ?? '');
    amap[id] = a;
  }

  for (const q of (questions || [])) {
    const qid = String(q.questionId ?? q._id ?? '');
    const ans = amap[qid];
    if (!ans) continue;
    const trait = q.trait;
    const rawVal = toNum(ans.value, null);
    if (rawVal === null) continue;

    // q.scoringKey should be object mapping rawValue -> score (usually 0/1)
    if (q.scoringKey && typeof q.scoringKey === 'object') {
      const score = toNum(q.scoringKey[String(rawVal)] ?? q.scoringKey[rawVal], 0);
      ctx.rawAfterKey[trait] = ctx.rawAfterKey[trait] || [];
      ctx.rawAfterKey[trait].push(score);
    } else {
      // no scoringKey: default treat as raw (or 0 if you prefer)
      ctx.rawAfterKey[trait] = ctx.rawAfterKey[trait] || [];
      ctx.rawAfterKey[trait].push(rawVal);
    }
  }
  return ctx;
}

// --------------------- binary_score ---------------------
// Converts answers to 0/1 using threshold (commonly used if test uses binary)
function binary_score(ctx = {}, step = {}, test = {}, answers = [], questions = []) {
  const threshold = step.threshold ?? 3;
  // mutate answers values (local copy)
  for (const a of (Array.isArray(answers) ? answers : [])) {
    const v = toNum(a.value, null);
    a._binary = (v !== null && v >= threshold) ? 1 : 0;
  }
  // store binary in ctx (so later compute_raw_scores can use it if desired)
  ctx.binaryAnswers = answers.map(a => ({ questionId: a.questionId, value: a._binary }));
  return ctx;
}

// --------------------- apply_reverse_scoring ---------------------
// Performs reversal for item-level reversal if q.reversedScore exists.
// If ctx.raw contains arrays of raw values (value numbers), this function can
// produce ctx.rawAfterReverse mapping.
function apply_reverse_scoring(ctx = {}, step = {}, test = {}, answers = [], questions = []) {
  // Two modes:
  // - If ctx.raw exists (from compute_raw_scores) and contains raw values,
  //   we reverse each item value by trait using question-level reverse flags.
  // - If answers present and questions include reversed flag, we can construct rawAfterReverse directly.
  ctx.rawAfterReverse = ctx.rawAfterReverse || {};

  // Build question map
  const qmap = {};
  for (const q of (questions || [])) {
    const id = String(q.questionId ?? q._id ?? '');
    qmap[id] = q;
  }

  // If ctx.raw was produced from compute_raw_scores, we need to reverse item-by-item.
  // But we need item-level values with question ids; compute_raw_scores does not keep qid -> value mapping.
  // So this function will prefer to build arrays by iterating answers and question metadata.
  for (const a of (Array.isArray(answers) ? answers : [])) {
    const qid = String(a.questionId ?? a.qid ?? a._id ?? '');
    const q = qmap[qid];
    if (!q || !q.trait) continue;
    const trait = q.trait;
    let v = toNum(a.value, null);
    if (v === null) continue;

    if (q.reversedScore === true || q.reversedScore === 'true') {
      const max = (step.scaleMax ?? q.scaleMax ?? 5);
      const min = (step.scaleMin ?? q.scaleMin ?? 1);
      v = applyReverse(v, max, min);
    }

    ctx.rawAfterReverse[trait] = ctx.rawAfterReverse[trait] || [];
    ctx.rawAfterReverse[trait].push(v);
  }

  return ctx;
}

// --------------------- sumTraits ---------------------
function sumTraits(ctx = {}, step = {}) {
  ctx.summed = ctx.summed || {};
  const source = ctx.rawAfterKey || ctx.rawAfterReverse || ctx.raw || {};
  for (const trait of Object.keys(source)) {
    const arr = source[trait] || [];
    ctx.summed[trait] = arr.reduce((a, b) => a + toNum(b, 0), 0);
  }
  return ctx;
}

// --------------------- avgTraits ---------------------
function avgTraits(ctx = {}, step = {}) {
  ctx.averaged = ctx.averaged || {};
  const source = ctx.rawAfterKey || ctx.rawAfterReverse || ctx.raw || {};
  for (const trait of Object.keys(source)) {
    const arr = source[trait] || [];
    const sum = arr.reduce((a, b) => a + toNum(b, 0), 0);
    ctx.averaged[trait] = arr.length ? (sum / arr.length) : 0;
  }
  return ctx;
}

// --------------------- addConstants ---------------------
function addConstants(ctx = {}, step = {}) {
  const constants = step.constants || step.constantsMap || {};
  const base = ctx.summed || ctx.averaged || ctx.raw || {};
  ctx.final = ctx.final || {};
  for (const trait of Object.keys(base)) {
    const baseVal = toNum(base[trait], 0);
    const c = toNum(constants[trait], 0);
    ctx.final[trait] = baseVal + c;
  }
  return ctx;
}

// --------------------- zScore ---------------------
function zScore(ctx = {}, step = {}) {
  ctx.z = ctx.z || {};
  const base = ctx.final || ctx.summed || ctx.averaged || {};
  const norms = step.norms || {};
  const defaultMean = step.mean;
  const defaultSd = step.sd;
  for (const trait of Object.keys(base)) {
    const raw = toNum(base[trait], NaN);
    const mean = (norms[trait] && typeof norms[trait].mean === 'number') ? norms[trait].mean : defaultMean;
    const sd = (norms[trait] && typeof norms[trait].sd === 'number') ? norms[trait].sd : defaultSd;
    if (typeof mean !== 'number' || typeof sd !== 'number' || sd === 0 || Number.isNaN(raw)) {
      ctx.z[trait] = null;
      continue;
    }
    ctx.z[trait] = (raw - mean) / sd;
  }
  return ctx;
}

// --------------------- percentileFromZ ---------------------
function percentileFromZ(ctx = {}) {
  ctx.percentile = ctx.percentile || {};
  for (const trait of Object.keys(ctx.z || {})) {
    const z = ctx.z[trait];
    if (z === null || typeof z !== 'number' || Number.isNaN(z)) {
      ctx.percentile[trait] = null;
      continue;
    }
    const p = (1 + erf(z / Math.sqrt(2))) / 2;
    ctx.percentile[trait] = Math.round(p * 100 * 100) / 100; // 2 decimals
  }
  return ctx;
}

// --------------------- applyFormula ---------------------
// Very small evaluator: replaces trait names with values and evaluates expression.
// For production, swap to expr-eval or mathjs for safety & more features.
function applyFormula(ctx = {}, step = {}) {
  const formulas = step.formulas || {};
  ctx.formulaResults = ctx.formulaResults || {};
  const scope = Object.assign({}, ctx.final || ctx.summed || ctx.averaged || {});
  for (const key of Object.keys(formulas)) {
    const expr = String(formulas[key] || '');
    try {
      let replaced = expr;
      for (const k of Object.keys(scope)) {
        const re = new RegExp(`\\b${escapeRegExp(k)}\\b`, 'g');
        replaced = replaced.replace(re, String(scope[k]));
      }
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${replaced});`)();
      ctx.formulaResults[key] = Number.isFinite(val) ? val : null;
    } catch (e) {
      ctx.formulaResults[key] = null;
    }
  }
  return ctx;
}

// --------------------- small math helpers ---------------------
function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1.0 / (1.0 + p * x);
  const y = 1 - ((((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}
// --------------------- kolb_score ---------------------
// Kolb Learning Style Inventory 4.0 scoring
// Expects answers[i].ranks = { CE:4, RO:3, AC:2, AE:1 }
function kolb_score(ctx = {}, step = {}, test = {}, answers = [], questions = []) {
  const modes = { CE: 0, RO: 0, AC: 0, AE: 0 };

  // Parse rank answers
  for (const ans of (Array.isArray(answers) ? answers : [])) {
    if (typeof ans.value === "string") {
      try {
        const arr = JSON.parse(ans.value);
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (["CE", "RO", "AC", "AE"].includes(item.optionId)) {
              modes[item.optionId] += Number(item.rank || 0);
            }
          }
        }
      } catch {}
    }
  }

  // Quadrants (no prefix)
  const quadrants = {
    Assimilative: modes.AC + modes.RO,
    Convergent:  modes.AC + modes.AE,
    Accommodative: modes.CE + modes.AE,
    Divergent: modes.CE + modes.RO
  };

  // Dominant quadrant name
  let dominant = Object.keys(quadrants)[0];
  for (const q of Object.keys(quadrants)) {
    if (quadrants[q] > quadrants[dominant]) dominant = q;
  }

  // Store detailed Kolb breakdown
  ctx.kolb = { modes, quadrants, dominant };

  // Add numeric scores normally (no prefixes)
  ctx.final = ctx.final || {};

  ctx.final.CE = modes.CE;
  ctx.final.RO = modes.RO;
  ctx.final.AC = modes.AC;
  ctx.final.AE = modes.AE;

  ctx.final.Assimilative = quadrants.Assimilative;
  ctx.final.Convergent = quadrants.Convergent;
  ctx.final.Accommodative = quadrants.Accommodative;
  ctx.final.Divergent = quadrants.Divergent;

  ctx.final.dominant = dominant;
  ctx.final.dominantIndex = Object.keys(quadrants).indexOf(dominant);

  return ctx;
}

function sumAllTraits(ctx = {}, step = {}) {
  const source = ctx.rawAfterKey || ctx.rawAfterReverse || ctx.raw || {};
  let total = 0;

  for (const trait of Object.keys(source)) {
    const arr = source[trait] || [];
    total += arr.reduce((a, b) => a + Number(b), 0);
  }

  ctx.total = total;   // store total in ctx
  return ctx;
}

// --------------------- EI Custom Score ---------------------
// Computes:
// - trait_avgs: average of each trait
// - total: sum of all raw items
function ei_score(ctx = {}, step = {}, test = {}, answers = [], questions = []) {
  const source = ctx.raw || {};

  ctx.final = {};   // VERY IMPORTANT → matches other tests
  let total = 0;

  for (const trait of Object.keys(source)) {
    const arr = source[trait] || [];
    const sum = arr.reduce((a, b) => a + toNum(b, 0), 0);
    const avg = arr.length ? sum / arr.length : 0;

    ctx.final[trait] = avg;   // same shape as other scoring methods
    total += sum;
  }

  // add total score as another trait
  ctx.final.totalEI = total;

  return ctx;
}



// --------------------- Exports + Aliases ---------------------
module.exports = {
  // canonical names
  compute_raw_scores,
  apply_scoring_key,
  binary_score,
  apply_reverse_scoring,
  sumTraits,
  avgTraits,
  addConstants,
  zScore,
  percentileFromZ,
  applyFormula,
  applyReverse,

  // helpful camelCase aliases
  computeRawScores: compute_raw_scores,
  applyScoringKey: apply_scoring_key,
  binaryScore: binary_score,
  applyReverseScoring: apply_reverse_scoring,
  sum_traits: sumTraits,
  avg_traits: avgTraits,
  add_constants: addConstants,
  z_score: zScore,
  percentile_from_z: percentileFromZ,
  apply_formula: applyFormula,
  kolb_score,
  kolb_score:kolb_score,
  ei_score,
  eiScore: ei_score,
  sumAllTraits,
sum_all_traits: sumAllTraits,


};
