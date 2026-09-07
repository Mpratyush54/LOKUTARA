"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { SELL_ITEMS } from "@/lib/landing/content";
import { showAppToast } from "@/components/app/AppToast";

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

function formatMoney(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const skuQuery = searchParams.get("sku") || searchParams.get("buy") || "workshop";

  const selectedItem =
    SELL_ITEMS.find((item) => item.sku === skuQuery || item.id === skuQuery) || SELL_ITEMS[3]; // Default to workshop

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [supplyState, setSupplyState] = useState("Karnataka");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load quote and pre-fill user profile if logged in
  useEffect(() => {
    let active = true;

    async function init() {
      setLoadingQuote(true);
      try {
        // Fetch quote for selected SKU
        const res = await fetch("/api/billing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sku: selectedItem.sku }),
        });
        const data = await res.json();
        if (active && res.ok) {
          setQuote(data);
        }

        // Check if user is logged in to pre-fill details
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (active && meRes.ok) {
          const me = await meRes.json();
          if (me.account) {
            setName(me.account.name || "");
            setEmail(me.account.email || "");
            setPhone(me.account.phone || "");
            setOrganisation(me.account.organisation || "");
          }
        }
      } catch {
        // Fallback calculation in case of network issue
      } finally {
        if (active) setLoadingQuote(false);
      }
    }

    void init();
    return () => {
      active = false;
    };
  }, [selectedItem.sku]);

  async function handleApplyPromo(e: FormEvent) {
    e.preventDefault();
    if (!promoCode.trim()) return;

    setApplyingPromo(true);
    setPromoMessage(null);
    try {
      const res = await fetch("/api/billing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: selectedItem.sku,
          promoCode: promoCode.trim().toUpperCase(),
          email: email.trim().toLowerCase() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setQuote(data);
        setPromoMessage(`Promo code applied: ${data.promoLabel || "Discount updated"}`);
      } else {
        setPromoMessage(data.message || "Invalid or expired promo code");
      }
    } catch {
      setPromoMessage("Could not validate promo code. Try again.");
    } finally {
      setApplyingPromo(false);
    }
  }

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (!legalAccepted) {
      showAppToast("Please acknowledge the Terms and Privacy Notice to proceed.");
      return;
    }

    setBusy(true);

    try {
      // First check if user is authenticated
      const sessionRes = await fetch("/api/auth/me", { credentials: "include" });
      if (sessionRes.ok) {
        const loggedInPay = await fetch("/api/billing/checkout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku: selectedItem.sku,
            promoCode: quote?.promoCode || undefined,
          }),
        });
        const data = await loggedInPay.json();
        setBusy(false);
        if (loggedInPay.ok && data.paymentUrl) {
          window.location.assign(data.paymentUrl);
          return;
        }
      }

      // Otherwise, process transparent guest checkout
      const guestPay = await fetch("/api/billing/guest-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: selectedItem.sku,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          organisation: organisation.trim() || undefined,
          promoCode: quote?.promoCode || undefined,
          checkoutLegalAccepted: true,
          adultConfirmed: true,
        }),
      });

      const data = await guestPay.json();
      setBusy(false);

      if (guestPay.ok && data.paymentUrl) {
        window.location.assign(data.paymentUrl);
        return;
      }

      showAppToast(
        data.message ||
          "Online payments are currently unavailable in this environment. Please check back shortly.",
      );
    } catch {
      setBusy(false);
      showAppToast("Network error. Please verify your connection and try again.");
    }
  }

  // Fallback estimates if quote is loading
  const subtotalPaise = quote?.subtotalPaise ?? 2500000;
  const gstPaise = quote?.gstPaise ?? Math.round(subtotalPaise * 0.18);
  const discountPaise = quote?.discountPaise ?? 0;
  const totalPaise = quote?.totalPaise ?? subtotalPaise + gstPaise;

  return (
    <main className="checkout-shell">
      <div className="checkout-container">
        <header className="checkout-nav">
          <Link href="/" className="checkout-brand">
            LOKUTARA
          </Link>
          <Link href="/#pricing" className="checkout-nav-back">
            ← Back to offerings
          </Link>
        </header>

        <div className="checkout-grid">
          {/* Left Column: Order Summary, Transparent Pricing, Promo Code, Trust Badges */}
          <section className="checkout-card" aria-label="Transparent Order Summary">
            <div className="checkout-item-hero">
              <span className="eyebrow" style={{ color: "var(--forest)", marginBottom: 4 }}>
                {selectedItem.tag || "Executive Capacity"} · {selectedItem.duration}
              </span>
              <h2>{selectedItem.title}</h2>
              <p>{selectedItem.blurb}</p>

              {selectedItem.includes?.length ? (
                <ul className="checkout-includes">
                  {selectedItem.includes.map((inc, i) => (
                    <li key={i}>{inc}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* Transparent Price Breakdown */}
            <div className="checkout-breakdown">
              <div className="checkout-row">
                <span>Base Service Fee</span>
                <strong>{formatMoney(subtotalPaise + discountPaise)}</strong>
              </div>

              {discountPaise > 0 ? (
                <div className="checkout-row is-discount">
                  <span>
                    Promotional Discount {quote?.promoCode ? `(${quote.promoCode})` : ""}
                  </span>
                  <strong>−{formatMoney(discountPaise)}</strong>
                </div>
              ) : null}

              <div className="checkout-row">
                <span>Taxable Amount</span>
                <strong>{formatMoney(subtotalPaise)}</strong>
              </div>

              <div className="checkout-row">
                <span>GST (18% Goods & Services Tax)</span>
                <strong>{formatMoney(gstPaise)}</strong>
              </div>

              <div className="checkout-row is-total">
                <span>Total Payable</span>
                <strong>{formatMoney(totalPaise)}</strong>
              </div>
            </div>

            {/* Promo Code Input */}
            <form className="checkout-promo-box" onSubmit={handleApplyPromo}>
              <input
                className="input"
                type="text"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                disabled={applyingPromo}
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={applyingPromo || !promoCode.trim()}
              >
                {applyingPromo ? "Applying…" : "Apply"}
              </button>
            </form>
            {promoMessage ? (
              <p
                style={{
                  fontSize: 13,
                  marginTop: -16,
                  marginBottom: 16,
                  color: promoMessage.includes("applied") ? "var(--forest)" : "var(--accent)",
                }}
              >
                {promoMessage}
              </p>
            ) : null}

            {/* Trust & Transparency Assurances */}
            <div className="checkout-trust">
              <div className="checkout-trust-item">
                <span>🧾</span>
                <span>
                  <strong>Official GST Tax Invoice</strong> automatically generated and emailed
                  upon successful settlement.
                </span>
              </div>
              <div className="checkout-trust-item">
                <span>🔒</span>
                <span>
                  <strong>256-Bit Encrypted Checkout</strong> processed securely via Razorpay
                  supporting UPI, Cards, Netbanking, and EMI.
                </span>
              </div>
              <div className="checkout-trust-item">
                <span>✓</span>
                <span>
                  <strong>100% Transparent Billing</strong> — No hidden platform surcharges or
                  convenience markups.
                </span>
              </div>
            </div>
          </section>

          {/* Right Column: Buyer Details & Instant Checkout Form */}
          <section className="checkout-card checkout-form" aria-label="Billing Information">
            <h3>Billing & Registration</h3>
            <p className="meta" style={{ marginBottom: 20 }}>
              These details will be registered on your booking and printed on your official GST tax
              invoice.
            </p>

            <form onSubmit={handleCheckout}>
              <div className="field">
                <label htmlFor="checkout-name">Full Name *</label>
                <input
                  id="checkout-name"
                  className="input"
                  type="text"
                  placeholder="e.g. Joel Sam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>

              <div className="field">
                <label htmlFor="checkout-email">Email Address *</label>
                <input
                  id="checkout-email"
                  className="input"
                  type="email"
                  placeholder="e.g. joel@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="checkout-phone">Phone Number *</label>
                <input
                  id="checkout-phone"
                  className="input"
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="field">
                <label htmlFor="checkout-org">Company / Organisation</label>
                <input
                  id="checkout-org"
                  className="input"
                  type="text"
                  placeholder="e.g. Nandi Labs (optional)"
                  value={organisation}
                  onChange={(e) => setOrganisation(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="checkout-gstin">GSTIN (Optional, for B2B Input Tax Credit)</label>
                <input
                  id="checkout-gstin"
                  className="input"
                  type="text"
                  placeholder="e.g. 29AAAAA0000A1Z5"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  maxLength={15}
                />
              </div>

              <div className="field">
                <label htmlFor="checkout-state">Place of Supply (State) *</label>
                <input
                  id="checkout-state"
                  className="input"
                  type="text"
                  placeholder="Karnataka (29)"
                  value={supplyState}
                  onChange={(e) => setSupplyState(e.target.value)}
                  required
                />
              </div>

              <label className="legal-check" style={{ marginTop: 12, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  checked={legalAccepted}
                  onChange={(e) => setLegalAccepted(e.target.checked)}
                  required
                />
                <span style={{ fontSize: 13, lineHeight: 1.4 }}>
                  I am 18 or older, accept the <Link href="/terms">Terms of Service</Link>, and
                  acknowledge the <Link href="/privacy">Privacy Notice</Link>, with secure payment
                  processing by Razorpay.
                </span>
              </label>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", padding: "14px 20px", fontSize: 16 }}
                disabled={busy || !legalAccepted || loadingQuote}
              >
                {busy
                  ? "Securing payment link…"
                  : `Proceed to Secure Payment · ${formatMoney(totalPaise)}`}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="checkout-shell"><div className="checkout-container"><div className="admin-skeleton" /></div></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
