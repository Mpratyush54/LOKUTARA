import { describe, expect, it } from "vitest";
import { dailySeries } from "./series";
import type { StoredAnalyticsEvent } from "../tracking/events";

describe("dailySeries", () => {
  it("buckets page views and leads by day", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    const events = [
      { name: "page_view", at: new Date("2026-08-28T08:00:00.000Z") },
      { name: "page_view", at: new Date("2026-08-27T08:00:00.000Z") },
      { name: "lead_submitted", at: new Date("2026-08-27T09:00:00.000Z") },
    ] as StoredAnalyticsEvent[];
    const series = dailySeries(events, 3, now);
    expect(series).toHaveLength(3);
    expect(series[2]).toEqual({ date: "2026-08-28", views: 1, leads: 0, signups: 0, revenue: 0 });
    expect(series[1]).toEqual({ date: "2026-08-27", views: 1, leads: 1, signups: 0, revenue: 0 });
  });
});
