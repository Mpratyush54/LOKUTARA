import { describe, expect, it } from "vitest";
import { COMMUNITY_REPLY_RULES, interpretAssessment, LOCAL_ASSESSMENTS, relativeDay, scoreAssessment } from "./workspace";

describe("workspace assessments", () => {
  it("includes psychology, ocean, kolb ranking, and placement in one catalog", () => {
    expect(LOCAL_ASSESSMENTS.map((item) => item.id)).toEqual(["psychology", "ocean", "kolb", "placement"]);
    expect(LOCAL_ASSESSMENTS.find((item) => item.id === "kolb")?.items.every((row) => row.kind === "rank")).toBe(true);
  });

  it("scores mixed MCQ answers", () => {
    const ocean = LOCAL_ASSESSMENTS.find((item) => item.id === "ocean")!;
    const score = scoreAssessment(ocean, {
      o1: { kind: "mcq", value: 5 },
      c1: { kind: "mcq", value: 5 },
      e1: { kind: "mcq", value: 5 },
      a1: { kind: "mcq", value: 5 },
      n1: { kind: "mcq", value: 5 },
    });
    expect(score).toBe(100);
  });

  it("interprets OCEAN as five named traits, not a licensed score", () => {
    const ocean = LOCAL_ASSESSMENTS.find((item) => item.id === "ocean")!;
    const result = interpretAssessment(ocean, {
      o1: { kind: "mcq", value: 5 },
      c1: { kind: "mcq", value: 4 },
      e1: { kind: "mcq", value: 2 },
      a1: { kind: "mcq", value: 3 },
      n1: { kind: "mcq", value: 1 },
    });
    expect(result.traits.map((row) => row.label)).toEqual([
      "Openness",
      "Conscientiousness",
      "Extraversion",
      "Agreeableness",
      "Neuroticism",
    ]);
    expect(result.traits[0].score).toBe(100);
    expect(result.headline).toMatch(/Openness/);
    expect(result.disclaimer).toMatch(/not a licensed psychometric/i);
  });

  it("interprets Kolb ranks into learning-mode totals", () => {
    const kolb = LOCAL_ASSESSMENTS.find((item) => item.id === "kolb")!;
    const ranked = [
      { optionId: "ce", label: "ce", mode: "CE", rank: 1 },
      { optionId: "ro", label: "ro", mode: "RO", rank: 2 },
      { optionId: "ac", label: "ac", mode: "AC", rank: 3 },
      { optionId: "ae", label: "ae", mode: "AE", rank: 4 },
    ];
    const result = interpretAssessment(kolb, {
      k1: { kind: "rank", ranked },
      k2: { kind: "rank", ranked },
      k3: { kind: "rank", ranked },
    });
    const ce = result.traits.find((row) => row.id === "CE");
    const ae = result.traits.find((row) => row.id === "AE");
    expect(ce?.score).toBe(100);
    expect(ae?.score).toBe(25);
    expect(result.headline).toMatch(/Concrete experience/);
  });

  it("formats relative days the way Forum question cards do", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    expect(relativeDay("2026-08-28T08:00:00.000Z", now)).toBe("Today");
    expect(relativeDay("2026-08-27T08:00:00.000Z", now)).toBe("Yesterday");
  });

  it("publishes Forum reply rules for students, specialists, and admins", () => {
    expect(COMMUNITY_REPLY_RULES.map((row) => row.who)).toEqual(["Students", "Specialists", "Admins"]);
    expect(COMMUNITY_REPLY_RULES.find((row) => row.who === "Students")?.canReply).toBe(false);
    expect(COMMUNITY_REPLY_RULES.find((row) => row.who === "Specialists")?.canReply).toBe(true);
    expect(COMMUNITY_REPLY_RULES.find((row) => row.who === "Admins")?.canReply).toBe(true);
  });
});
