import { describe, expect, it } from "vitest";
import { PRICING, tierForHeadcount } from "./content";

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
});
