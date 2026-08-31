import { describe, expect, it } from "vitest";
import { computeCommerce } from "./commerce";
import type { Invoice } from "./invoices";
import type { StoredAnalyticsEvent } from "../tracking/events";

function paidInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv_1",
    number: "LKT-26-0001",
    accountId: null,
    customerName: "Asha",
    customerEmail: "asha@lokutara.test",
    customerPhone: null,
    organisation: null,
    sku: "workshop",
    label: "2–3 hour workshop",
    qty: 1,
    unitAmountPaise: 2_500_000,
    gstRate: 18,
    subtotalPaise: 2_500_000,
    gstPaise: 450_000,
    totalPaise: 2_950_000,
    currency: "INR",
    status: "paid",
    issuedAt: new Date("2026-08-10T00:00:00.000Z"),
    dueAt: new Date("2026-08-20T00:00:00.000Z"),
    paidAt: new Date("2026-08-12T06:00:00.000Z"),
    grantAccessOnPay: false,
    razorpayPaymentLinkId: null,
    paymentUrl: null,
    razorpayPaymentId: null,
    notes: null,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("computeCommerce", () => {
  it("splits this month vs last month in IST and fills a 14-day series", () => {
    const now = new Date("2026-08-20T08:00:00.000Z");
    const snapshot = computeCommerce(
      {
        invoices: [
          paidInvoice({ paidAt: new Date("2026-08-12T06:00:00.000Z"), totalPaise: 2_950_000 }),
          paidInvoice({
            id: "inv_2",
            paidAt: new Date("2026-07-15T06:00:00.000Z"),
            totalPaise: 1_180_000,
            createdAt: new Date("2026-07-14T06:00:00.000Z"),
          }),
          paidInvoice({
            id: "inv_3",
            status: "issued",
            paidAt: null,
            totalPaise: 141_600,
            createdAt: new Date("2026-08-18T06:00:00.000Z"),
          }),
        ],
        accounts: [
          { createdAt: new Date("2026-08-05T06:00:00.000Z") },
          { createdAt: new Date("2026-07-20T06:00:00.000Z") },
        ],
        events: [
          { name: "page_view", visitorId: "v1", at: new Date("2026-08-05T06:00:00.000Z") },
          { name: "page_view", visitorId: "v2", at: new Date("2026-07-20T06:00:00.000Z") },
        ] as StoredAnalyticsEvent[],
        leads: [{ createdAt: new Date("2026-08-08T06:00:00.000Z") }],
      },
      now,
      3,
    );

    expect(snapshot.revenueThisMonth).toBe(2_950_000);
    expect(snapshot.revenueLastMonth).toBe(1_180_000);
    expect(snapshot.momRevenuePct).toBeCloseTo((2_950_000 - 1_180_000) / 1_180_000);
    expect(snapshot.peopleThisMonth).toBe(1);
    expect(snapshot.peopleLastMonth).toBe(1);
    expect(snapshot.visitorsThisMonth).toBe(1);
    expect(snapshot.leadsThisMonth).toBe(1);
    expect(snapshot.outstandingPaise).toBe(141_600);
    expect(snapshot.paidThisMonth).toBe(1);
    expect(snapshot.series).toHaveLength(3);
    expect(snapshot.series.at(-1)?.date).toBe("2026-08-20");
  });
});
