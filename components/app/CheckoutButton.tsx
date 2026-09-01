"use client";

import { useState } from "react";
import { showAppToast } from "./AppToast";

async function checkout(sku: string) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku }),
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

export function CheckoutButton({
  sku = "app_access",
  children,
  className = "btn btn-primary",
}: {
  sku?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    const { res, body } = await checkout(sku);
    setBusy(false);
    if (!res.ok) {
      showAppToast(typeof body.message === "string" ? body.message : "Could not start payment. Try again in a moment.");
      return;
    }
    if (typeof body.paymentUrl === "string" && body.paymentUrl) {
      window.location.assign(body.paymentUrl);
      return;
    }
    showAppToast("A payment link was not returned. Try again, or get in touch if this keeps happening.");
  }

  return (
    <button type="button" className={className} disabled={busy} onClick={() => void pay()}>
      {busy ? "Opening payment…" : children}
    </button>
  );
}
