import { describe, expect, it } from "vitest";
import { buildAttribution, classifyChannel, mergeAttribution, parseUtm } from "./attribution";

describe("attribution", () => {
  it("parses utm params", () => {
    expect(parseUtm("?utm_source=linkedin&utm_medium=social&utm_campaign=cif")).toEqual({
      utmSource: "linkedin",
      utmMedium: "social",
      utmCampaign: "cif",
      utmContent: null,
    });
  });

  it("classifies channels", () => {
    expect(classifyChannel({})).toBe("direct");
    expect(classifyChannel({ utmMedium: "email" })).toBe("email");
    expect(classifyChannel({ utmMedium: "cpc" })).toBe("paid");
    expect(classifyChannel({ referrer: "https://www.google.com/search" })).toBe("organic");
    expect(classifyChannel({ referrer: "https://www.linkedin.com/feed" })).toBe("social");
    expect(classifyChannel({ referrer: "https://iiic.example/partners" })).toBe("referral");
  });

  it("keeps first touch and updates last touch", () => {
    const first = buildAttribution({ search: "?utm_source=email", landingPage: "/" });
    const later = buildAttribution({ search: "?utm_source=linkedin&utm_medium=social", landingPage: "/" });
    const merged = mergeAttribution(first, later);
    expect(merged.firstTouch.utmSource).toBe("email");
    expect(merged.lastTouch.channel).toBe("social");
  });
});
