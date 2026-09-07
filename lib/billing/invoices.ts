import { CUSTOMER_CHECKOUT_SKUS, skuCatalog, skuGrantsAccess, type CustomerCheckoutSku, type InvoiceSku } from "./catalog";
import { toIstParts } from "./time";

export const DEFAULT_GST_RATE = 18;

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled";
export type InvoiceKind = "sale" | "complimentary";

export const COMPLIMENTARY_PAYMENT_ID = "admin_grant";
export const COMPLIMENTARY_NOTE = "Given by Admin. Complimentary. Not a sale and not counted as revenue.";

export type InvoiceLine = {
  sku: InvoiceSku;
  label: string;
  qty: number;
  unitAmountPaise: number;
  gstRate: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
};

export type Invoice = {
  id: string;
  number: string;
  accountId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  organisation: string | null;
  customerGstin: string | null;
  supplyState: string | null;
  lines: InvoiceLine[];
  discountPaise: number;
  promoCode: string | null;
  /** Taxable after discount (sum of line subtotals minus discount). */
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  /** Dominant / first line GST rate — used for simple displays. */
  gstRate: number;
  currency: "INR";
  status: Exclude<InvoiceStatus, "overdue">;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  grantAccessOnPay: boolean;
  kind: InvoiceKind;
  razorpayPaymentLinkId: string | null;
  paymentUrl: string | null;
  razorpayPaymentId: string | null;
  notes: string | null;
  createdAt: Date;
};

export function invoiceKindOf(invoice: Pick<Invoice, "kind"> | { kind?: InvoiceKind | null }): InvoiceKind {
  return invoice.kind === "complimentary" ? "complimentary" : "sale";
}

export function isComplimentaryInvoice(invoice: Pick<Invoice, "kind"> | { kind?: InvoiceKind | null }): boolean {
  return invoiceKindOf(invoice) === "complimentary";
}

export function countsTowardRevenue(invoice: Pick<Invoice, "kind" | "status" | "paidAt" | "totalPaise">): boolean {
  return (
    !isComplimentaryInvoice(invoice) &&
    invoice.status === "paid" &&
    Boolean(invoice.paidAt) &&
    invoice.totalPaise > 0
  );
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function normalizeGstin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const gstin = raw.trim().toUpperCase();
  if (!gstin) return null;
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return null;
  return gstin;
}

export type GstTaxType = "intra" | "inter";

export type GstBreakdown = {
  type: GstTaxType;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  label: string;
};

export function resolveGstBreakdown(input: {
  gstRate: number;
  gstPaise: number;
  customerGstin?: string | null;
  supplyState?: string | null;
  sellerStateCode?: string;
}): GstBreakdown {
  const sellerState = input.sellerStateCode || "29";
  let isInterState = false;

  const gstin = normalizeGstin(input.customerGstin);
  if (gstin) {
    const custStateCode = gstin.slice(0, 2);
    if (custStateCode !== sellerState) {
      isInterState = true;
    }
  } else if (input.supplyState) {
    const state = input.supplyState.trim().toLowerCase();
    const isLocal =
      state === "karnataka" ||
      state === "ka" ||
      state === "bengaluru" ||
      state === "bangalore" ||
      state === "29";
    if (!isLocal) {
      isInterState = true;
    }
  }

  const rate = Math.max(0, input.gstRate);
  if (isInterState) {
    return {
      type: "inter",
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: input.gstPaise,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: rate,
      label: `IGST ${rate}%`,
    };
  }

  const cgst = Math.round(input.gstPaise / 2);
  const sgst = input.gstPaise - cgst;
  const halfRate = rate / 2;
  return {
    type: "intra",
    cgstPaise: cgst,
    sgstPaise: sgst,
    igstPaise: 0,
    cgstRate: halfRate,
    sgstRate: halfRate,
    label: `CGST ${halfRate}% + SGST ${halfRate}%`,
  };
}

export function invoiceTotals(unitAmountPaise: number, qty: number, gstRate: number) {
  const safeQty = Math.max(1, Math.floor(qty));
  const safeRate = Math.max(0, Math.min(40, gstRate));
  const subtotalPaise = Math.max(0, Math.round(unitAmountPaise) * safeQty);
  const gstPaise = Math.round(subtotalPaise * (safeRate / 100));
  return { subtotalPaise, gstPaise, totalPaise: subtotalPaise + gstPaise, qty: safeQty, gstRate: safeRate };
}

