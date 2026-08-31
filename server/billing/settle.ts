import { ALL_MODULES_ON, type AccountRecord } from "../../lib/access/billing";
import type { Invoice } from "../../lib/billing/invoices";
import type { AccountStore, InvoiceStore } from "../stores/memory";
import { HttpError } from "../middleware/errors";

export async function markInvoicePaid(
  invoice: Invoice,
  deps: {
    invoices: InvoiceStore;
    accounts?: AccountStore;
    paymentId?: string | null;
    paidAt?: Date;
  },
): Promise<Invoice> {
  if (invoice.status === "cancelled") {
    throw new HttpError(409, "conflict", "Cancelled invoices cannot be marked paid");
  }
  if (invoice.status === "paid") return invoice;
  const next: Invoice = {
    ...invoice,
    status: "paid",
    paidAt: deps.paidAt ?? new Date(),
    razorpayPaymentId: deps.paymentId ?? invoice.razorpayPaymentId,
  };
  await deps.invoices.update(next);
  if (next.grantAccessOnPay && next.accountId && deps.accounts) {
    const account = await deps.accounts.getById(next.accountId);
    if (account) {
      const paid: AccountRecord = {
        ...account,
        plan: "paid",
        modules: { ...ALL_MODULES_ON },
      };
      await deps.accounts.update(paid);
    }
  }
  return next;
}
