"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { INVOICE_SKUS, type InvoiceSku } from "@/lib/billing/catalog";
import {
  formatInrFromPaise,
  invoiceTotals,
  rupeesToPaise,
  settleInvoiceLines,
  type InvoiceLine,
} from "@/lib/billing/invoices";

type AccountOption = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  organisation?: string | null;
};

type PresentedLine = {
  sku: string;
  label: string;
  qty: number;
  unitAmountPaise: number;
  gstRate: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
};

export type PresentedInvoice = {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  organisation: string | null;
  lines: PresentedLine[];
  sku: string | null;
  label: string;
  qty: number;
  unitAmountPaise: number;
  discountPaise?: number;
  promoCode?: string | null;
  gstRate: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  status: string;
  paymentUrl: string | null;
  grantAccessOnPay: boolean;
  kind?: "sale" | "complimentary";
  sourceLabel?: string;
  documentTitle?: string;
  countsTowardRevenue?: boolean;
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

type DraftLine = {
  key: string;
  sku: InvoiceSku;
  label: string;
  qty: number;
  unitRupees: string;
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

function newDraftLine(catalog: typeof INVOICE_SKUS, gstRate: number, sku: InvoiceSku = "workshop"): DraftLine {
  const item = catalog.find((row) => row.sku === sku) ?? catalog[0];
  return {
    key: `line_${Math.random().toString(36).slice(2, 10)}`,
    sku: item.sku,
    label: "",
    qty: 1,
    unitRupees: String(item.unitAmountPaise / 100),
    gstRate,
  };
}

function priceDraftLines(drafts: DraftLine[], complimentary: boolean, discountRupees: string) {
  if (complimentary) {
    return settleInvoiceLines(
      drafts.map((draft) => ({
        sku: draft.sku,
        label: draft.label.trim() || draft.sku,
        qty: Math.max(1, draft.qty),
        unitAmountPaise: 0,
        gstRate: 0,
        subtotalPaise: 0,
        gstPaise: 0,
        totalPaise: 0,
      })),
      0,
    );
  }
  const priced: InvoiceLine[] = drafts.map((draft) => {
    const item = INVOICE_SKUS.find((row) => row.sku === draft.sku);
    const totals = invoiceTotals(rupeesToPaise(Number(draft.unitRupees) || 0), draft.qty, draft.gstRate);
    return {
      sku: draft.sku,
      label: draft.label.trim() || item?.label || draft.sku,
      unitAmountPaise: rupeesToPaise(Number(draft.unitRupees) || 0),
      ...totals,
    };
  });
  return settleInvoiceLines(priced, rupeesToPaise(Number(discountRupees) || 0));
}

export type BillingSubView = "bills" | "new" | "promos" | "seller";

export function BillingModule({
  accounts,
  ensureAccounts,
  onChanged,
  view = "bills",
  onNavigate,
}: {
  accounts: AccountOption[] | null;
  ensureAccounts: () => void;
  onChanged: () => void;
  view?: BillingSubView;
  onNavigate?: (view: BillingSubView) => void;
}) {
  const lineIdPrefix = useId();
  const [invoices, setInvoices] = useState<PresentedInvoice[] | null>(null);
  const [catalog, setCatalog] = useState(INVOICE_SKUS);
  const [settings, setSettings] = useState<SellerSettings>({
    legalName: "Lokutara",
    gstin: "",
    address: "",
    gstRate: 18,
  });
  const [error, setError] = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<PresentedInvoice | null>(null);
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [supplyState, setSupplyState] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [newDraftLine(INVOICE_SKUS, 18)]);
  const [grantAccess, setGrantAccess] = useState(false);
  const [complimentary, setComplimentary] = useState(false);
  const [discountRupees, setDiscountRupees] = useState("0");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [billStatus, setBillStatus] = useState("all");
  const [billsPage, setBillsPage] = useState(1);
  const BILLS_PER_PAGE = 10;

  const filteredInvoices = (invoices || []).filter((invoice) => {
    const q = invoiceQuery.trim().toLowerCase();
    if (
      q &&
      !`${invoice.number} ${invoice.customerName} ${invoice.customerEmail} ${invoice.label}`.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (billStatus === "complimentary") return invoice.kind === "complimentary";
    if (billStatus !== "all" && invoice.status !== billStatus) return false;
    return true;
  });
  const billPages = Math.max(1, Math.ceil(filteredInvoices.length / BILLS_PER_PAGE));
  const safeBillsPage = Math.min(billsPage, billPages);
  const visibleInvoices = filteredInvoices.slice((safeBillsPage - 1) * BILLS_PER_PAGE, safeBillsPage * BILLS_PER_PAGE);
  const [promos, setPromos] = useState<Array<{
    code: string;
    kind: string;
    value: number;
    valueLabel: string;
    maxDiscountRupees: number | null;
    maxUses: number | null;
    usedCount: number;
    firstTimeOnly: boolean;
    active: boolean;
    expiresAt: string | null;
    note: string | null;
  }> | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoKind, setPromoKind] = useState<"percent" | "flat">("percent");
  const [promoValue, setPromoValue] = useState("10");
  const [promoMaxDiscount, setPromoMaxDiscount] = useState("");
  const [promoMaxUses, setPromoMaxUses] = useState("");
  const [promoFirstTime, setPromoFirstTime] = useState(true);
  const [promoExpiry, setPromoExpiry] = useState("");

  const preview = useMemo(
    () => priceDraftLines(lines, complimentary, discountRupees),
    [lines, complimentary, discountRupees],
  );
  const grossTaxable = preview.subtotalPaise + preview.discountPaise;

  async function load() {
    await loadInvoices();
    await loadPromos();
  }

  async function loadInvoices() {
    const { res, body } = await fetchJson("/api/admin/invoices");
    if (!res.ok) {
      setError(body.message || "Could not load invoices");
      return;
    }
    setInvoices(body.invoices || []);
    if (body.catalog) setCatalog(body.catalog);
    if (body.settings) {
      setSettings(body.settings);
      const rate = Number(body.settings.gstRate) || 18;
      setLines((prev) => prev.map((line) => ({ ...line, gstRate: line.gstRate || rate })));
    }
  }

  async function loadPromos() {
    const promosRes = await fetchJson("/api/admin/promos");
    if (promosRes.res.ok) setPromos(promosRes.body.promos || []);
  }

  async function loadSeller() {
    const { res, body } = await fetchJson("/api/admin/billing");
    if (!res.ok) {
      setError(body.message || "Could not load seller details");
      return;
    }
    if (body.settings) setSettings(body.settings);
  }

  useEffect(() => {
    if (view === "bills" || view === "new") {
      if (view === "new") ensureAccounts();
      void loadInvoices();
    } else if (view === "promos") {
      void loadPromos();
    } else if (view === "seller") {
      void loadSeller();
    }
    // Load only what the active view needs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function pickAccount(id: string) {
    setAccountId(id);
    const account = (accounts || []).find((row) => row.id === id);
    if (!account) return;
    setName(account.name);
    setEmail(account.email);
    setPhone(account.phone || "");
    setOrganisation(account.organisation || "");
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.sku) {
          const item = catalog.find((row) => row.sku === patch.sku);
          if (item && !item.custom) next.unitRupees = String(item.unitAmountPaise / 100);
          if (!line.label.trim() && item) next.label = "";
          if (patch.sku === "app_access") setGrantAccess(true);
        }
        return next;
      }),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, newDraftLine(catalog, settings.gstRate || 18)]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setOrganisation("");
    setCustomerGstin("");
    setSupplyState("");
    setAccountId("");
    setLines([newDraftLine(catalog, settings.gstRate || 18)]);
    setDiscountRupees("0");
    setNotes("");
    setShowNote(false);
    setComplimentary(false);
    setGrantAccess(false);
    setBillsPage(1);
  }

  async function onCreate(ev: FormEvent, issue: boolean) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    if (complimentary && !accountId) {
      setBusy(false);
      setError("Choose an existing person to give complimentary access");
      return;
    }
    const first = lines[0];
    const { res, body } = await fetchJson("/api/admin/invoices", {
      method: "POST",
      body: JSON.stringify(
        complimentary
          ? {
              accountId,
              sku: first?.sku || "app_access",
              complimentary: true,
              label: `${(first?.label.trim() || catalog.find((row) => row.sku === first?.sku)?.label || "Access")} · Given by Admin`,
            }
          : {
              accountId: accountId || undefined,
              name,
              email,
              phone,
              organisation,
              customerGstin: customerGstin || undefined,
              supplyState: supplyState || undefined,
              lines: lines.map((line) => ({
                sku: line.sku,
                label: line.label.trim() || undefined,
                qty: line.qty,
                unitAmountRupees: Number(line.unitRupees),
                gstRate: line.gstRate,
              })),
              discountRupees: Number(discountRupees) || 0,
              dueAt: dueAt || undefined,
              notes: notes.trim() || undefined,
              grantAccessOnPay: grantAccess,
              issue,
            },
      ),
    });
    setBusy(false);
    if (!res.ok) {
      setError(body.message || "Could not create invoice");
      return;
    }
    resetForm();
    await load();
    onChanged();
    onNavigate?.("bills");
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

  async function createPromo(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const { res, body } = await fetchJson("/api/admin/promos", {
      method: "POST",
      body: JSON.stringify({
        code: promoCode,
        kind: promoKind,
        value: Number(promoValue),
        maxDiscountRupees: promoKind === "percent" && promoMaxDiscount !== "" ? Number(promoMaxDiscount) : null,
        maxUses: promoMaxUses === "" ? null : Number(promoMaxUses),
        firstTimeOnly: promoFirstTime,
        expiresAt: promoExpiry || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(body.message || "Could not create promo");
      return;
    }
    setPromoCode("");
    setPromoValue("10");
    setPromoMaxDiscount("");
    setPromoMaxUses("");
    setPromoExpiry("");
    await load();
    onChanged();
  }

  async function togglePromo(code: string) {
    const { res, body } = await fetchJson(`/api/admin/promos/${code}/toggle`, { method: "POST" });
    if (!res.ok) {
      setError(body.message || "Could not update promo");
      return;
    }
    setPromos((prev) => (prev || []).map((row) => (row.code === code ? body.promo : row)));
  }

  async function deletePromo(code: string) {
    if (!window.confirm(`Delete code ${code}? Invoices already issued keep their discount.`)) return;
    const { res, body } = await fetchJson(`/api/admin/promos/${code}`, { method: "DELETE" });
    if (!res.ok) {
      setError(body.message || "Could not delete promo");
      return;
    }
    setPromos((prev) => (prev || []).filter((row) => row.code !== code));
  }

  if (printInvoice) {
    const printLines = printInvoice.lines?.length
      ? printInvoice.lines
      : [
          {
            sku: printInvoice.sku || "custom",
            label: printInvoice.label,
            qty: printInvoice.qty,
            unitAmountPaise: printInvoice.unitAmountPaise,
            gstRate: printInvoice.gstRate,
            subtotalPaise: printInvoice.subtotalPaise,
            gstPaise: printInvoice.gstPaise,
            totalPaise: printInvoice.totalPaise,
          },
        ];
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
            <p className="eyebrow">{printInvoice.documentTitle || "Tax invoice"}</p>
            <h2>{settings.legalName || "Lokutara"}</h2>
            {settings.address ? <p className="meta">{settings.address}</p> : null}
            {settings.gstin && printInvoice.kind !== "complimentary" ? <p className="meta">GSTIN {settings.gstin}</p> : null}
          </header>
          <p>
            <strong>{printInvoice.number}</strong>
            <span className="meta"> · {printInvoice.status}</span>
          </p>
          {printInvoice.kind === "complimentary" ? (
            <p className="admin-flag" role="note">
              <strong>{printInvoice.sourceLabel || "Given by Admin"}</strong>
              <span>₹0 complimentary record. Not a tax invoice and not counted as revenue.</span>
            </p>
          ) : null}
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
                <th>#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Taxable</th>
                <th>GST</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {printLines.map((line, index) => (
                <tr key={`${line.sku}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{line.label}</td>
                  <td>{line.qty}</td>
                  <td className="num">{printInvoice.kind === "complimentary" ? "₹0" : formatInrFromPaise(line.unitAmountPaise)}</td>
                  <td className="num">{printInvoice.kind === "complimentary" ? "₹0" : formatInrFromPaise(line.subtotalPaise)}</td>
                  <td className="num">{printInvoice.kind === "complimentary" ? "—" : formatInrFromPaise(line.gstPaise)}</td>
                  <td className="num">{printInvoice.kind === "complimentary" ? "₹0" : formatInrFromPaise(line.totalPaise)}</td>
                </tr>
              ))}
              {printInvoice.kind === "complimentary" ? null : (
                <>
                  {(printInvoice.discountPaise || 0) > 0 ? (
                    <tr>
                      <td colSpan={6}>Discount</td>
                      <td className="num">−{formatInrFromPaise(printInvoice.discountPaise || 0)}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td colSpan={6}>GST</td>
                    <td className="num">{formatInrFromPaise(printInvoice.gstPaise)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td colSpan={6}>
                  <strong>Total</strong>
                </td>
                <td className="num">
                  <strong>{printInvoice.totalLabel}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          {printInvoice.notes ? <p className="meta">{printInvoice.notes}</p> : null}
        </article>
      </section>
    );
  }

  return (
    <section className="admin-panel" data-testid="admin-billing">
      <div className="admin-card-head">
        <h2 className="admin-h2">Billing</h2>
        <a className="btn btn-secondary" href="/api/admin/invoices/export.csv">
          Export GST CSV
        </a>
      </div>
      <nav className="admin-subnav" aria-label="Billing sections">
        {(
          [
            ["bills", "Bills"],
            ["new", "New bill"],
            ["promos", "Promos"],
            ["seller", "Seller"],
          ] as Array<[BillingSubView, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "is-on" : undefined}
            onClick={() => onNavigate?.(id)}
            aria-current={view === id ? "page" : undefined}
          >
            {label}
          </button>
        ))}
      </nav>
      {error ? <p className="admin-error">{error}</p> : null}

      {view === "new" ? (
        <form className="admin-card bill-editor" onSubmit={(ev) => void onCreate(ev, true)}>
          <div className="bill-editor-top">
            <div>
              <p className="eyebrow">Customer invoice</p>
              <h3 className="admin-h2">New bill</h3>
            </div>
            <div className="bill-editor-actions">
              <span className="admin-pill">Draft</span>
              {complimentary ? (
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Give complimentary record
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={(ev) => void onCreate(ev, false)}>
                    Save draft
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? "Working…" : "Confirm"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bill-editor-grid">
            <div className="bill-customer">
              <label className="admin-field">
                <span className="meta">Customer</span>
                <select
                  className="input"
                  value={accountId}
                  required={complimentary}
                  onChange={(e) => pickAccount(e.target.value)}
                >
                  <option value="">New customer</option>
                  {(accounts || []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.email}
                    </option>
                  ))}
                </select>
              </label>
              <div className="bill-address">
                <strong>{name || "—"}</strong>
                {[email, phone, organisation].filter(Boolean).join(" · ") || <span className="meta">No details yet</span>}
              </div>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <label className="admin-field">
                  <span className="meta">Name</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required={!complimentary} />
                </label>
                <label className="admin-field">
                  <span className="meta">Email</span>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!complimentary} />
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
                  <span className="meta">Customer GSTIN (optional)</span>
                  <input
                    className="input"
                    value={customerGstin}
                    onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                    placeholder="29ABCDE1234F1Z5"
                    maxLength={15}
                  />
                </label>
                <label className="admin-field">
                  <span className="meta">Place of supply (optional)</span>
                  <input
                    className="input"
                    value={supplyState}
                    onChange={(e) => setSupplyState(e.target.value)}
                    placeholder="Karnataka"
                  />
                </label>
              </div>
            </div>
            <dl className="bill-meta">
              <div>
                <dt>Invoice date</dt>
                <dd>{new Date().toLocaleDateString("en-IN")}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>
                  <input
                    className="input"
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    aria-label="Due date"
                  />
                </dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>INR</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className="admin-pill">Draft</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="bill-lines">
            <div className="bill-lines-head">
              <h4 className="bill-lines-title">Services</h4>
              {complimentary ? null : (
                <button type="button" className="btn btn-secondary" onClick={addLine}>
                  Add service
                </button>
              )}
            </div>
            <div className="bill-line-list" role="list">
              {lines.map((line, index) => {
                const catalogItem = catalog.find((row) => row.sku === line.sku);
                const settled = preview.lines[index];
                return (
                  <div className="bill-line-row" role="listitem" key={line.key}>
                    <div className="bill-line-index" aria-hidden>
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="bill-line-fields">
                      <label className="admin-field">
                        <span className="meta">Product</span>
                        <select
                          className="input"
                          value={line.sku}
                          onChange={(e) => updateLine(line.key, { sku: e.target.value as InvoiceSku })}
                          aria-label={`Product for line ${index + 1}`}
                          id={`${lineIdPrefix}-sku-${line.key}`}
                        >
                          {catalog.map((item) => (
                            <option key={item.sku} value={item.sku}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-field bill-line-label">
                        <span className="meta">Description on bill</span>
                        <input
                          className="input"
                          value={line.label}
                          onChange={(e) => updateLine(line.key, { label: e.target.value })}
                          placeholder={catalogItem?.label}
                          aria-label={`Description for line ${index + 1}`}
                        />
                      </label>
                      <label className="admin-field">
                        <span className="meta">Qty</span>
                        <input
                          className="input bill-num"
                          type="number"
                          min={1}
                          max={50}
                          value={line.qty}
                          onChange={(e) => updateLine(line.key, { qty: Number(e.target.value) || 1 })}
                          aria-label={`Quantity for line ${index + 1}`}
                        />
                      </label>
                      <label className="admin-field">
                        <span className="meta">Rate ₹</span>
                        <input
                          className="input bill-num"
                          type="number"
                          min={complimentary ? 0 : 1}
                          value={complimentary ? "0" : line.unitRupees}
                          disabled={complimentary}
                          onChange={(e) => updateLine(line.key, { unitRupees: e.target.value })}
                          aria-label={`Unit price for line ${index + 1}`}
                        />
                      </label>
                      <label className="admin-field">
                        <span className="meta">GST %</span>
                        <input
                          className="input bill-num"
                          type="number"
                          min={0}
                          max={40}
                          value={complimentary ? 0 : line.gstRate}
                          disabled={complimentary}
                          onChange={(e) => updateLine(line.key, { gstRate: Number(e.target.value) || 0 })}
                          aria-label={`GST for line ${index + 1}`}
                        />
                      </label>
                      <div className="bill-line-amount">
                        <span className="meta">Amount</span>
                        <strong className="num">
                          {complimentary ? "₹0" : formatInrFromPaise(settled?.totalPaise ?? 0)}
                        </strong>
                      </div>
                    </div>
                    {lines.length > 1 && !complimentary ? (
                      <button
                        type="button"
                        className="admin-text-btn bill-line-remove"
                        onClick={() => removeLine(line.key)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {showNote || notes ? (
              <label className="admin-field" style={{ marginTop: 12 }}>
                <span className="meta">Note on the bill</span>
                <textarea
                  className="input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment terms, thank-you note…"
                />
              </label>
            ) : (
              <button type="button" className="admin-text-btn" style={{ marginTop: 12 }} onClick={() => setShowNote(true)}>
                Add a note
              </button>
            )}
          </div>

          <div className="bill-totals">
            <div className="checkout-row">
              <span>Untaxed amount</span>
              <strong className="num">{complimentary ? "₹0" : formatInrFromPaise(grossTaxable)}</strong>
            </div>
            {preview.discountPaise > 0 ? (
              <div className="checkout-row is-discount">
                <span>Discount</span>
                <strong className="num">−{formatInrFromPaise(preview.discountPaise)}</strong>
              </div>
            ) : null}
            {complimentary ? null : (
              <label className="admin-field bill-discount">
                <span className="meta">Discount ₹ (pre-GST)</span>
                <input
                  className="input bill-num"
                  type="number"
                  min={0}
                  value={discountRupees}
                  onChange={(e) => setDiscountRupees(e.target.value)}
                />
              </label>
            )}
            <div className="checkout-row">
              <span>GST</span>
              <strong className="num">{formatInrFromPaise(preview.gstPaise)}</strong>
            </div>
            <div className="checkout-row is-total">
              <span>Total</span>
              <strong className="num">
                {complimentary ? "₹0 · Given by Admin" : formatInrFromPaise(preview.totalPaise)}
              </strong>
            </div>
          </div>

          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={complimentary}
              onChange={(e) => {
                setComplimentary(e.target.checked);
                if (e.target.checked) {
                  setLines((prev) => prev.slice(0, 1));
                  setGrantAccess(lines[0]?.sku === "app_access");
                }
              }}
            />
            <span>Complimentary · Given by Admin (₹0, not revenue)</span>
          </label>
          {complimentary ? null : (
            <label className="admin-toggle">
              <input type="checkbox" checked={grantAccess} onChange={(e) => setGrantAccess(e.target.checked)} />
              <span>Grant app access when this bill is paid</span>
            </label>
          )}
        </form>
      ) : null}

      {view === "bills" && !invoices ? <div className="admin-skeleton" /> : null}
      {view === "bills" && invoices && !invoices.length ? (
        <p className="admin-empty">No bills yet. Pick New bill above to issue one.</p>
      ) : null}
      {view === "bills" && invoices && invoices.length > 0 ? (
        <>
          <div className="admin-card-head" id="billing-bills" style={{ marginTop: 8 }}>
            <h3 className="admin-h2" style={{ fontSize: 20 }}>
              Bills ({filteredInvoices.length})
            </h3>
          </div>
          <div className="admin-moderation-tools admin-lead-filters">
            <input
              type="search"
              className="input"
              placeholder="Search bills by number, customer, item"
              value={invoiceQuery}
              onChange={(e) => {
                setInvoiceQuery(e.target.value);
                setBillsPage(1);
              }}
              aria-label="Search invoices"
            />
            <select
              className="input"
              value={billStatus}
              onChange={(e) => {
                setBillStatus(e.target.value);
                setBillsPage(1);
              }}
              aria-label="Filter bills by status"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="complimentary">Complimentary</option>
            </select>
          </div>
          {!visibleInvoices.length ? (
            <p className="admin-empty">No bills match. Clear the search or status filter.</p>
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
                  {visibleInvoices.map((invoice) => (
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
                        {invoice.lines?.length > 1 ? (
                          <>
                            <br />
                            <span className="meta">{invoice.lines.length} lines</span>
                          </>
                        ) : invoice.qty > 1 ? (
                          ` × ${invoice.qty}`
                        ) : (
                          ""
                        )}
                        {invoice.promoCode ? (
                          <>
                            <br />
                            <span className="meta">Code {invoice.promoCode}</span>
                          </>
                        ) : null}
                      </td>
                      <td className="num">{invoice.totalLabel}</td>
                      <td>
                        <span className="admin-pill">{invoice.status}</span>
                        {invoice.kind === "complimentary" ? (
                          <>
                            <br />
                            <span className="meta">{invoice.sourceLabel || "Given by Admin"}</span>
                          </>
                        ) : null}
                      </td>
                      <td className="admin-row-actions">
                        {invoice.kind === "complimentary" ? null : invoice.status === "draft" ? (
                          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void act(invoice.id, "issue")}>
                            Issue
                          </button>
                        ) : null}
                        {invoice.paymentUrl ? (
                          <button type="button" className="btn btn-ghost" onClick={() => void copyLink(invoice.paymentUrl!)}>
                            Copy link
                          </button>
                        ) : null}
                        {invoice.kind === "complimentary" ? null : invoice.status === "issued" ||
                          invoice.status === "overdue" ||
                          invoice.status === "draft" ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy}
                            onClick={() => void act(invoice.id, "record-payment")}
                          >
                            Record paid
                          </button>
                        ) : null}
                        {invoice.kind === "complimentary" || invoice.status === "paid" || invoice.status === "cancelled" ? null : (
                          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void act(invoice.id, "cancel")}>
                            Cancel
                          </button>
                        )}
                        <button type="button" className="btn btn-ghost" onClick={() => setPrintInvoice(invoice)}>
                          Print
                        </button>
                        <a className="btn btn-ghost" href={`/api/admin/invoices/${invoice.id}/pdf`}>
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {billPages > 1 ? (
            <div className="admin-pagination">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={safeBillsPage <= 1}
                onClick={() => setBillsPage(safeBillsPage - 1)}
              >
                ← Prev
              </button>
              <span className="meta">
                Page {safeBillsPage} of {billPages} · {filteredInvoices.length} bills
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={safeBillsPage >= billPages}
                onClick={() => setBillsPage(safeBillsPage + 1)}
              >
                Next →
              </button>
            </div>
          ) : filteredInvoices.length > 0 ? (
            <p className="meta" style={{ textAlign: "center", marginTop: 12 }}>
              Showing all {filteredInvoices.length} bills
            </p>
          ) : null}
        </>
      ) : null}

      {view === "promos" ? (
        <form className="admin-card admin-bill-form" id="billing-promos" onSubmit={(ev) => void createPromo(ev)}>
          <h3 className="admin-h2">Promo codes</h3>
          <p className="lead admin-hint">
            Percent or flat offers for checkout — first-time-only works as the welcome offer. Usage counts when a bill is created.
          </p>
          <div className="form-grid">
            <label className="admin-field">
              <span className="meta">Code</span>
              <input
                className="input"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                required
                minLength={3}
                placeholder="WELCOME10"
              />
            </label>
            <label className="admin-field">
              <span className="meta">Type</span>
              <select className="input" value={promoKind} onChange={(e) => setPromoKind(e.target.value as "percent" | "flat")}>
                <option value="percent">Percent %</option>
                <option value="flat">Flat ₹</option>
              </select>
            </label>
            <label className="admin-field">
              <span className="meta">{promoKind === "percent" ? "Percent (1–100)" : "Rupees off"}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={promoKind === "percent" ? 100 : undefined}
                value={promoValue}
                onChange={(e) => setPromoValue(e.target.value)}
                required
              />
            </label>
            {promoKind === "percent" ? (
              <label className="admin-field">
                <span className="meta">Max ₹ off (blank = no cap)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={promoMaxDiscount}
                  onChange={(e) => setPromoMaxDiscount(e.target.value)}
                  placeholder="500"
                />
              </label>
            ) : null}
            <label className="admin-field">
              <span className="meta">Max uses (blank = unlimited)</span>
              <input className="input" type="number" min={1} value={promoMaxUses} onChange={(e) => setPromoMaxUses(e.target.value)} />
            </label>
            <label className="admin-field">
              <span className="meta">Expires (optional)</span>
              <input className="input" type="date" value={promoExpiry} onChange={(e) => setPromoExpiry(e.target.value)} />
            </label>
          </div>
          <label className="admin-toggle">
            <input type="checkbox" checked={promoFirstTime} onChange={(e) => setPromoFirstTime(e.target.checked)} />
            <span>First-time buyers only (welcome offer)</span>
          </label>
          <div className="admin-top-actions" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Create code
            </button>
          </div>
        </form>
      ) : null}

      {view === "promos" && promos && promos.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Offer</th>
                <th>Uses</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => (
                <tr key={promo.code}>
                  <td>
                    <strong>{promo.code}</strong>
                    {promo.firstTimeOnly ? (
                      <>
                        <br />
                        <span className="meta">First-time only</span>
                      </>
                    ) : null}
                  </td>
                  <td>{promo.valueLabel}</td>
                  <td className="num">
                    {promo.usedCount}
                    {promo.maxUses != null ? ` / ${promo.maxUses}` : ""}
                  </td>
                  <td>
                    <span className="admin-pill">{promo.active ? "active" : "paused"}</span>
                  </td>
                  <td className="admin-row-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => void togglePromo(promo.code)}>
                      {promo.active ? "Pause" : "Resume"}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => void deletePromo(promo.code)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {view === "seller" ? (
        <form className="admin-card admin-bill-form" id="billing-seller" onSubmit={(ev) => void saveSeller(ev)}>
          <h3 className="admin-h2">Seller details on the bill</h3>
          <div className="form-grid">
            <label className="admin-field">
              <span className="meta">Legal name</span>
              <input
                className="input"
                value={settings.legalName}
                onChange={(e) => setSettings({ ...settings, legalName: e.target.value })}
              />
            </label>
            <label className="admin-field">
              <span className="meta">GSTIN</span>
              <input className="input" value={settings.gstin} onChange={(e) => setSettings({ ...settings, gstin: e.target.value })} />
            </label>
            <label className="admin-field">
              <span className="meta">Address</span>
              <input
                className="input"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </label>
          </div>
          <button type="submit" className="btn btn-secondary">
            Save seller details
          </button>
        </form>
      ) : null}
    </section>
  );
}
