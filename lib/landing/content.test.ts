import { describe, expect, it } from "vitest";
import { AUDIENCE, PILOT_STEPS, PRICING, tierForHeadcount } from "./content";

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

  it("lists four ways in, with company discovery and individual ask", () => {
    expect(AUDIENCE).toHaveLength(4);
    expect(AUDIENCE.map((item) => item.id)).toEqual([
      "hr",
      "startup-team",
      "startup-mental-health",
      "individual",
    ]);
    expect(AUDIENCE.filter((item) => item.form === "discovery")).toHaveLength(3);
    expect(AUDIENCE[3].form).toBe("question");
  });

  it("lists four pilot steps in order", () => {
    expect(PILOT_STEPS.map((step) => step.id)).toEqual(["connect", "build", "measure", "support"]);
    expect(PILOT_STEPS.every((step) => step.copy.length > 0)).toBe(true);
  });
});
