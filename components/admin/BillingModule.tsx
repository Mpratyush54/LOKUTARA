"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { INVOICE_SKUS, type InvoiceSku } from "@/lib/billing/catalog";
import { formatInrFromPaise, invoiceTotals, rupeesToPaise } from "@/lib/billing/invoices";

type AccountOption = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  organisation?: string | null;
};

export type PresentedInvoice = {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  organisation: string | null;
  sku: string;
  label: string;
  qty: number;
  unitAmountPaise: number;
  gstRate: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  status: string;
  paymentUrl: string | null;
  grantAccessOnPay: boolean;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  totalLabel: string;
  notes: string | null;
};

type SellerSettings = {
  legalName: string;
  gstin: string;
  address: string;
  gstRate: number;
};

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

export function BillingModule({
  accounts,
  ensureAccounts,
  onChanged,
}: {
  accounts: AccountOption[] | null;
  ensureAccounts: () => void;
  onChanged: () => void;
}) {
  const [invoices, setInvoices] = useState<PresentedInvoice[] | null>(null);
  const [catalog, setCatalog] = useState(INVOICE_SKUS);
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);
  const [settings, setSettings] = useState<SellerSettings>({
    legalName: "Lokutara",
    gstin: "",
    address: "",
    gstRate: 18,
  });
  const [error, setError] = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<PresentedInvoice | null>(null);
  const [sku, setSku] = useState<InvoiceSku>("workshop");
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [qty, setQty] = useState(1);
  const [unitRupees, setUnitRupees] = useState(String(INVOICE_SKUS.find((item) => item.sku === "workshop")!.unitAmountPaise / 100));
  const [gstRate, setGstRate] = useState(18);
  const [grantAccess, setGrantAccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = catalog.find((item) => item.sku === sku) ?? catalog[0];
  const preview = useMemo(
    () => invoiceTotals(rupeesToPaise(Number(unitRupees) || 0), qty, gstRate),
    [unitRupees, qty, gstRate],
  );

  async function load() {
    const { res, body } = await fetchJson("/api/admin/invoices");
    if (!res.ok) {
      setError(body.message || "Could not load invoices");
      return;
    }
    setInvoices(body.invoices || []);
    if (body.catalog) setCatalog(body.catalog);
    setRazorpayConfigured(Boolean(body.razorpayConfigured));
    if (body.settings) {
      setSettings(body.settings);
      setGstRate(Number(body.settings.gstRate) || 18);
    }
  }

  useEffect(() => {
    ensureAccounts();
    void load();
    // Load once when the Billing tab mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickSku(next: InvoiceSku) {
    setSku(next);
    const item = catalog.find((row) => row.sku === next);
    if (item && !item.custom) setUnitRupees(String(item.unitAmountPaise / 100));
    if (next === "app_access") setGrantAccess(true);
  }

  function pickAccount(id: string) {
    setAccountId(id);
    const account = (accounts || []).find((row) => row.id === id);
    if (!account) return;
    setName(account.name);
    setEmail(account.email);
    setPhone(account.phone || "");
    setOrganisation(account.organisation || "");
  }

  async function onCreate(ev: FormEvent, issue: boolean) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const { res, body } = await fetchJson("/api/admin/invoices", {
      method: "POST",
      body: JSON.stringify({
        accountId: accountId || undefined,
        name,
        email,
        phone,
        organisation,
        sku,
        qty,
        unitAmountRupees: Number(unitRupees),
        gstRate,
        grantAccessOnPay: grantAccess,
        issue,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(body.message || "Could not create invoice");
      return;
    }
    setName("");
    setEmail("");
    setPhone("");
    setOrganisation("");
    setAccountId("");
    await load();
    onChanged();
  }

  async function act(id: string, action: "issue" | "record-payment" | "cancel") {
    setBusy(true);
    setError(null);
    const { res, body } = await fetchJson(`/api/admin/invoices/${id}/${action}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(body.message || "Could not update invoice");
      return;
    }
    await load();
    onChanged();
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setError("Could not copy the payment link");
    }
  }

  async function saveSeller(ev: FormEvent) {
    ev.preventDefault();
    const { res, body } = await fetchJson("/api/admin/billing", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    if (!res.ok) setError(body.message || "Could not save seller details");
  }

  if (printInvoice) {
    return (
      <section className="admin-panel" data-testid="admin-bill-print">
        <div className="admin-top-actions admin-print-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print bill
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setPrintInvoice(null)}>
            Back to billing
          </button>
        </div>
        <article className="admin-bill">
          <header>
            <p className="eyebrow">Tax invoice</p>
            <h2>{settings.legalName || "Lokutara"}</h2>
            {settings.address ? <p className="meta">{settings.address}</p> : null}
            {settings.gstin ? <p className="meta">GSTIN {settings.gstin}</p> : null}
          </header>
          <p>
            <strong>{printInvoice.number}</strong>
            <span className="meta"> · {printInvoice.status}</span>
          </p>
          <p>
            Bill to {printInvoice.customerName}
            <br />
            <span className="meta">
              {[printInvoice.customerEmail, printInvoice.customerPhone, printInvoice.organisation].filter(Boolean).join(" · ")}
            </span>
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{printInvoice.label}</td>
                <td>{printInvoice.qty}</td>
                <td className="num">{formatInrFromPaise(printInvoice.subtotalPaise)}</td>
              </tr>
              <tr>
                <td colSpan={2}>GST {printInvoice.gstRate}%</td>
                <td className="num">{formatInrFromPaise(printInvoice.gstPaise)}</td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td className="num">
                  <strong>{printInvoice.totalLabel}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </article>
      </section>
    );
  }

  return (
    <section className="admin-panel" data-testid="admin-billing">
      <div className="admin-card-head">
        <h2 className="admin-h2">Billing</h2>
      </div>
      <p className="lead admin-hint">
        Issue a Lokutara bill from the workshop catalogue. Razorpay sends the payment link when keys are set; otherwise record
        NEFT or cash.
      </p>
      {!razorpayConfigured ? (
        <p className="admin-flag" role="status">
          <strong>Razorpay is not configured</strong>
          <span>Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to email payment links. Drafts and Record payment still work.</span>
        </p>
      ) : null}
      {error ? <p className="admin-error">{error}</p> : null}

      <form className="admin-card admin-bill-form" onSubmit={(ev) => void onCreate(ev, true)}>
        <h3 className="admin-h2">New bill</h3>
        <div className="admin-sku-row" role="group" aria-label="Catalogue">
          {catalog.map((item) => (
            <button
              key={item.sku}
              type="button"
              className={sku === item.sku ? "is-on" : undefined}
              onClick={() => pickSku(item.sku)}
            >
              {item.label}
              {item.unitAmountPaise ? ` · ${formatInrFromPaise(item.unitAmountPaise)}` : ""}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label className="admin-field">
            <span className="meta">Existing person</span>
            <select className="input" value={accountId} onChange={(e) => pickAccount(e.target.value)}>
              <option value="">New customer</option>
              {(accounts || []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.email}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span className="meta">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="admin-field">
            <span className="meta">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="admin-field">
            <span className="meta">Phone</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="admin-field">
            <span className="meta">Organisation</span>
            <input className="input" value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
          </label>
          <label className="admin-field">
            <span className="meta">Qty</span>
            <input className="input" type="number" min={1} max={50} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </label>
          <label className="admin-field">
            <span className="meta">Unit ₹ (ex-GST)</span>
            <input className="input" type="number" min={1} value={unitRupees} onChange={(e) => setUnitRupees(e.target.value)} />
          </label>
          <label className="admin-field">
            <span className="meta">GST %</span>
            <input className="input" type="number" min={0} max={40} value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))} />
          </label>
        </div>
        <label className="admin-toggle">
          <input type="checkbox" checked={grantAccess} onChange={(e) => setGrantAccess(e.target.checked)} />
          <span>Grant app access when this bill is paid</span>
        </label>
        <p className="meta">
          {selected.label} · GST {preview.gstRate}% · total {formatInrFromPaise(preview.totalPaise)}
        </p>
        <div className="admin-top-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Issue bill
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={(ev) => void onCreate(ev, false)}>
            Save draft
          </button>
        </div>
      </form>

      {!invoices ? (
        <div className="admin-skeleton" />
      ) : !invoices.length ? (
        <p className="admin-empty">No bills yet. Issue a workshop or counselling invoice above.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Customer</th>
                <th>Item</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <strong>{invoice.number}</strong>
                  </td>
                  <td>
                    {invoice.customerName}
                    <br />
                    <span className="meta">{invoice.customerEmail}</span>
                  </td>
                  <td>
                    {invoice.label}
                    {invoice.qty > 1 ? ` × ${invoice.qty}` : ""}
                  </td>
                  <td className="num">{invoice.totalLabel}</td>
                  <td>
                    <span className="admin-pill">{invoice.status}</span>
                  </td>
                  <td className="admin-row-actions">
                    {invoice.status === "draft" ? (
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void act(invoice.id, "issue")}>
                        Issue
                      </button>
                    ) : null}
                    {invoice.paymentUrl ? (
                      <button type="button" className="btn btn-ghost" onClick={() => void copyLink(invoice.paymentUrl!)}>
                        Copy link
                      </button>
                    ) : null}
                    {invoice.status === "issued" || invoice.status === "overdue" || invoice.status === "draft" ? (
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void act(invoice.id, "record-payment")}>
                        Record paid
                      </button>
                    ) : null}
                    {invoice.status !== "paid" && invoice.status !== "cancelled" ? (
                      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void act(invoice.id, "cancel")}>
                        Cancel
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-ghost" onClick={() => setPrintInvoice(invoice)}>
                      Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="admin-card admin-bill-form" onSubmit={(ev) => void saveSeller(ev)}>
        <h3 className="admin-h2">Seller details on the bill</h3>
        <div className="form-grid">
          <label className="admin-field">
            <span className="meta">Legal name</span>
            <input className="input" value={settings.legalName} onChange={(e) => setSettings({ ...settings, legalName: e.target.value })} />
          </label>
          <label className="admin-field">
            <span className="meta">GSTIN</span>
            <input className="input" value={settings.gstin} onChange={(e) => setSettings({ ...settings, gstin: e.target.value })} />
          </label>
          <label className="admin-field">
            <span className="meta">Address</span>
            <input className="input" value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="btn btn-secondary">
          Save seller details
        </button>
      </form>
    </section>
  );
}
