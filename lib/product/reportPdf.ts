import { buildLabPdf } from "./pdf";
import { asStoredAnswers, type AssessmentReport } from "./report";
import { LOCAL_ASSESSMENTS, type LocalAssessment, type StoredAnswer } from "./workspace";

const REFERENCE = "Lower 0-39 | Typical 40-69 | Higher 70-100";

export function buildAssessmentReportPdf(input: {
  report: AssessmentReport;
  answers: Record<string, unknown>;
  runId: string;
  createdAt: Date | string;
}): Uint8Array {
  const assessment = LOCAL_ASSESSMENTS.find((item) => item.id === input.report.assessmentId);
  const taken = new Date(typeof input.createdAt === "string" ? input.createdAt : input.createdAt.toISOString());
  const scoreBadge =
    input.report.score >= 70 ? "HIGH PROFILE" : input.report.score >= 40 ? "BALANCED" : "EXPLORATORY";

  return buildLabPdf({
    letterhead: ["Lokutara Applied Psychology", "Psychology-led capacity building - Bengaluru, Karnataka"],
    title: `Assessment Report - ${input.report.title}`,
    band: {
      title: "LOKUTARA",
      sub: `APPLIED COGNITIVE & BEHAVIORAL REPORT - ${input.report.title.toUpperCase()}`,
      badge: "VERIFIED SITTING",
    },
    meta: [
      `Assessment: ${input.report.title}`,
      `Overall score: ${input.report.score} of 100`,
      `Report Reference: ${input.runId}`,
      `Sitting Timestamp: ${taken.toLocaleString("en-IN")}`,
    ],
    sections: [
      {
        heading: "Overall Score & Performance Index",
        subheading: "Normalized against 100-point developmental scale",
        scorecard: {
          score: input.report.score,
          max: 100,
          title: input.report.headline,
          subtitle: "Synthesized developmental indicator derived from verified response patterns.",
          badge: scoreBadge,
        },
      },
      {
        heading: "Diagnostic Synthesis",
        subheading: "Behavioral orientation and workplace tendencies",
        card: {
          title: "Executive Interpretation",
          lines: [input.report.summary],
          bg: "sand",
          accent: true,
        },
      },
      {
        heading: "Trait Dimension Breakdown",
        subheading: REFERENCE,
        meters: input.report.bands.map((band) => ({
          label: band.label,
          score: band.score,
          max: 100,
          level: band.level,
          copy: band.copy,
        })),
      },
      {
        heading: "Itemized Response Audit",
        subheading: assessment ? `${assessment.items.length} responses captured` : undefined,
        lines: assessment
          ? describeResponses(assessment, asStoredAnswers(input.answers))
          : ["Answers were not stored for this sitting."],
      },
      {
        heading: "Governance & Psychometric Scope",
        card: {
          title: "Notice & Intended Use Boundaries",
          lines: [
            input.report.caveat,
            "Lokutara developmental reports are reflective instruments designed to support coaching dialogues, self-discovery, and personal leadership inquiry. They do not constitute formal clinical diagnoses, statutory competency certifications, or definitive selection determinations.",
          ],
          bg: "gray",
        },
      },
    ],
    footer: ["Lokutara - conversation sketch, not a licensed psychometric or diagnosis."],
  });
}

export function describeResponses(assessment: LocalAssessment, answers: Record<string, StoredAnswer>): string[] {
  return assessment.items.map((item, index) => {
    const answer = answers[item.id];
    const n = `${index + 1}. ${item.prompt}`;
    if (!answer) return `${n}\nNo answer recorded.`;
    if (item.kind === "mcq" && answer.kind === "mcq") {
      const option = item.options.find((row) => row.value === answer.value);
      const label = option?.label ?? String(answer.value);
      return `${n}\nAnswer: ${label} (${answer.value} of 5)`;
    }
    if (item.kind === "rank" && answer.kind === "rank") {
      const ranked = [...answer.ranked]
        .sort((a, b) => a.rank - b.rank)
        .map((row) => `${row.rank}. ${row.label}${row.mode ? ` [${row.mode}]` : ""}`)
        .join("\n");
      return `${n}\n${ranked}`;
    }
    return `${n}\nAnswer stored.`;
  });
}
