import { LOCAL_ASSESSMENTS, type LocalAssessment, type StoredAnswer } from "./workspace";

export type ReportBand = {
  id: string;
  label: string;
  score: number;
  level: "lower" | "typical" | "higher";
  copy: string;
};

export type AssessmentReport = {
  assessmentId: string;
  title: string;
  score: number;
  headline: string;
  summary: string;
  bands: ReportBand[];
  caveat: string;
};

const CAVEAT =
  "A conversation sketch from this sitting — not a licensed psychometric, diagnosis, or hiring score.";

export function asStoredAnswers(raw: Record<string, unknown> | undefined | null): Record<string, StoredAnswer> {
  const out: Record<string, StoredAnswer> = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (row.kind === "mcq" && typeof row.value === "number" && Number.isFinite(row.value)) {
      out[key] = { kind: "mcq", value: row.value };
      continue;
    }
    if (row.kind === "rank" && Array.isArray(row.ranked)) {
      out[key] = {
        kind: "rank",
        ranked: row.ranked.filter(
          (item): item is { optionId: string; label: string; mode: string; rank: number } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { optionId?: unknown }).optionId === "string" &&
            typeof (item as { rank?: unknown }).rank === "number",
        ).map((item) => ({
          optionId: item.optionId,
          label: typeof item.label === "string" ? item.label : item.optionId,
          mode: typeof item.mode === "string" ? item.mode : "",
          rank: item.rank,
        })),
      };
    }
  }
  return out;
}

export function buildAssessmentReport(
  assessment: LocalAssessment,
  answers: Record<string, StoredAnswer>,
  score: number,
): AssessmentReport {
  if (assessment.id === "ocean") return oceanReport(assessment, answers, score);
  if (assessment.id === "kolb") return kolbReport(assessment, answers, score);
  if (assessment.id === "placement") return placementReport(assessment, answers, score);
  return psychologyReport(assessment, answers, score);
}

export function reportForRun(input: {
  assessmentId: string;
  answers: Record<string, unknown>;
  score: number;
}): AssessmentReport | null {
  const assessment = LOCAL_ASSESSMENTS.find((item) => item.id === input.assessmentId);
  if (!assessment) return null;
  return buildAssessmentReport(assessment, asStoredAnswers(input.answers), input.score);
}

function mcqScore(answers: Record<string, StoredAnswer>, id: string): number {
  const answer = answers[id];
  if (!answer || answer.kind !== "mcq") return 0;
  return Math.round((answer.value / 5) * 100);
}

function bandLevel(score: number): ReportBand["level"] {
  if (score >= 70) return "higher";
  if (score >= 40) return "typical";
  return "lower";
}

function band(id: string, label: string, score: number, copies: Record<ReportBand["level"], string>): ReportBand {
  const level = bandLevel(score);
  return { id, label, score, level, copy: copies[level] };
}

function oceanReport(assessment: LocalAssessment, answers: Record<string, StoredAnswer>, score: number): AssessmentReport {
  const bands = [
    band("o1", "Openness", mcqScore(answers, "o1"), {
      lower: "You tend to stay with known ways of working unless the case for change is clear.",
      typical: "You mix familiar methods with new ones when the work asks for it.",
      higher: "You look for new ways of doing familiar work and get energy from novelty.",
    }),
    band("c1", "Conscientiousness", mcqScore(answers, "c1"), {
      lower: "Follow-through may dip when energy drops — useful to name a finish line early.",
      typical: "You usually close what you start, with some give when the week is heavy.",
      higher: "You finish what you start even when the energy drops.",
    }),
    band("e1", "Extraversion", mcqScore(answers, "e1"), {
      lower: "You are slower to speak in a room of people you do not know well.",
      typical: "You speak up when you have a point, and hold back when you do not.",
      higher: "You speak up in rooms of people you do not know well.",
    }),
    band("a1", "Agreeableness", mcqScore(answers, "a1"), {
      lower: "You push your view first and understand the other person after.",
      typical: "You try to understand a colleague and still hold your own view.",
      higher: "You try to understand a colleague before you push your view.",
    }),
    band("n1", "Emotional reactivity", mcqScore(answers, "n1"), {
      lower: "Tight deadlines do not linger with you for long after the moment passes.",
      typical: "Pressure lands, then eases — worth watching on the hardest weeks.",
      higher: "Tight deadlines can leave you unsettled for hours afterwards.",
    }),
  ];
  const top = [...bands].sort((a, b) => b.score - a.score)[0];
  return {
    assessmentId: assessment.id,
    title: assessment.title,
    score,
    headline: top ? `Strongest sketch this sitting: ${top.label.toLowerCase()}.` : "Trait sketch complete.",
    summary:
      "Five-factor snapshot for a development conversation. Compare bands with how you actually show up in the last two weeks, not as a label.",
    bands,
    caveat: CAVEAT,
  };
}

