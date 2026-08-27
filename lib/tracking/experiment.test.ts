import { describe, expect, it } from "vitest";
import { assignVariant, resolveVariant } from "./experiment";
import { computeExperimentStats } from "./experimentStats";
import type { StoredAnalyticsEvent } from "./events";

describe("experiment assignment", () => {
  it("is stable for a visitor", () => {
    const a = assignVariant("v_abcdefghijklmnop", "hero_cta");
    const b = assignVariant("v_abcdefghijklmnop", "hero_cta");
    expect(a).toBe(b);
    expect(a === "control" || a === "variant").toBe(true);
  });

  it("honours forced variant and weighted buckets", () => {
    expect(
      resolveVariant("v_abcdefghijklmnop", "hero_cta", {
        forcedVariant: "variant",
        enabled: true,
        weights: { control: 100, variant: 0 },
      }),
    ).toBe("variant");

    expect(
      resolveVariant("v_abcdefghijklmnop", "hero_cta", {
        enabled: false,
        weights: { control: 0, variant: 100 },
      }),
    ).toBe("control");

    expect(
      resolveVariant("anyone", "hero_cta", {
        enabled: true,
        weights: { control: 0, variant: 100 },
      }),
    ).toBe("variant");
  });
});

describe("experiment stats", () => {
  it("computes assignments and CTR from event props", () => {
    const events: StoredAnalyticsEvent[] = [
      {
        name: "page_view",
        visitorId: "v1",
        sessionId: "s1",
        userId: null,
        path: "/",
        title: "",
        referrer: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        channel: "direct",
        landingPage: "/",
        device: null,
        browser: null,
        os: null,
        country: null,
        city: null,
        props: { experiment: "hero_cta", variant: "control" },
        at: new Date(),
      },
      {
        name: "cta_click",
        visitorId: "v1",
        sessionId: "s1",
        userId: null,
        path: "/",
        title: "",
        referrer: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        channel: "direct",
        landingPage: "/",
        device: null,
        browser: null,
        os: null,
        country: null,
        city: null,
        props: { experiment: "hero_cta", variant: "control" },
        at: new Date(),
      },
    ];
    const stats = computeExperimentStats(events, "hero_cta");
    const control = stats.variants.find((v) => v.variant === "control")!;
    expect(control.assignments).toBe(1);
    expect(control.ctaClicks).toBe(1);
    expect(control.ctr).toBe(1);
  });
});
