import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { invoiceIdFromWebhook, verifyRazorpaySignature } from "./razorpay";

describe("Razorpay webhook helpers", () => {
  it("accepts a matching HMAC and rejects a bad one", () => {
    const body = '{"event":"payment_link.paid"}';
    const secret = "whsec";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyRazorpaySignature(body, signature, secret)).toBe(true);
    expect(verifyRazorpaySignature(body, "deadbeef", secret)).toBe(false);
    expect(verifyRazorpaySignature(body, signature, "other")).toBe(false);
  });

  it("reads invoice id from payment_link notes", () => {
    const ids = invoiceIdFromWebhook({
      event: "payment_link.paid",
      payload: {
        payment_link: { entity: { id: "plink_1", notes: { invoiceId: "inv_abc" } } },
        payment: { entity: { id: "pay_9" } },
      },
    });
    expect(ids).toEqual({ invoiceId: "inv_abc", paymentLinkId: "plink_1", paymentId: "pay_9" });
  });
});
