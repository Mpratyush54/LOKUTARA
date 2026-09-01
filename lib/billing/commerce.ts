import type { StoredAnalyticsEvent } from "../tracking/events";
import { countsTowardRevenue, isComplimentaryInvoice, type Invoice } from "./invoices";
import {
  inRange,
  istYmd,
  startOfIstDay,
  startOfIstMonth,
  startOfNextIstMonth,
  startOfPreviousIstMonth,
} from "./time";

export type DayPoint = {
  date: string;
  views: number;
  leads: number;
  signups: number;
  revenue: number;
};

export type CommerceSnapshot = {
  revenueToday: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  momRevenuePct: number | null;
  invoicesThisMonth: number;
  paidThisMonth: number;
  outstandingPaise: number;
  peopleThisMonth: number;
  peopleLastMonth: number;
  visitorsThisMonth: number;
  visitorsLastMonth: number;
  leadsThisMonth: number;
  leadsLastMonth: number;
  series: DayPoint[];
};

function uniqueVisitors(events: StoredAnalyticsEvent[], start: Date, end: Date): number {
  const ids = new Set<string>();
  for (const event of events) {
    if (!inRange(event.at, start, end)) continue;
    ids.add(event.visitorId);
  }
  return ids.size;
}

function countCreated<T extends { createdAt: Date }>(rows: T[], start: Date, end: Date): number {
  return rows.filter((row) => inRange(row.createdAt, start, end)).length;
}

function paidRevenue(invoices: Invoice[], start: Date, end: Date): number {
  let sum = 0;
  for (const invoice of invoices) {
    if (!invoice.paidAt || !countsTowardRevenue(invoice)) continue;
    if (!inRange(invoice.paidAt, start, end)) continue;
    sum += invoice.totalPaise;
  }
  return sum;
}

export function computeCommerce(
  input: {
    invoices: Invoice[];
    accounts: Array<{ createdAt: Date }>;
    events: StoredAnalyticsEvent[];
    leads: Array<{ createdAt: Date }>;
  },
  now = new Date(),
  days = 14,
): CommerceSnapshot {
  const todayStart = startOfIstDay(now);
  const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const thisMonth = startOfIstMonth(now);
  const nextMonth = startOfNextIstMonth(now);
  const lastMonth = startOfPreviousIstMonth(now);

  const revenueToday = paidRevenue(input.invoices, todayStart, tomorrow);
  const revenueThisMonth = paidRevenue(input.invoices, thisMonth, nextMonth);
  const revenueLastMonth = paidRevenue(input.invoices, lastMonth, thisMonth);
  const momRevenuePct =
    revenueLastMonth === 0 ? (revenueThisMonth === 0 ? 0 : null) : (revenueThisMonth - revenueLastMonth) / revenueLastMonth;

  const outstandingPaise = input.invoices
    .filter(
      (invoice) =>
        !isComplimentaryInvoice(invoice) && (invoice.status === "issued" || invoice.status === "draft"),
    )
    .reduce((sum, invoice) => sum + invoice.totalPaise, 0);

  const series: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(todayStart.getTime() + 12 * 60 * 60 * 1000 - i * 24 * 60 * 60 * 1000);
    series.push({ date: istYmd(day), views: 0, leads: 0, signups: 0, revenue: 0 });
  }
  const index = new Map(series.map((point, i) => [point.date, i]));

  for (const event of input.events) {
    const i = index.get(istYmd(event.at));
    if (i === undefined) continue;
    if (event.name === "page_view") series[i].views += 1;
    if (event.name === "lead_submitted" || event.name === "popup_submitted") series[i].leads += 1;
  }
  for (const account of input.accounts) {
    const i = index.get(istYmd(account.createdAt));
    if (i === undefined) continue;
    series[i].signups += 1;
  }
  for (const invoice of input.invoices) {
    if (!invoice.paidAt || !countsTowardRevenue(invoice)) continue;
    const i = index.get(istYmd(invoice.paidAt));
    if (i === undefined) continue;
    series[i].revenue += invoice.totalPaise;
  }

  return {
    revenueToday,
    revenueThisMonth,
    revenueLastMonth,
    momRevenuePct,
    invoicesThisMonth: countCreated(input.invoices, thisMonth, nextMonth),
    paidThisMonth: input.invoices.filter(
      (invoice) =>
        countsTowardRevenue(invoice) && invoice.paidAt && inRange(invoice.paidAt, thisMonth, nextMonth),
    ).length,
    outstandingPaise,
    peopleThisMonth: countCreated(input.accounts, thisMonth, nextMonth),
    peopleLastMonth: countCreated(input.accounts, lastMonth, thisMonth),
    visitorsThisMonth: uniqueVisitors(input.events, thisMonth, nextMonth),
    visitorsLastMonth: uniqueVisitors(input.events, lastMonth, thisMonth),
    leadsThisMonth: countCreated(input.leads, thisMonth, nextMonth),
    leadsLastMonth: countCreated(input.leads, lastMonth, thisMonth),
    series,
  };
}
