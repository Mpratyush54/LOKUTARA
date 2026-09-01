import { describe, expect, it } from "vitest";
import { ABOUT_POINTS, AUDIENCE, PEOPLE_FIGURE_MAX, PILOT_STEPS, PRICING, peopleCountForHeadcount, SELL_ITEMS, tierForHeadcount } from "./content";

describe("landing content", () => {
  it("uses approved launch prices", () => {
    expect(PRICING.virtualSession.inr).toBe(15000);
    expect(PRICING.workshop.inr).toBe(25000);
    expect(PRICING.fullDay.inr).toBe(40000);
    expect(PRICING.counselling.inr).toBe(1200);
    expect(PRICING.workspaceYear.inr).toBe(4999);
  });

  it("maps headcount to the 50–500 launch segment", () => {
    expect(tierForHeadcount(120).tier).toBe("Launch segment");
    expect(tierForHeadcount(20).tier).toBe("Early team");
  });

  it("grows the size figures linearly with headcount", () => {
    expect(peopleCountForHeadcount(20)).toBe(3);
    expect(peopleCountForHeadcount(2000)).toBe(PEOPLE_FIGURE_MAX);
    expect(peopleCountForHeadcount(1010)).toBeGreaterThan(peopleCountForHeadcount(500));
  });

  it("lists five buyable launch offers with copy", () => {
    expect(SELL_ITEMS.map((item) => item.id)).toEqual([
      "workspace",
      "counselling",
      "virtual_session",
      "workshop",
      "full_day",
    ]);
    expect(SELL_ITEMS.every((item) => item.detail.length > 40 && item.includes.length > 0)).toBe(true);
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
