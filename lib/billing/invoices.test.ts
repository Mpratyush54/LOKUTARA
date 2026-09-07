import { describe, expect, it } from "vitest";
import {
  invoiceTotals,
  lineFromSku,
  nextInvoiceNumber,
  normalizeGstin,
  presentInvoice,
  settleInvoiceLines,
  type Invoice,
} from "./invoices";
import { buildInvoicePdf, inrAmountWords } from "./invoicePdf";

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

  it("settles multiple lines with a shared pre-GST discount", () => {
    const settled = settleInvoiceLines(
      [lineFromSku("workshop", 1, undefined, 18), lineFromSku("counselling", 1, undefined, 18)],
      100_000,
    );
    expect(settled.discountPaise).toBe(100_000);
    expect(settled.subtotalPaise + settled.discountPaise).toBe(
      settled.lines.reduce((sum, line) => sum + line.subtotalPaise, 0) + settled.discountPaise,
    );
    expect(settled.totalPaise).toBe(settled.subtotalPaise + settled.gstPaise);
    expect(settled.lines).toHaveLength(2);
  });

  it("validates GSTINs", () => {
    expect(normalizeGstin("29abcde1234f1z5")).toBe("29ABCDE1234F1Z5");
    expect(normalizeGstin("  ")).toBeNull();
    expect(normalizeGstin("12345")).toBeNull();
    expect(normalizeGstin(null)).toBeNull();
  });

  it("numbers bills as LKT-YY-NNNN in IST year", () => {
    expect(nextInvoiceNumber([], new Date("2026-08-31T18:40:00.000Z"))).toBe("LKT-26-0001");
    expect(nextInvoiceNumber(["LKT-26-0001", "LKT-26-0007"], new Date("2026-03-01T00:00:00.000Z"))).toBe(
      "LKT-26-0008",
    );
  });
});

function sampleInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const line = lineFromSku("workshop", 1, undefined, 18);
  return {
    id: "inv_1",
    number: "LKT-26-0001",
    accountId: "acc_1",
    customerName: "Asha",
    customerEmail: "asha@lokutara.test",
    customerPhone: "9876543210",
    organisation: "Nandi Labs",
    customerGstin: null,
    supplyState: null,
    lines: [line],
    discountPaise: 0,
    promoCode: null,
    gstRate: 18,
    subtotalPaise: line.subtotalPaise,
    gstPaise: line.gstPaise,
    totalPaise: line.totalPaise,
    currency: "INR",
    status: "paid",
    issuedAt: new Date("2026-08-31T00:00:00.000Z"),
    dueAt: new Date("2026-09-14T00:00:00.000Z"),
    paidAt: new Date("2026-08-31T00:00:00.000Z"),
    grantAccessOnPay: false,
    kind: "sale",
    razorpayPaymentLinkId: null,
    paymentUrl: null,
    razorpayPaymentId: null,
    notes: null,
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    ...overrides,
  };
}

describe("presentInvoice", () => {
  it("labels complimentary records as Given by Admin at ₹0", () => {
    const invoice = sampleInvoice({
      lines: [
        {
          sku: "app_access",
          label: "Workspace · Given by Admin",
          qty: 1,
          unitAmountPaise: 0,
          gstRate: 0,
          subtotalPaise: 0,
          gstPaise: 0,
          totalPaise: 0,
        },
      ],
      gstRate: 0,
      subtotalPaise: 0,
      gstPaise: 0,
      totalPaise: 0,
      kind: "complimentary",
      razorpayPaymentId: "admin_grant",
      notes: "Given by Admin",
      grantAccessOnPay: true,
    });
    const presented = presentInvoice(invoice);
    expect(presented.totalLabel).toBe("₹0");
    expect(presented.sourceLabel).toBe("Given by Admin");
    expect(presented.documentTitle).toBe("Complimentary record");
    expect(presented.countsTowardRevenue).toBe(false);
    expect(presented.label).toContain("Given by Admin");
  });
});

describe("inrAmountWords", () => {
  it("writes Indian-system words", () => {
    expect(inrAmountWords(0)).toBe("Rupees Zero Only");
    expect(inrAmountWords(26550)).toBe("Rupees Twenty Six Thousand Five Hundred Fifty Only");
    expect(inrAmountWords(2950000)).toBe("Rupees Twenty Nine Lakh Fifty Thousand Only");
  });
});

describe("buildInvoicePdf", () => {
  it("renders a GST invoice with From/To, SAC, CGST/SGST, and words", () => {
    const workshop = lineFromSku("workshop", 1, undefined, 18);
    const counselling = lineFromSku("counselling", 1, undefined, 18);
    const settled = settleInvoiceLines([workshop, counselling], 0);
    const pdf = buildInvoicePdf({
      invoice: sampleInvoice({
        lines: settled.lines,
        subtotalPaise: settled.subtotalPaise,
        gstPaise: settled.gstPaise,
        totalPaise: settled.totalPaise,
        status: "paid",
      }),
      seller: { legalName: "Lokutara", gstin: "29ABCDE1234F1Z5", address: "Bengaluru, Karnataka" },
    });
    const text = Buffer.from(pdf).toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("LOKUTARA");
    expect(text).toContain("Bill to");
    expect(text).toContain("Nandi Labs");
    expect(text).toContain("9992");
    expect(text).toContain("CGST");
    expect(text).toContain("SGST");
    expect(text).toContain("Amount in words");
    expect(text).toContain("Authorised signatory");
    expect(text).toContain("Description");
    expect(text).toContain("Rs 25,000");
  });

  it("keeps text objects balanced and body text black", () => {
    const raw = Buffer.from(
      buildInvoicePdf({
        invoice: sampleInvoice({ status: "issued", paidAt: null }),
        seller: { legalName: "Lokutara", gstin: "", address: "" },
      }),
    ).toString("latin1");
    const streams = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]);
    expect(streams.length).toBeGreaterThan(0);
    for (const stream of streams) {
      const opens = (stream.match(/(^|\s)BT(\s|$)/g) || []).length;
      const closes = (stream.match(/(^|\s)ET(\s|$)/g) || []).length;
      expect(opens).toBe(closes);
    }
    const bandAt = raw.indexOf("1 1 1 rg");
    const blackAfter = raw.indexOf("0 0 0 rg", bandAt);
    expect(bandAt).toBeGreaterThan(-1);
    expect(blackAfter).toBeGreaterThan(bandAt);
  });
});
