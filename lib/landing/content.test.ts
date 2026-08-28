import { describe, expect, it } from "vitest";
import { ABOUT_POINTS, AUDIENCE, PILOT_STEPS, PRICING, tierForHeadcount } from "./content";

describe("landing content", () => {
  it("uses approved launch prices", () => {
    expect(PRICING.virtualSession.inr).toBe(15000);
    expect(PRICING.workshop.inr).toBe(25000);
    expect(PRICING.fullDay.inr).toBe(40000);
    expect(PRICING.counselling.inr).toBe(1200);
  });

  it("maps headcount to the 50–500 launch segment", () => {
    expect(tierForHeadcount(120).tier).toBe("Launch segment");
    expect(tierForHeadcount(20).tier).toBe("Early team");
  });

  it("lists four ways in, with counselling as the individual door", () => {
    expect(AUDIENCE.map((item) => item.id)).toEqual([
      "hr",
      "startup-team",
      "startup-mental-health",
      "individual",
    ]);
    expect(AUDIENCE[3].form).toBe("counselling");
  });

  it("lists four pilot steps in order", () => {
    expect(PILOT_STEPS.map((step) => step.id)).toEqual(["connect", "build", "measure", "support"]);
    expect(PILOT_STEPS.every((step) => step.copy.length > 0)).toBe(true);
  });

  it("lists four about points, with trainers copy still open", () => {
    expect(ABOUT_POINTS.map((point) => point.id)).toEqual([
      "psychology-led",
      "your-people",
      "confidential",
      "trainers",
    ]);
    expect(ABOUT_POINTS[3].copy).toBe("");
  });
});
