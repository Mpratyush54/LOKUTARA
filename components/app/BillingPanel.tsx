"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckoutButton } from "./CheckoutButton";
import { jsonFetch, useAppAccount, useSetAppAccount } from "./AppShell";
import { showAppToast } from "./AppToast";

type CatalogItem = {
  sku: string;
  label: string;
  totalLabel: string;
  grantAccess: boolean;
  recommended?: boolean;
  blurb?: string;
};

type InvoiceRow = {
  id: string;
  number: string;
  label: string;
  status: string;
  totalLabel: string;
  paymentUrl: string | null;
  paidAt: string | null;
  kind?: "sale" | "complimentary";
  sourceLabel?: string;
  documentTitle?: string;
};

export function BillingPanel() {
  const account = useAppAccount();
  const setAccount = useSetAppAccount();
  const search = useSearchParams();
  const returning = search.get("paid") === "1";
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [razorpayConfigured, setRazorpayConfigured] = useState(true);
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(returning);

  useEffect(() => {
    void (async () => {
      const { res, body } = await jsonFetch("/api/billing/me");
      if (!res.ok) {
        showAppToast(body.message || "Could not load billing. Try again in a moment.");
        setReady(true);
        return;
      }
      setCatalog(body.catalog || []);
      setInvoices(body.invoices || []);
      setRazorpayConfigured(Boolean(body.razorpayConfigured));
      if (body.account) setAccount(body.account);
      setReady(true);
    })();
  }, [setAccount]);

  useEffect(() => {
    if (ready && !razorpayConfigured) {
      showAppToast("Online payment is not open yet. Try again later, or get in touch if you need this now.");
    }
  }, [ready, razorpayConfigured]);

  useEffect(() => {
    if (!returning) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      const { res, body } = await jsonFetch("/api/auth/me");
      if (cancelled) return;
      if (res.ok && body.account) {
        setAccount(body.account);
        if (body.account.access?.status === "paid" || attempts >= 8) {
          setConfirming(false);
          return;
        }
      }
      attempts += 1;
      if (attempts < 8) window.setTimeout(() => void tick(), 1500);
      else setConfirming(false);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [returning, setAccount]);

  if (!ready) {
    return <div className="app-skeleton app-skeleton-hero" aria-busy="true" data-testid="billing-skeleton" />;
  }

  const paid = account?.access.status === "paid";
  const complimentaryGrant = invoices.find((invoice) => invoice.kind === "complimentary");

  return (
    <section className="module-stack billing-page">
      <header>
        <p className="eyebrow">Billing</p>
        <h1>{paid ? "Your plan" : "Upgrade or buy"}</h1>
        <p className="lead">
          {complimentaryGrant
            ? "Access on this account was given by Admin at ₹0. That record is not a sale. Paid items below still go through Razorpay."
            : "Same-size plans below. GST is included. You return here after Razorpay."}
        </p>
      </header>

      {confirming ? (
        <p className="upgrade-banner" role="status">
          Confirming your payment. This page will unlock when the receipt lands.
        </p>
      ) : null}

      <div className="billing-grid">
        {catalog.map((item) => {
          const recommended = Boolean(item.recommended) && !paid;
          return (
            <article key={item.sku} className={`billing-card${recommended ? " is-recommended" : ""}`}>
              <div className="billing-card-top">
                {recommended ? <span className="app-plan-pill">Recommended for you</span> : <span className="meta">{item.grantAccess ? "Workspace" : "Session"}</span>}
                {paid && item.sku === "app_access" ? <span className="app-plan-pill">Current plan</span> : null}
              </div>
              <h2>{item.label}</h2>
              <p className="billing-blurb">{item.blurb}</p>
              <p className="num billing-price">{item.totalLabel}</p>
              <p className="meta">Including GST</p>
              <div className="billing-card-cta">
                {paid && item.sku === "app_access" ? (
                  <p className="meta">Already included on this account.</p>
                ) : (
                  <CheckoutButton sku={item.sku}>Pay {item.totalLabel}</CheckoutButton>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {invoices.length ? (
        <section>
          <h2 className="admin-h2">Your invoices</h2>
          <ul className="run-list">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <span>
                  {invoice.number} · {invoice.label}
                  {invoice.kind === "complimentary" ? (
                    <>
                      <br />
                      <span className="meta">{invoice.sourceLabel || "Given by Admin"}</span>
                    </>
                  ) : null}
                </span>
                <span>
                  <span className="app-plan-pill">{invoice.status}</span>{" "}
                  <span className="num">{invoice.totalLabel}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="meta">
        Need a custom programme, or something here is not working?{" "}
        <a href="/#contact">Get in touch</a>.
      </p>
    </section>
  );
}
