import { describe, expect, it } from "vitest";
import { invoicesToGstCsv } from "./gstCsv";
import type { Invoice } from "./invoices";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    number: "LKT-26-0001",
    accountId: null,
    customerName: "Asha",
    customerEmail: "asha@lokutara.test",
    customerPhone: null,
    organisation: null,
    customerGstin: null,
    supplyState: null,
    lines: [
      {
        sku: "workshop",
        label: "2-3 hour workshop",
        qty: 1,
        unitAmountPaise: 2_500_000,
        gstRate: 18,
        subtotalPaise: 2_500_000,
        gstPaise: 450_000,
        totalPaise: 2_950_000,
      },
    ],
    discountPaise: 0,
    promoCode: null,
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
    kind: "sale",
    razorpayPaymentLinkId: null,
    paymentUrl: null,
    razorpayPaymentId: null,
    notes: null,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("gst csv", () => {
  it("exports a GST register with CGST/SGST split", () => {
    const csv = invoicesToGstCsv([invoice()]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("CGST");
    expect(lines[0]).toContain("SGST");
    expect(lines[1]).toContain("LKT-26-0001");
    expect(lines[1]).toContain("25000.00");
    expect(lines[1]).toContain("2250.00");
  });
});
