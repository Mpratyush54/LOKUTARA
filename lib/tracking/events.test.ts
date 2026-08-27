import { describe, expect, it } from "vitest";
import { normalizeEvent, sanitizeProps } from "./events";
import { computeMetrics } from "./metrics";
import type { StoredAnalyticsEvent } from "./events";

describe("events", () => {
  it("strips counselling fields", () => {
    expect(sanitizeProps({ clinicalNotes: "secret", type: "counselling" })).toEqual({ type: "counselling" });
  });

  it("rejects unknown events", () => {
    expect(normalizeEvent({ name: "hack", visitorId: "v1", sessionId: "s1" })).toEqual({ error: "unknown event: hack" });
  });

  it("normalizes a page view", () => {
    const event = normalizeEvent(
      { name: "page_view", visitorId: "v1", sessionId: "s1", path: "/" },
      new Date("2026-08-26"),
    );
    expect(event).toMatchObject({ name: "page_view", visitorId: "v1", path: "/" });
  });
});

describe("metrics DAU/MAU", () => {
  const t = (iso: string) => new Date(iso);
  const ev = (partial: Partial<StoredAnalyticsEvent> & { visitorId: string; at: Date }): StoredAnalyticsEvent => ({
    name: "page_view",
    sessionId: `s_${partial.visitorId}`,
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
    device: "desktop",
    browser: "Chrome",
    os: "Windows",
    country: null,
    city: null,
    props: {},
    ...partial,
  });

  it("counts unique visitors in day/week/month windows", () => {
    const now = t("2026-08-26T12:00:00.000Z");
    const events = [
      ev({ visitorId: "a", at: t("2026-08-26T10:00:00.000Z"), channel: "email" }),
      ev({ visitorId: "a", at: t("2026-08-26T11:00:00.000Z"), sessionId: "s_a2" }),
      ev({ visitorId: "b", at: t("2026-08-20T12:00:00.000Z"), channel: "social" }),
      ev({ visitorId: "c", at: t("2026-07-01T12:00:00.000Z") }),
    ];
    const metrics = computeMetrics(events, now);
    expect(metrics.dau).toBe(1);
    expect(metrics.wau).toBe(2);
    expect(metrics.mau).toBe(2);
    expect(metrics.pageViews).toBe(3);
    expect(metrics.sessions).toBe(3);
    expect(metrics.pagesPerSession).toBe(1);
    expect(metrics.bounceRate).toBe(1);
    expect(metrics.funnel.pageViews).toBe(3);
    expect(metrics.funnel.leadsSubmitted).toBe(0);
    expect(metrics.sources.find((s) => s.channel === "email")?.visitors).toBe(1);
  });

  it("counts funnel conversions without inventing volume", () => {
    const now = t("2026-08-26T12:00:00.000Z");
    const events = [
      ev({ visitorId: "a", sessionId: "s1", at: t("2026-08-26T10:00:00.000Z") }),
      ev({ visitorId: "a", sessionId: "s1", at: t("2026-08-26T10:01:00.000Z"), name: "cta_click" }),
      ev({ visitorId: "a", sessionId: "s1", at: t("2026-08-26T10:02:00.000Z"), name: "form_start" }),
      ev({ visitorId: "a", sessionId: "s1", at: t("2026-08-26T10:03:00.000Z"), name: "lead_submitted" }),
      ev({ visitorId: "b", sessionId: "s2", at: t("2026-08-26T11:00:00.000Z") }),
      ev({ visitorId: "b", sessionId: "s2", at: t("2026-08-26T11:01:00.000Z") }),
    ];
    const metrics = computeMetrics(events, now);
    expect(metrics.funnel).toEqual({
      pageViews: 3,
      ctaClicks: 1,
      formStarts: 1,
      leadsSubmitted: 1,
      conversionRate: 0.5,
    });
    expect(metrics.bounceRate).toBe(0.5);
    expect(metrics.pagesPerSession).toBe(1.5);
  });
});
