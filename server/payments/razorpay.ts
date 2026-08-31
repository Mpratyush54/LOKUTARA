import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayPaymentLinkInput = {
  amountPaise: number;
  invoiceId: string;
  invoiceNumber: string;
  description: string;
  customer: { name: string; email: string; contact?: string | null };
};

export type RazorpayClient = {
  configured: boolean;
  createPaymentLink(input: RazorpayPaymentLinkInput): Promise<{ id: string; shortUrl: string }>;
};

export function verifyRazorpaySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createRazorpayClient(opts: {
  keyId: string | null;
  keySecret: string | null;
  fetchImpl?: typeof fetch;
}): RazorpayClient {
  const keyId = opts.keyId;
  const keySecret = opts.keySecret;
  const configured = Boolean(keyId && keySecret);
  const fetchImpl = opts.fetchImpl ?? fetch;

  return {
    configured,
    async createPaymentLink(input) {
      if (!keyId || !keySecret) {
        throw new Error("Razorpay is not configured");
      }
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const res = await fetchImpl("https://api.razorpay.com/v1/payment_links", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: input.amountPaise,
          currency: "INR",
          accept_partial: false,
          description: input.description,
          customer: {
            name: input.customer.name,
            email: input.customer.email,
            contact: input.customer.contact || undefined,
          },
          notify: { sms: Boolean(input.customer.contact), email: true },
          reminder_enable: true,
          notes: {
            invoiceId: input.invoiceId,
            invoiceNumber: input.invoiceNumber,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        short_url?: string;
        error?: { description?: string };
      };
      if (!res.ok || !body.id || !body.short_url) {
        throw new Error(body.error?.description || "Razorpay could not create a payment link");
      }
      return { id: body.id, shortUrl: body.short_url };
    },
  };
}

export function invoiceIdFromWebhook(payload: unknown): { invoiceId: string | null; paymentLinkId: string | null; paymentId: string | null } {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const inner = root.payload && typeof root.payload === "object" ? (root.payload as Record<string, unknown>) : {};
  const link = entityOf(inner.payment_link);
  const payment = entityOf(inner.payment);
  const notes = link.notes && typeof link.notes === "object" ? (link.notes as Record<string, unknown>) : {};
  const invoiceId =
    (typeof notes.invoiceId === "string" && notes.invoiceId) ||
    (typeof notes.invoice_id === "string" && notes.invoice_id) ||
    null;
  return {
    invoiceId,
    paymentLinkId: typeof link.id === "string" ? link.id : null,
    paymentId: typeof payment.id === "string" ? payment.id : null,
  };
}

function entityOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  if (row.entity && typeof row.entity === "object") return row.entity as Record<string, unknown>;
  return row;
}
