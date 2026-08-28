import { describe, expect, it } from "vitest";
import { LOCAL_ASSESSMENTS, relativeDay, scoreAssessment } from "./workspace";

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

  it("formats relative days the way Forum question cards do", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    expect(relativeDay("2026-08-28T08:00:00.000Z", now)).toBe("Today");
    expect(relativeDay("2026-08-27T08:00:00.000Z", now)).toBe("Yesterday");
  });
});
