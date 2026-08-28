import type { StoredAnalyticsEvent } from "../tracking/events";

export type DayPoint = { date: string; views: number; leads: number };

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dailySeries(events: StoredAnalyticsEvent[], days = 14, now = new Date()): DayPoint[] {
  const points: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = ymd(day);
    points.push({ date: key, views: 0, leads: 0 });
  }
  const index = new Map(points.map((point, i) => [point.date, i]));
  for (const event of events) {
    const key = ymd(event.at);
    const i = index.get(key);
    if (i === undefined) continue;
    if (event.name === "page_view") points[i].views += 1;
    if (event.name === "lead_submitted" || event.name === "popup_submitted") points[i].leads += 1;
  }
  return points;
}
