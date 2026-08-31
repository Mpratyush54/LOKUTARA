import type { StoredAnalyticsEvent } from "../tracking/events";
import { computeCommerce, type DayPoint } from "../billing/commerce";

export type { DayPoint };

export function dailySeries(events: StoredAnalyticsEvent[], days = 14, now = new Date()): DayPoint[] {
  return computeCommerce({ invoices: [], accounts: [], events, leads: [] }, now, days).series;
}
