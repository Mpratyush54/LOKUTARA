import { isComplimentaryInvoice, type Invoice } from "../../lib/billing/invoices";
import { HttpError } from "../middleware/errors";
import type { RazorpayClient } from "../payments/razorpay";
import type { InvoiceStore } from "../stores/memory";

export async function issueInvoice(
  invoice: Invoice,
  deps: { invoices?: InvoiceStore; razorpay?: RazorpayClient; callbackUrl?: string | null },
): Promise<Invoice> {
  if (!deps.invoices) throw new HttpError(503, "unavailable", "Invoice store is not configured");
  if (invoice.status === "paid") throw new HttpError(409, "conflict", "Invoice is already paid");
  if (invoice.status === "cancelled") throw new HttpError(409, "conflict", "Cancelled invoices cannot be issued");
  const complimentary = isComplimentaryInvoice(invoice) || invoice.totalPaise < 100;
  let paymentUrl = invoice.paymentUrl;
  let razorpayPaymentLinkId = invoice.razorpayPaymentLinkId;
  if (!complimentary && deps.razorpay?.configured && !paymentUrl) {
    const link = await deps.razorpay.createPaymentLink({
      amountPaise: invoice.totalPaise,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      description: `${invoice.number} · ${invoice.label}`,
      customer: {
        name: invoice.customerName,
        email: invoice.customerEmail,
        contact: invoice.customerPhone,
      },
      callbackUrl: deps.callbackUrl,
    });
    razorpayPaymentLinkId = link.id;
    paymentUrl = link.shortUrl;
  }
  const next: Invoice = {
    ...invoice,
    status: "issued",
    issuedAt: invoice.issuedAt ?? new Date(),
    razorpayPaymentLinkId,
    paymentUrl,
  };
  await deps.invoices.update(next);
  return next;
}
