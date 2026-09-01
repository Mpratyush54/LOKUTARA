import { describe, expect, it } from "vitest";
import { LOCAL_ASSESSMENTS } from "./workspace";
import { buildAssessmentReport } from "./report";
import { buildAssessmentReportPdf } from "./reportPdf";

describe("assessment reports", () => {
  it("names OCEAN traits from the five items", () => {
    const ocean = LOCAL_ASSESSMENTS.find((item) => item.id === "ocean")!;
    const report = buildAssessmentReport(
      ocean,
      {
        o1: { kind: "mcq", value: 5 },
        c1: { kind: "mcq", value: 4 },
        e1: { kind: "mcq", value: 2 },
        a1: { kind: "mcq", value: 3 },
        n1: { kind: "mcq", value: 1 },
      },
      60,
    );
    expect(report.bands.map((band) => band.label)).toEqual([
      "Openness",
      "Conscientiousness",
      "Extraversion",
      "Agreeableness",
      "Emotional reactivity",
    ]);
    expect(report.headline).toMatch(/openness/i);
    expect(report.bands[0].score).toBe(100);
    expect(report.caveat).toMatch(/not a licensed psychometric/i);
  });

  it("writes a PDF with the score, bands, and answers", () => {
    const ocean = LOCAL_ASSESSMENTS.find((item) => item.id === "ocean")!;
    const answers = {
      o1: { kind: "mcq" as const, value: 5 },
      c1: { kind: "mcq" as const, value: 4 },
      e1: { kind: "mcq" as const, value: 2 },
      a1: { kind: "mcq" as const, value: 3 },
      n1: { kind: "mcq" as const, value: 1 },
    };
    const report = buildAssessmentReport(ocean, answers, 60);
    const pdf = buildAssessmentReportPdf({
      report,
      answers,
      runId: "run_validate",
      createdAt: "2026-08-31T00:00:00.000Z",
    });
    const text = Buffer.from(pdf).toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("Overall score: 60");
    expect(text).toContain("Openness: 100");
    expect(text).toContain("I look for new ways");
    expect(text).toContain("Strongly agree");
  });

  it("picks the dominant Kolb mode from rank-1 answers", () => {
    const kolb = LOCAL_ASSESSMENTS.find((item) => item.id === "kolb")!;
    const rank = (mode: string, rest: string[]) => ({
      kind: "rank" as const,
      ranked: [mode, ...rest].map((id, index) => ({
        optionId: id,
        label: id,
        mode: id.toUpperCase(),
        rank: index + 1,
      })),
    });
    const report = buildAssessmentReport(
      kolb,
      {
        k1: rank("ae", ["ce", "ro", "ac"]),
        k2: rank("ae", ["ro", "ce", "ac"]),
        k3: rank("ac", ["ae", "ce", "ro"]),
      },
      80,
    );
    expect(report.headline).toMatch(/active experimentation/i);
    expect(report.bands.find((band) => band.id === "AE")?.score).toBeGreaterThan(
      report.bands.find((band) => band.id === "CE")?.score ?? 0,
    );
  });
});