export function nextInvoiceNumber(existingNumbers: string[], now = new Date()): string {
  const yy = String(toIstParts(now).year).slice(-2);
  const prefix = `LKT-${yy}-`;
  let max = 0;
  for (const number of existingNumbers) {
    if (!number.startsWith(prefix)) continue;
    const n = Number(number.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function lineFromSku(
  sku: InvoiceSku,
  qty: number,
  unitAmountPaise: number | undefined,
  gstRate: number,
  label?: string,
): InvoiceLine {
  const catalog = skuCatalog(sku);
  const unit = unitAmountPaise != null && Number.isFinite(unitAmountPaise) ? unitAmountPaise : catalog.unitAmountPaise;
  const totals = invoiceTotals(unit, qty, gstRate);
  return {
    sku,
    label: label?.trim() || catalog.label,
    unitAmountPaise: Math.round(unit),
    ...totals,
  };
}

/** Build priced lines, then apply an invoice-level pre-GST discount proportionally. */
export function settleInvoiceLines(lines: InvoiceLine[], discountPaise = 0): {
  lines: InvoiceLine[];
  discountPaise: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  gstRate: number;
} {
  if (!lines.length) {
    return { lines: [], discountPaise: 0, subtotalPaise: 0, gstPaise: 0, totalPaise: 0, gstRate: 0 };
  }
  const gross = lines.reduce((sum, line) => sum + line.subtotalPaise, 0);
  const discount = Math.min(Math.max(0, Math.round(discountPaise)), gross);
  let allocated = 0;
  const settled = lines.map((line, index) => {
    const isLast = index === lines.length - 1;
    const share =
      discount === 0 || gross === 0
        ? 0
        : isLast
          ? discount - allocated
          : Math.round((discount * line.subtotalPaise) / gross);
    if (!isLast) allocated += share;
    const taxable = Math.max(0, line.subtotalPaise - share);
    const gstPaise = Math.round(taxable * (line.gstRate / 100));
    return {
      ...line,
      subtotalPaise: taxable,
      gstPaise,
      totalPaise: taxable + gstPaise,
    };
  });
  const subtotalPaise = settled.reduce((sum, line) => sum + line.subtotalPaise, 0);
  const gstPaise = settled.reduce((sum, line) => sum + line.gstPaise, 0);
  return {
    lines: settled,
    discountPaise: discount,
    subtotalPaise,
    gstPaise,
    totalPaise: subtotalPaise + gstPaise,
    gstRate: settled[0]?.gstRate ?? 0,
  };
}

export function invoiceSummaryLabel(lines: InvoiceLine[]): string {
  if (!lines.length) return "Invoice";
  if (lines.length === 1) return lines[0].label;
  if (lines.length === 2) return `${lines[0].label} + ${lines[1].label}`;
  return `${lines[0].label} + ${lines.length - 1} more`;
}

export function invoicePrimarySku(lines: InvoiceLine[]): InvoiceSku | null {
  return lines[0]?.sku ?? null;
}

export function invoiceHasSku(invoice: Pick<Invoice, "lines">, sku: InvoiceSku): boolean {
  return invoice.lines.some((line) => line.sku === sku);
}

export function invoiceGrantsAccess(lines: InvoiceLine[]): boolean {
  return lines.some((line) => skuGrantsAccess(line.sku));
}

export function effectiveStatus(invoice: Pick<Invoice, "status" | "dueAt">, now = new Date()): InvoiceStatus {
  if (invoice.status === "issued" && invoice.dueAt && invoice.dueAt.getTime() < now.getTime()) return "overdue";
  return invoice.status;
}

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function presentInvoice(invoice: Invoice, now = new Date()) {
  const kind = invoiceKindOf(invoice);
  const complimentary = kind === "complimentary";
  const label = invoiceSummaryLabel(invoice.lines);
  const qty = invoice.lines.reduce((sum, line) => sum + line.qty, 0);
  return {
    ...invoice,
    kind,
    sku: invoicePrimarySku(invoice.lines),
    label,
    qty,
    unitAmountPaise: invoice.lines[0]?.unitAmountPaise ?? 0,
    status: effectiveStatus(invoice, now),
    storedStatus: invoice.status,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    totalLabel: complimentary ? "₹0" : formatInrFromPaise(invoice.totalPaise),
    sourceLabel: complimentary ? "Given by Admin" : invoice.razorpayPaymentId ? "Razorpay" : invoice.paidAt ? "Recorded payment" : "Awaiting payment",
    countsTowardRevenue: countsTowardRevenue({ ...invoice, kind }),
    documentTitle: complimentary ? "Complimentary record" : "Tax invoice",
  };
}

const CUSTOMER_SKU_BLURBS: Record<CustomerCheckoutSku, string> = {
  app_access: "Recommended if you want to keep assessments, reports, and community after the trial.",
  counselling: "A 60-minute one-to-one session.",
  virtual_session: "A 2-3 hour virtual session for a team.",
  workshop: "A 2-3 hour workshop, scoped around the room you have.",
  full_day: "A full day tailored for your group.",
};

export function presentCustomerCatalog(gstRate: number) {
  return CUSTOMER_CHECKOUT_SKUS.map((sku) => {
    const item = skuCatalog(sku);
    const totals = invoiceTotals(item.unitAmountPaise, 1, gstRate);
    return {
      sku: item.sku,
      label: item.label,
      unitAmountPaise: item.unitAmountPaise,
      gstRate: totals.gstRate,
      subtotalPaise: totals.subtotalPaise,
      gstPaise: totals.gstPaise,
      totalPaise: totals.totalPaise,
      totalLabel: formatInrFromPaise(totals.totalPaise),
      grantAccess: skuGrantsAccess(item.sku),
      recommended: sku === "app_access",
      blurb: CUSTOMER_SKU_BLURBS[sku],
    };
  });
}
