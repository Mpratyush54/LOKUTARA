import { buildSimplePdf } from "./pdf";
import { asStoredAnswers, type AssessmentReport } from "./report";
import { LOCAL_ASSESSMENTS, type LocalAssessment, type StoredAnswer } from "./workspace";

export function buildAssessmentReportPdf(input: {
  report: AssessmentReport;
  answers: Record<string, unknown>;
  runId: string;
  createdAt: Date | string;
}): Uint8Array {
  const assessment = LOCAL_ASSESSMENTS.find((item) => item.id === input.report.assessmentId);
  const taken = typeof input.createdAt === "string" ? input.createdAt : input.createdAt.toISOString();
  const blocks: string[] = [
    `Overall score: ${input.report.score}`,
    `Taken: ${new Date(taken).toLocaleString("en-IN")}`,
    `Run: ${input.runId}`,
    input.report.headline,
    input.report.summary,
    "# Trait bands",
    ...input.report.bands.map(
      (band) => `${band.label}: ${band.score} (${band.level})\n${band.copy}`,
    ),
    "# Your answers",
    ...(assessment ? describeResponses(assessment, asStoredAnswers(input.answers)) : ["Answers were not stored for this sitting."]),
    input.report.caveat,
  ];
  return buildSimplePdf(`Lokutara · ${input.report.title}`, blocks);
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
