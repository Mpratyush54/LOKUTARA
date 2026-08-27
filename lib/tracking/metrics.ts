import type { StoredAnalyticsEvent } from "./events";

export type MetricsWindow = {
  dau: number;
  wau: number;
  mau: number;
  uniqueVisitors: number;
  sessions: number;
  pageViews: number;
  newVisitors: number;
  returningVisitors: number;
  /** Sessions with a single page_view and no further engagement events in-window. */
  bounceRate: number;
  pagesPerSession: number;
  funnel: {
    pageViews: number;
    ctaClicks: number;
    formStarts: number;
    leadsSubmitted: number;
    /** leadsSubmitted / uniqueVisitors in the 30-day window; 0 when no visitors. */
    conversionRate: number;
  };
  sources: Array<{ channel: string; visitors: number }>;
};

function uniqueCount(events: StoredAnalyticsEvent[], since: Date, predicate?: (e: StoredAnalyticsEvent) => boolean): number {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.at < since) continue;
    if (predicate && !predicate(event)) continue;
    ids.add(event.visitorId);
  }
  return ids.size;
}

function countNamed(events: StoredAnalyticsEvent[], name: StoredAnalyticsEvent["name"]): number {
  return events.filter((e) => e.name === name).length;
}

export function computeMetrics(events: StoredAnalyticsEvent[], now = new Date()): MetricsWindow {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const inMonth = events.filter((e) => e.at >= monthAgo);
  const visitorFirst = new Map<string, Date>();
  for (const event of events) {
    const prev = visitorFirst.get(event.visitorId);
    if (!prev || event.at < prev) visitorFirst.set(event.visitorId, event.at);
  }

  const monthVisitorIds = new Set(inMonth.map((e) => e.visitorId));
  let newVisitors = 0;
  let returningVisitors = 0;
  for (const id of monthVisitorIds) {
    const first = visitorFirst.get(id);
    if (first && first >= monthAgo) newVisitors += 1;
    else returningVisitors += 1;
  }

  const channelVisitors = new Map<string, Set<string>>();
  for (const event of inMonth) {
    const channel = event.channel || "direct";
    if (!channelVisitors.has(channel)) channelVisitors.set(channel, new Set());
    channelVisitors.get(channel)!.add(event.visitorId);
  }

  const sources = [...channelVisitors.entries()]
    .map(([channel, visitors]) => ({ channel, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors);

  const pageViews = countNamed(inMonth, "page_view");
  const sessionIds = new Set(inMonth.map((e) => e.sessionId));
  const sessions = sessionIds.size;

  const pageViewsBySession = new Map<string, number>();
  for (const event of inMonth) {
    if (event.name !== "page_view") continue;
    pageViewsBySession.set(event.sessionId, (pageViewsBySession.get(event.sessionId) || 0) + 1);
  }
  let bounced = 0;
  for (const sessionId of sessionIds) {
    if ((pageViewsBySession.get(sessionId) || 0) <= 1) bounced += 1;
  }

  const ctaClicks = countNamed(inMonth, "cta_click");
  const formStarts = countNamed(inMonth, "form_start");
  const leadsSubmitted = countNamed(inMonth, "lead_submitted") + countNamed(inMonth, "popup_submitted");
  const uniqueVisitors = monthVisitorIds.size;

  return {
    dau: uniqueCount(events, dayAgo),
    wau: uniqueCount(events, weekAgo),
    mau: uniqueCount(events, monthAgo),
    uniqueVisitors,
    sessions,
    pageViews,
    newVisitors,
    returningVisitors,
    bounceRate: sessions === 0 ? 0 : bounced / sessions,
    pagesPerSession: sessions === 0 ? 0 : pageViews / sessions,
    funnel: {
      pageViews,
      ctaClicks,
      formStarts,
      leadsSubmitted,
      conversionRate: uniqueVisitors === 0 ? 0 : leadsSubmitted / uniqueVisitors,
    },
    sources,
  };
}
