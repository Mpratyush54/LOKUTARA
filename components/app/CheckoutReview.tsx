"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { jsonFetch, useAppAccount } from "./AppShell";
import { showAppToast } from "./AppToast";

type Quote = {
  sku: string;
  label: string;
  unitAmountPaise: number;
  subtotalPaise: number;
  discountPaise: number;
  promoCode: string | null;
  promoLabel: string | null;
  gstRate: number;
  gstPaise: number;
  totalPaise: number;
  totalLabel: string;
  razorpayConfigured: boolean;
};

type CatalogItem = { sku: string; label: string; totalLabel: string; blurb?: string };

function inr(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    paise / 100,
  );
}

export function CheckoutReview() {
  const search = useSearchParams();
  const sku = search.get("sku") || "app_access";
  const account = useAppAccount();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [promo, setPromo] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const { res, body } = await jsonFetch("/api/billing/me");
      if (res.ok) {
        const found = (body.catalog || []).find((row: CatalogItem) => row.sku === sku) ?? null;
        setItem(found);
        if (found) {
          const q = await jsonFetch("/api/billing/quote", {
            method: "POST",
            body: JSON.stringify({ sku }),
          });
          if (q.res.ok) {
            setQuote(q.body as Quote);
          } else {
            setQuoteError(q.body.message || "Could not price this plan");
          }
        }
      } else {
        setQuoteError(body.message || "Could not load billing");
      }
      setReady(true);
    })();
  }, [sku]);

  async function applyPromo() {
    setQuoting(true);
    setQuoteError(null);
    const { res, body } = await jsonFetch("/api/billing/quote", {
      method: "POST",
      body: JSON.stringify({ sku, promoCode: promo }),
    });
    setQuoting(false);
    if (!res.ok) {
      setQuoteError(body.message || "That code did not work");
      return;
    }
    setQuote(body as Quote);
    setAppliedPromo(body.promoCode || "");
  }

  async function pay() {
    setPaying(true);
    const { res, body } = await jsonFetch("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ sku, promoCode: appliedPromo || undefined }),
    });
    setPaying(false);
    if (!res.ok) {
      showAppToast(body.message || "Could not start payment. Try again in a moment.");
      return;
    }
    if (body.paymentUrl) window.location.assign(body.paymentUrl);
  }

  if (!ready) {
    return <div className="app-skeleton app-skeleton-hero" aria-busy="true" data-testid="checkout-skeleton" />;
  }
  if (!item || !quote) {
    return (
      <div className="module-stack">
        <p className="lead">{quoteError || "This plan could not be opened."} <Link href="/app/billing">Back to billing</Link>.</p>
      </div>
    );
  }

  return (
    <div className="module-stack checkout-page">
      <header>
        <p className="eyebrow">Checkout</p>
        <h1>{item.label}</h1>
        {item.blurb ? <p className="lead">{item.blurb}</p> : null}
        {account ? (
          <p className="meta">Buying as {account.name} · {account.email}</p>
        ) : null}
      </header>

      <section className="admin-card checkout-summary" aria-label="Order summary">
        <div className="checkout-row">
          <span>Item</span>
          <strong>{inr(quote.unitAmountPaise)}</strong>
        </div>
        {quote.discountPaise > 0 ? (
          <div className="checkout-row is-discount">
            <span>Discount{quote.promoCode ? ` (${quote.promoCode})` : ""}</span>
            <strong>−{inr(quote.discountPaise)}</strong>
          </div>
        ) : null}
        <div className="checkout-row">
          <span>GST {quote.gstRate}%</span>
          <strong>{inr(quote.gstPaise)}</strong>
        </div>
        <div className="checkout-row is-total">
          <span>Total</span>
          <strong className="num">{quote.totalLabel}</strong>
        </div>
        {quote.promoLabel ? <p className="meta">Code {quote.promoCode}: {quote.promoLabel} applied.</p> : null}
      </section>

      <form
        className="checkout-promo"
        onSubmit={(e) => {
          e.preventDefault();
          void applyPromo();
        }}
      >
        <label className="admin-field">
          <span className="meta">Promo code (optional)</span>
          <input
            className="input"
            value={promo}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
          />
        </label>
        <button type="submit" className="btn btn-secondary" disabled={quoting || !promo.trim()}>
          {quoting ? "Checking…" : "Apply"}
        </button>
      </form>
      {quoteError ? <p className="admin-error" role="alert">{quoteError}</p> : null}

      <div className="paywall-actions">
        {quote.razorpayConfigured ? (
          <button type="button" className="btn btn-primary" disabled={paying} onClick={() => void pay()}>
            {paying ? "Opening payment…" : `Pay ${quote.totalLabel}`}
          </button>
        ) : (
          <p className="meta">Online payment opens soon — <Link href="/#contact">get in touch</Link> to complete this purchase.</p>
        )}
        <Link className="btn btn-ghost" href="/app/billing">
          Back
        </Link>
      </div>
    </div>
  );
}