function psychologyReport(assessment: LocalAssessment, answers: Record<string, StoredAnswer>, score: number): AssessmentReport {
  const bands = [
    band("psy1", "In-the-moment awareness", mcqScore(answers, "psy1"), {
      lower: "Feelings may only become nameable after the meeting ends.",
      typical: "You can often name what you feel while the room is still moving.",
      higher: "You can name what you are feeling while a meeting is still running.",
    }),
    band("psy2", "Recovery after feedback", mcqScore(answers, "psy2"), {
      lower: "Sharp feedback can take a long time to metabolise.",
      typical: "You recover after sharp feedback, with a lag on some days.",
      higher: "You recover reasonably after a sharp piece of feedback.",
    }),
    band("psy3", "Attunement", mcqScore(answers, "psy3"), {
      lower: "A quiet teammate may not register until they say so.",
      typical: "You notice some shifts in the room and miss others.",
      higher: "You notice when a teammate has gone quiet before they say so.",
    }),
    band("psy4", "Asking for help", mcqScore(answers, "psy4"), {
      lower: "Help often arrives after the work is already late.",
      typical: "You ask for help on some threads and hold others too long.",
      higher: "You ask for help before the work is already late.",
    }),
    band("psy5", "Conflict residue", mcqScore(answers, "psy5"), {
      lower: "Conflict in the room tends to stay in the room.",
      typical: "Some conflict follows you out; some you can leave.",
      higher: "Conflict in the room stays with you after you leave.",
    }),
    band("psy6", "Boundaries", mcqScore(answers, "psy6"), {
      lower: "It is hard to keep a boundary when someone wants more of your evening.",
      typical: "You keep some evenings and give others away.",
      higher: "You can keep a boundary when someone wants more of your evening.",
    }),
  ];
  return {
    assessmentId: assessment.id,
    title: assessment.title,
    score,
    headline:
      score >= 70
        ? "This sitting reads as relatively resourced."
        : score >= 40
          ? "A mixed sitting — some supports, some strain."
          : "This sitting is pointing at strain worth a slower conversation.",
    summary:
      "Self-report from this sitting. Use it to pick one theme for a follow-up, not as a verdict on how you always are.",
    bands,
    caveat: CAVEAT,
  };
}

const KOLB_MODES: Record<string, { label: string; copy: string }> = {
  CE: {
    label: "Concrete experience",
    copy: "You learn by jumping in and feeling the work as it happens.",
  },
  RO: {
    label: "Reflective observation",
    copy: "You learn by watching how others handle it before you move.",
  },
  AC: {
    label: "Abstract conceptualisation",
    copy: "You learn by thinking it through until you have a model.",
  },
  AE: {
    label: "Active experimentation",
    copy: "You learn by making a plan and testing one concrete change.",
  },
};

function kolbReport(assessment: LocalAssessment, answers: Record<string, StoredAnswer>, score: number): AssessmentReport {
  const counts = new Map<string, number>();
  for (const item of assessment.items) {
    const answer = answers[item.id];
    if (!answer || answer.kind !== "rank") continue;
    const top = answer.ranked.find((row) => row.rank === 1);
    if (!top?.mode) continue;
    counts.set(top.mode, (counts.get(top.mode) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const bands: ReportBand[] = Object.entries(KOLB_MODES).map(([id, meta]) => {
    const n = counts.get(id) ?? 0;
    const scorePct = assessment.items.length ? Math.round((n / assessment.items.length) * 100) : 0;
    return {
      id,
      label: meta.label,
      score: scorePct,
      level: bandLevel(scorePct),
      copy: n
        ? `${meta.copy} Ranked first on ${n} of ${assessment.items.length} situations.`
        : `${meta.copy} Not your first move in this sitting.`,
    };
  });
  const dominant = ranked[0]?.[0];
  const dominantMeta = dominant ? KOLB_MODES[dominant] : null;
  return {
    assessmentId: assessment.id,
    title: assessment.title,
    score,
    headline: dominantMeta ? `This sitting leans ${dominantMeta.label.toLowerCase()}.` : "Learning-style ranking complete.",
    summary:
      "Kolb ranking from this sitting. A conversation aid for how you take in a workshop — not a fixed type.",
    bands,
    caveat: CAVEAT,
  };
}

function placementReport(assessment: LocalAssessment, answers: Record<string, StoredAnswer>, score: number): AssessmentReport {
  const bands = [
    band("p1", "Clear ownership", mcqScore(answers, "p1"), {
      lower: "Open-ended work may fit better than a single named owner.",
      typical: "You can work with a named outcome and still flex.",
      higher: "You prefer work with a clear owner and a named outcome.",
    }),
    band("p2", "Cross-team coordination", mcqScore(answers, "p2"), {
      lower: "Coordinating across teams is not where you are most at ease.",
      typical: "You can coordinate across teams when the brief is decent.",
      higher: "You are comfortable coordinating across two or more teams.",
    }),
    band("p3", "Ambiguity friction", mcqScore(answers, "p3"), {
      lower: "Ambiguous briefs do not slow you more than hard briefs.",
      typical: "Some ambiguity slows you; some you can sit with.",
      higher: "Ambiguous briefs slow you down more than hard briefs.",
    }),
    band("p4", "Coaching vs doing", mcqScore(answers, "p4"), {
      lower: "You would rather do the task yourself than coach someone through it.",
      typical: "You mix doing and coaching depending on the stake.",
      higher: "You would rather coach someone than do the task yourself.",
    }),
  ];
  return {
    assessmentId: assessment.id,
    title: assessment.title,
    score,
    headline: "Role / placement sketch for a staffing conversation.",
    summary:
      "Use this with a manager or coach when rotating work — not as a hiring score or a pass/fail.",
    bands,
    caveat: CAVEAT,
  };
}
