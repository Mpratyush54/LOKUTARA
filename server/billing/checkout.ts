import { randomBytes } from "node:crypto";
import { addDays } from "../../lib/access/billing";
import { skuGrantsAccess, type CustomerCheckoutSku } from "../../lib/billing/catalog";
import {
  invoiceHasSku,
  invoiceSummaryLabel,
  isComplimentaryInvoice,
  lineFromSku,
  nextInvoiceNumber,
  settleInvoiceLines,
  type Invoice,
} from "../../lib/billing/invoices";
import { normalizePromoCode, promoDiscountPaise, validatePromo, type Promo } from "../../lib/billing/promos";
import { HttpError } from "../middleware/errors";
import { issueInvoice } from "./issue";
import type { InvoiceStore, PromoStore } from "../stores/memory";
import type { RazorpayClient } from "../payments/razorpay";

export async function resolvePromo(input: {
  promoCode: unknown;
  email: string;
  accountId: string | null;
  invoices: InvoiceStore;
  promos?: PromoStore;
}): Promise<{ promo: Promo | null; code: string | null }> {
  const code = normalizePromoCode(input.promoCode);
  if (!code) return { promo: null, code: null };
  if (!input.promos) throw new HttpError(400, "invalid", "Promo codes are not available right now");
  const promo = await input.promos.getByCode(code);
  if (!promo) throw new HttpError(400, "invalid", "That code did not match");
  const paidBefore = (await input.invoices.list()).some(
    (invoice) =>
      invoice.status === "paid" &&
      invoice.totalPaise > 0 &&
      (input.accountId ? invoice.accountId === input.accountId : invoice.customerEmail === input.email),
  );
  const checked = validatePromo(promo, { isFirstTime: !paidBefore });
  if (!checked.ok) throw new HttpError(400, "invalid", checked.error);
  return { promo, code };
}

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
  promos?: PromoStore;
  promoCode?: unknown;
  razorpay?: RazorpayClient;
  callbackUrl: string | null;
  notes: string;
}): Promise<{ invoice: Invoice; created: boolean }> {
  const priced = lineFromSku(input.sku, 1, undefined, input.gstRate);
  if (priced.totalPaise < 100) {
    throw new HttpError(400, "invalid", "This item cannot be purchased online");
  }
  const { promo, code: promoCode } = await resolvePromo({
    promoCode: input.promoCode,
    email: input.customer.email,
    accountId: input.customer.accountId,
    invoices: input.invoices,
    promos: input.promos,
  });
  const discount = promo ? promoDiscountPaise(promo, priced.subtotalPaise) : 0;
  const settled = settleInvoiceLines([priced], discount);
  if (settled.totalPaise < 100) {
    throw new HttpError(400, "invalid", "This code brings the total below the minimum bill");
  }

  const open = (await input.invoices.list()).find(
    (invoice) =>
      (input.customer.accountId
        ? invoice.accountId === input.customer.accountId
        : invoice.customerEmail === input.customer.email) &&
      invoice.lines.length === 1 &&
      invoiceHasSku(invoice, input.sku) &&
      (invoice.status === "draft" || invoice.status === "issued") &&
      !invoice.paidAt &&
      !isComplimentaryInvoice(invoice),
  );
  if (open) {
    const promoOrAmountChanged = open.promoCode !== promoCode || open.totalPaise !== settled.totalPaise;
    if (promoOrAmountChanged) {
      const updated: Invoice = {
        ...open,
        lines: settled.lines,
        discountPaise: settled.discountPaise,
        promoCode,
        gstRate: settled.gstRate,
        subtotalPaise: settled.subtotalPaise,
        gstPaise: settled.gstPaise,
        totalPaise: settled.totalPaise,
        razorpayPaymentLinkId: null,
        paymentUrl: null,
        notes: promoCode ? `${input.notes} · Code ${promoCode}` : input.notes,
      };
      await input.invoices.update(updated);
      const invoice = await issueInvoice(updated, {
        invoices: input.invoices,
        razorpay: input.razorpay,
        callbackUrl: input.callbackUrl,
      });
      return { invoice, created: false };
    }
    const invoice = await issueInvoice(open, {
      invoices: input.invoices,
      razorpay: input.razorpay,
      callbackUrl: input.callbackUrl,
    });
    return { invoice, created: false };
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
    customerGstin: null,
    supplyState: null,
    lines: settled.lines,
    discountPaise: settled.discountPaise,
    promoCode,
    gstRate: settled.gstRate,
    subtotalPaise: settled.subtotalPaise,
    gstPaise: settled.gstPaise,
    totalPaise: settled.totalPaise,
    currency: "INR",
    status: "draft",
    issuedAt: null,
    dueAt: addDays(new Date(), 7),
    paidAt: null,
    grantAccessOnPay: Boolean(input.customer.accountId) && skuGrantsAccess(input.sku),
    kind: "sale",
    razorpayPaymentLinkId: null,
    paymentUrl: null,
    razorpayPaymentId: null,
    notes: promoCode ? `${input.notes} · Code ${promoCode}` : input.notes,
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

export { invoiceSummaryLabel };
