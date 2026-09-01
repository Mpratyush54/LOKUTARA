import { describe, expect, it } from "vitest";
import { invoiceTotals, lineFromSku, nextInvoiceNumber, presentInvoice, type Invoice } from "./invoices";

describe("invoice math", () => {
  it("applies 18% GST on a workshop line", () => {
    const line = lineFromSku("workshop", 1, undefined, 18);
    expect(line.unitAmountPaise).toBe(2_500_000);
    expect(line.subtotalPaise).toBe(2_500_000);
    expect(line.gstPaise).toBe(450_000);
    expect(line.totalPaise).toBe(2_950_000);
  });

  it("scales qty and rounds GST", () => {
    expect(invoiceTotals(120_000, 2, 18)).toEqual({
      subtotalPaise: 240_000,
      gstPaise: 43_200,
      totalPaise: 283_200,
      qty: 2,
      gstRate: 18,
    });
  });

  it("numbers bills as LKT-YY-NNNN in IST year", () => {
    expect(nextInvoiceNumber([], new Date("2026-08-31T18:40:00.000Z"))).toBe("LKT-26-0001");
    expect(nextInvoiceNumber(["LKT-26-0001", "LKT-26-0007"], new Date("2026-03-01T00:00:00.000Z"))).toBe(
      "LKT-26-0008",
    );
  });
});

describe("presentInvoice", () => {
  it("labels complimentary records as Given by Admin at ₹0", () => {
    const invoice: Invoice = {
      id: "inv_1",
      number: "LKT-26-0001",
      accountId: "acc_1",
      customerName: "Asha",
      customerEmail: "asha@lokutara.test",
      customerPhone: null,
      organisation: null,
      sku: "app_access",
      label: "Workspace · Given by Admin",
      qty: 1,
      unitAmountPaise: 0,
      gstRate: 0,
      subtotalPaise: 0,
      gstPaise: 0,
      totalPaise: 0,
      currency: "INR",
      status: "paid",
      issuedAt: new Date("2026-08-31T00:00:00.000Z"),
      dueAt: new Date("2026-08-31T00:00:00.000Z"),
      paidAt: new Date("2026-08-31T00:00:00.000Z"),
      grantAccessOnPay: true,
      kind: "complimentary",
      razorpayPaymentLinkId: null,
      paymentUrl: null,
      razorpayPaymentId: "admin_grant",
      notes: "Given by Admin",
      createdAt: new Date("2026-08-31T00:00:00.000Z"),
    };
    const presented = presentInvoice(invoice);
    expect(presented.totalLabel).toBe("₹0");
    expect(presented.sourceLabel).toBe("Given by Admin");
    expect(presented.documentTitle).toBe("Complimentary record");
    expect(presented.countsTowardRevenue).toBe(false);
  });
});
