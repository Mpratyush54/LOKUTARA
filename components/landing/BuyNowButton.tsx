"use client";

import { FormEvent, useEffect, useState } from "react";
import { showAppToast } from "@/components/app/AppToast";
import { parseLandingQuery, writeLandingUrl } from "@/lib/landing/urlState";
import { useScrollLock } from "@/hooks/useScrollLock";

export function BuyNowButton({
  sku,
  children,
  className = "btn btn-primary",
  restoreFromUrl = false,
}: {
  sku: string;
  children: React.ReactNode;
  className?: string;
  restoreFromUrl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  useScrollLock(open);

  useEffect(() => {
    if (!restoreFromUrl) return;
    function syncBuy() {
      const buy = parseLandingQuery(new URLSearchParams(window.location.search)).buy;
      setOpen(buy === sku);
    }
    syncBuy();
    window.addEventListener("popstate", syncBuy);
    window.addEventListener("lokutara:url", syncBuy);
    return () => {
      window.removeEventListener("popstate", syncBuy);
      window.removeEventListener("lokutara:url", syncBuy);
    };
  }, [sku, restoreFromUrl]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.account) {
        setName(body.account.name || "");
        setEmail(body.account.email || "");
        setPhone(body.account.phone || "");
        setOrganisation(body.account.organisation || "");
      }
    })();
  }, [open]);

  async function payLoggedIn() {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku }),
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  }

  async function payGuest() {
    const res = await fetch("/api/billing/guest-checkout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        name,
        email,
        phone,
        organisation: organisation || undefined,
        checkoutLegalAccepted: legalAccepted,
        adultConfirmed: legalAccepted,
      }),
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  }

  async function start() {
    setBusy(true);
    const session = await fetch("/api/auth/me", { credentials: "include" });
    if (session.ok) {
      const { res, body } = await payLoggedIn();
      setBusy(false);
      if (res.ok && body.paymentUrl) {
        window.location.assign(body.paymentUrl);
        return;
      }
      if (res.status !== 401) {
        showAppToast(typeof body.message === "string" ? body.message : "Could not start payment.");
        return;
      }
    }
    setBusy(false);
    if (sku === "app_access") {
      window.location.href = "/signup";
      return;
    }
    setOpen(true);
    writeLandingUrl({ buy: sku }, "push");
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    const { res, body } = await payGuest();
    setBusy(false);
    if (!res.ok) {
      showAppToast(typeof body.message === "string" ? body.message : "Could not start payment.");
      return;
    }
    if (body.paymentUrl) window.location.assign(body.paymentUrl);
  }

  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => void start()}>
        {busy && !open ? "Opening payment…" : children}
      </button>
      {open ? (
        <div
          className="overlay open"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            setOpen(false);
            writeLandingUrl({ buy: null }, "push");
          }}
        >
          <form className="modal" onSubmit={(e) => void onSubmit(e)}>
            <button
              type="button"
              className="modal-close"
              onClick={() => {
                setOpen(false);
                writeLandingUrl({ buy: null }, "push");
              }}
              aria-label="Close"
            >
              ×
            </button>
            <p className="eyebrow">Pay now</p>
            <h2>A few details, then Razorpay</h2>
            <p className="meta" style={{ margin: "8px 0 16px" }}>
              We use these on the invoice. You can close this if you are not ready.
            </p>
            <div className="field">
              <label htmlFor={`buy-name-${sku}`}>Name</label>
              <input className="input" id={`buy-name-${sku}`} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            <div className="field">
              <label htmlFor={`buy-email-${sku}`}>Email</label>
              <input className="input" id={`buy-email-${sku}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor={`buy-phone-${sku}`}>Phone</label>
              <input className="input" id={`buy-phone-${sku}`} value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={8} />
            </div>
            <div className="field">
              <label htmlFor={`buy-org-${sku}`}>Organisation</label>
              <input className="input" id={`buy-org-${sku}`} value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Optional" />
            </div>
            <label className="legal-check">
              <input
                type="checkbox"
                checked={legalAccepted}
                onChange={(event) => setLegalAccepted(event.target.checked)}
                required
              />
              <span>
                I am 18 or older, accept the <a href="/terms">Terms</a>, and acknowledge the{" "}
                <a href="/privacy">Privacy Notice</a>, including invoice and payment
                processing by Razorpay.
              </span>
            </label>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy || !legalAccepted}>
              {busy ? "Opening payment…" : "Continue to payment"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
