import { Router } from "express";
import { asyncHandler, HttpError } from "../middleware/errors";
import { invoiceIdFromWebhook, verifyRazorpaySignature } from "../payments/razorpay";
import { markInvoicePaid } from "../billing/settle";
import type { AccountStore, InvoiceStore } from "../stores/memory";

export function createRazorpayWebhookRouter(deps: {
  invoices: InvoiceStore;
  accounts?: AccountStore;
  webhookSecret: string | null;
}): Router {
  const router = Router();
  router.post(
    "/",
    asyncHandler(async (req, res) => {
      if (!deps.webhookSecret) {
        throw new HttpError(503, "unavailable", "Razorpay webhook secret is not configured");
      }
      const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : typeof req.body === "string" ? req.body : "";
      const signature = typeof req.headers["x-razorpay-signature"] === "string" ? req.headers["x-razorpay-signature"] : "";
      if (!verifyRazorpaySignature(raw, signature, deps.webhookSecret)) {
        throw new HttpError(401, "unauthorized", "Invalid Razorpay signature");
      }
      const parsed = JSON.parse(raw || "{}") as { event?: string };
      const event = parsed.event || "";
      if (event !== "payment_link.paid" && event !== "payment.captured") {
        res.json({ ok: true, ignored: event });
        return;
      }
      const ids = invoiceIdFromWebhook(parsed);
      const invoice = ids.invoiceId
        ? await deps.invoices.get(ids.invoiceId)
        : ids.paymentLinkId
          ? await deps.invoices.getByPaymentLinkId(ids.paymentLinkId)
          : null;
      if (!invoice) {
        res.json({ ok: true, ignored: "unknown_invoice" });
        return;
      }
      await markInvoicePaid(invoice, {
        invoices: deps.invoices,
        accounts: deps.accounts,
        paymentId: ids.paymentId,
      });
      res.json({ ok: true, invoiceId: invoice.id });
    }),
  );
  return router;
}
