import { skuCatalog, type InvoiceSku } from "./catalog";
import { toIstParts } from "./time";

export const DEFAULT_GST_RATE = 18;

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled";

export type Invoice = {
  id: string;
  number: string;
  accountId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  organisation: string | null;
  sku: InvoiceSku;
  label: string;
  qty: number;
  unitAmountPaise: number;
  gstRate: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  currency: "INR";
  status: Exclude<InvoiceStatus, "overdue">;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  grantAccessOnPay: boolean;
  razorpayPaymentLinkId: string | null;
  paymentUrl: string | null;
  razorpayPaymentId: string | null;
  notes: string | null;
  createdAt: Date;
};

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
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

export function lineFromSku(sku: InvoiceSku, qty: number, unitAmountPaise: number | undefined, gstRate: number) {
  const catalog = skuCatalog(sku);
  const unit = unitAmountPaise != null && Number.isFinite(unitAmountPaise) ? unitAmountPaise : catalog.unitAmountPaise;
  const totals = invoiceTotals(unit, qty, gstRate);
  return {
    sku,
    label: catalog.label,
    unitAmountPaise: Math.round(unit),
    ...totals,
  };
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
  return {
    ...invoice,
    status: effectiveStatus(invoice, now),
    storedStatus: invoice.status,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    totalLabel: formatInrFromPaise(invoice.totalPaise),
  };
}
