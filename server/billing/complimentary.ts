import { randomBytes } from "node:crypto";
import { addDays, type AccountRecord } from "../../lib/access/billing";
import { skuCatalog, skuGrantsAccess, type InvoiceSku } from "../../lib/billing/catalog";
import {
  COMPLIMENTARY_NOTE,
  COMPLIMENTARY_PAYMENT_ID,
  isComplimentaryInvoice,
  nextInvoiceNumber,
  type Invoice,
} from "../../lib/billing/invoices";
import { HttpError } from "../middleware/errors";
import type { AccountStore, InvoiceStore } from "../stores/memory";
import { markInvoicePaid } from "./settle";

const DEFAULT_COMPLIMENTARY_LABEL = "Given by Admin";

export async function grantComplimentaryInvoice(input: {
  account: AccountRecord;
  sku: InvoiceSku;
  invoices: InvoiceStore;
  accounts: AccountStore;
  label?: string;
  notes?: string;
}): Promise<Invoice> {
  const catalog = skuCatalog(input.sku);
  const existing = await input.invoices.list();
  const already = existing.find(
    (invoice) =>
      invoice.accountId === input.account.id &&
      invoice.sku === input.sku &&
      isComplimentaryInvoice(invoice) &&
      invoice.status !== "cancelled",
  );
  if (already) {
    if (already.status === "paid") return already;
    return markInvoicePaid(already, {
      invoices: input.invoices,
      accounts: input.accounts,
      paymentId: COMPLIMENTARY_PAYMENT_ID,
    });
  }

  const now = new Date();
  const draft: Invoice = {
    id: `inv_${randomBytes(8).toString("hex")}`,
    number: nextInvoiceNumber(existing.map((row) => row.number), now),
    accountId: input.account.id,
    customerName: input.account.name,
    customerEmail: input.account.email,
    customerPhone: input.account.phone ?? null,
    organisation: input.account.organisation ?? null,
    sku: input.sku,
    label: input.label?.trim() || `${catalog.label} · ${DEFAULT_COMPLIMENTARY_LABEL}`,
    qty: 1,
    unitAmountPaise: 0,
    gstRate: 0,
    subtotalPaise: 0,
    gstPaise: 0,
    totalPaise: 0,
    currency: "INR",
    status: "issued",
    issuedAt: now,
    dueAt: addDays(now, 0),
    paidAt: null,
    grantAccessOnPay: skuGrantsAccess(input.sku),
    kind: "complimentary",
    razorpayPaymentLinkId: null,
    paymentUrl: null,
    razorpayPaymentId: null,
    notes: input.notes?.trim() || COMPLIMENTARY_NOTE,
    createdAt: now,
  };
  await input.invoices.insert(draft);
  return markInvoicePaid(draft, {
    invoices: input.invoices,
    accounts: input.accounts,
    paymentId: COMPLIMENTARY_PAYMENT_ID,
    paidAt: now,
  });
}

export function requireAccountForComplimentary(account: AccountRecord | null): AccountRecord {
  if (!account) throw new HttpError(404, "not_found", "Choose an existing account to give complimentary access");
  return account;
}
