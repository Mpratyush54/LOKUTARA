import { describe, expect, it } from "vitest";
import {
  encodeGuideLead,
  recommendGuide,
  recommendHeadline,
  type GuideAnswers,
} from "./guide";

function answers(partial: Partial<GuideAnswers>): GuideAnswers {
  return {
    sizeBand: "50-500",
    who: "c",
    noticing: "b",
    affected: "b",
    success: "b",
    ...partial,
  };
}

describe("recommendGuide", () => {
  it("routes individuals straight to the psychologist Q&A", () => {
    expect(recommendGuide(answers({ who: "e" }))).toEqual(["psychologists"]);
    expect(recommendHeadline(["psychologists"])).toMatch(/psychologists/i);
  });

  it("maps managers (Q1 B) onto leadership development", () => {
    expect(recommendGuide(answers({ who: "b", noticing: "b", affected: "b", success: "b" }))).toEqual([
      "psychometrics",
      "training",
      "leadership",
    ]);
  });

  it("adds leadership for Q1 A only when Q2 or Q3 is leadership-related", () => {
    const without = recommendGuide(answers({ who: "a", noticing: "b", affected: "b", success: "b" }));
    expect(without).toEqual(["psychometrics", "training"]);
    const withLead = recommendGuide(answers({ who: "a", noticing: "c", affected: "a", success: "c" }));
    expect(withLead).toContain("leadership");
  });

  it("uses Q2 as the problem signal", () => {
    expect(recommendGuide(answers({ noticing: "a", affected: "a", success: "a" }))).toEqual([
      "psychometrics",
      "counselling",
    ]);
    expect(recommendGuide(answers({ noticing: "d", affected: "a", success: "d" }))).toEqual(["counselling"]);
  });

  it("widens the mix when the whole organisation is affected", () => {
    expect(recommendGuide(answers({ noticing: "e", affected: "e", success: "e" }))).toEqual([
      "psychometrics",
      "training",
      "leadership",
      "counselling",
      "discovery",
    ]);
  });

  it("writes compact codes for the lead record", () => {
    const individual = answers({ who: "e", noticing: null, affected: null, success: null });
    expect(encodeGuideLead(individual, recommendGuide(individual))).toEqual({
      role: "who=e;notice=;affected=;success=",
      preferredTime: "psychologists",
    });
  });
});
