import { randomBytes } from "node:crypto";
import { addDays } from "../../lib/access/billing";
import { skuGrantsAccess, type CustomerCheckoutSku } from "../../lib/billing/catalog";
import {
  isComplimentaryInvoice,
  lineFromSku,
  nextInvoiceNumber,
  type Invoice,
} from "../../lib/billing/invoices";
import { HttpError } from "../middleware/errors";
import { issueInvoice } from "./issue";
import type { InvoiceStore } from "../stores/memory";
import type { RazorpayClient } from "../payments/razorpay";

export async function createCustomerPayment(input: {
  sku: CustomerCheckoutSku;
  gstRate: number;
  customer: {
    accountId: string | null;
    name: string;
    email: string;
    phone: string | null;
    organisation: string | null;
  };
  invoices: InvoiceStore;
  razorpay?: RazorpayClient;
  callbackUrl: string | null;
  notes: string;
}): Promise<{ invoice: Invoice; created: boolean }> {
  const open = (await input.invoices.list()).find(
    (invoice) =>
      (input.customer.accountId
        ? invoice.accountId === input.customer.accountId
        : invoice.customerEmail === input.customer.email) &&
      invoice.sku === input.sku &&
      (invoice.status === "draft" || invoice.status === "issued") &&
      !invoice.paidAt &&
      !isComplimentaryInvoice(invoice),
  );
  if (open) {
    const invoice = await issueInvoice(open, {
      invoices: input.invoices,
      razorpay: input.razorpay,
      callbackUrl: input.callbackUrl,
    });
    return { invoice, created: false };
  }
  const line = lineFromSku(input.sku, 1, undefined, input.gstRate);
  if (line.totalPaise < 100) {
    throw new HttpError(400, "invalid", "This item cannot be purchased online");
  }
  const existing = await input.invoices.list();
  const draft: Invoice = {
    id: `inv_${randomBytes(8).toString("hex")}`,
    number: nextInvoiceNumber(existing.map((row) => row.number)),
    accountId: input.customer.accountId,
    customerName: input.customer.name,
    customerEmail: input.customer.email,
    customerPhone: input.customer.phone,
    organisation: input.customer.organisation,
    sku: line.sku,
    label: line.label,
    qty: line.qty,
    unitAmountPaise: line.unitAmountPaise,
    gstRate: line.gstRate,
    subtotalPaise: line.subtotalPaise,
    gstPaise: line.gstPaise,
    totalPaise: line.totalPaise,
    currency: "INR",
    status: "draft",
    issuedAt: null,
    dueAt: addDays(new Date(), 7),
    paidAt: null,
    grantAccessOnPay: Boolean(input.customer.accountId) && skuGrantsAccess(line.sku),
    kind: "sale",
    razorpayPaymentLinkId: null,
    paymentUrl: null,
    razorpayPaymentId: null,
    notes: input.notes,
    createdAt: new Date(),
  };
  await input.invoices.insert(draft);
  const invoice = await issueInvoice(draft, {
    invoices: input.invoices,
    razorpay: input.razorpay,
    callbackUrl: input.callbackUrl,
  });
  return { invoice, created: true };
}
