import { describe, expect, it } from "vitest";
import { landingHref, parseLandingQuery, sizeBandForHeadcount, headcountForSizeBand } from "./urlState";

describe("landing URL state", () => {
  it("round-trips guide and offer params", () => {
    const href = landingHref({
      audience: "hr",
      headcount: 120,
      offer: "workshop",
      gstep: "who",
      size: "50-500",
      who: "c",
      paid: true,
    });
    expect(href).toContain("offer=workshop");
    expect(href).toContain("gstep=who");
    expect(href).toContain("paid=1");
    const parsed = parseLandingQuery(new URLSearchParams(href.slice(2)));
    expect(parsed.offer).toBe("workshop");
    expect(parsed.size).toBe("50-500");
    expect(parsed.who).toBe("c");
    expect(parsed.paid).toBe(true);
    expect(parsed.headcount).toBe(120);
  });

  it("maps slider headcount onto the same size bands as the guide", () => {
    expect(sizeBandForHeadcount(40)).toBe("1-49");
    expect(sizeBandForHeadcount(120)).toBe("50-500");
    expect(sizeBandForHeadcount(900)).toBe("501-2000");
    expect(headcountForSizeBand("50-500")).toBe(120);
  });
});
