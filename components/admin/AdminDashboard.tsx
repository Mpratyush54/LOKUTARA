"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { MetricsWindow } from "@/lib/tracking/metrics";
import type { ExperimentKey, ExperimentVariant } from "@/lib/tracking/experiment";
import type { AccessSnapshot, BillingSettings } from "@/lib/access/billing";
import type { DayPoint } from "@/lib/charts/series";
import type { CommerceSnapshot } from "@/lib/billing/commerce";
import { formatInrFromPaise } from "@/lib/billing/invoices";
import { LOCAL_ASSESSMENTS } from "@/lib/product/workspace";
import { FunnelBars, TrendChart } from "@/components/charts/TrendChart";
import { BillingModule } from "@/components/admin/BillingModule";

type AdminLead = {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  organisation: string | null;
  createdAt: string;
  redacted: boolean;
};

type ExperimentRow = {
  key: ExperimentKey;
  label: string;
  description: string;
  enabled: boolean;
  weights: { control: number; variant: number };
  forcedVariant: ExperimentVariant | null;
  updatedAt: string | null;
  stats: {
    variants: Array<{ variant: ExperimentVariant; assignments: number; ctaClicks: number; ctr: number }>;
  };
};

type AccountRow = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  age?: number | null;
  city?: string | null;
  organisation?: string | null;
  seats: number;
  createdAt: string;
  access: AccessSnapshot;
  communityRole?: "student" | "specialist" | "admin";
};

type OverviewPayload = {
  metrics: MetricsWindow;
  series: DayPoint[];
  commerce: CommerceSnapshot;
  razorpayConfigured?: boolean;
  accounts: { none: number; trial: number; paid: number; expired: number; total: number };
  workspace: { runs: number; threads: number; replies: number };
  recent: {
    leads: AdminLead[];
    people: AccountRow[];
    runs: Array<{ id: string; accountName: string; assessmentId: string; score: number; createdAt: string }>;
    threads: Array<{
      id: string;
      title: string;
      authorName: string;
      answerCount: number;
      views: number;
      createdAt?: string;
    }>;
    invoices?: Array<{
      id: string;
      number: string;
      customerName: string;
      label: string;
      status: string;
      totalLabel: string;
      createdAt: string;
    }>;
  };
};

type Tab = "overview" | "leads" | "assessments" | "community" | "trials" | "billing" | "experiments";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

function momLabel(pct: number | null): string {
  if (pct == null) return "no sales last month";
  const n = Math.round(pct * 100);
  return `${n >= 0 ? "+" : ""}${n}% vs last month`;
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function assessmentTitle(id: string) {
  return LOCAL_ASSESSMENTS.find((item) => item.id === id)?.title ?? id;
}

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

export function AdminDashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailRequired, setEmailRequired] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [leads, setLeads] = useState<AdminLead[] | null>(null);
  const [workspace, setWorkspace] = useState<{
    runs: Array<{ id: string; accountName: string; assessmentId: string; score: number; createdAt: string }>;
    threads: Array<{ id: string; title: string; authorName: string; tags: string[]; views: number; answerCount: number }>;
  } | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [billing, setBilling] = useState<BillingSettings | null>(null);
  const [experiments, setExperiments] = useState<ExperimentRow[] | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState(14);
  const [billingTick, setBillingTick] = useState(0);

  const checkSession = useCallback(async () => {
    const { res, body } = await adminFetch("/api/admin/session");
    if (res.status === 503 || body.configured === false) {
      setConfigured(false);
      setAuthed(false);
      return;
    }
    setConfigured(true);
    setEmailRequired(body.emailRequired !== false);
    setAuthed(Boolean(body.authenticated));
  }, []);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setError(null);
    const { res, body } = await adminFetch("/api/admin/overview");
    setOverviewLoading(false);
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (!res.ok) {
      setError(body.message || "Could not load overview");
      return;
    }
    setOverview(body as OverviewPayload);
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (authed) void loadOverview();
  }, [authed, loadOverview]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "leads" && leads === null) {
      void (async () => {
        const { res, body } = await adminFetch("/api/admin/leads?limit=50");
        if (res.ok) setLeads(body.leads || []);
      })();
    }
    if ((tab === "assessments" || tab === "community") && workspace === null) {
      void (async () => {
        const { res, body } = await adminFetch("/api/admin/workspace");
        if (res.ok) setWorkspace(body);
      })();
    }
    if ((tab === "trials" || tab === "billing") && (accounts === null || billing === null)) {
      void (async () => {
        const [a, b] = await Promise.all([adminFetch("/api/admin/accounts"), adminFetch("/api/admin/billing")]);
        if (a.res.ok) setAccounts(a.body.accounts || []);
        if (b.res.ok) {
          setBilling(b.body.settings);
          setTrialDays(b.body.settings?.defaultTrialDays ?? 14);
        }
      })();
    }
    if (tab === "experiments" && experiments === null) {
      void (async () => {
        const { res, body } = await adminFetch("/api/admin/experiments");
        if (res.ok) setExperiments(body.experiments || []);
      })();
    }
  }, [authed, tab, leads, workspace, accounts, billing, experiments]);

  async function onLogin(ev: FormEvent) {
    ev.preventDefault();
    setLoginError(null);
    const { res, body } = await adminFetch("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password }),
    });
    if (!res.ok) {
      setLoginError(body.message || "Invalid email or password");
      return;
    }
    setPassword("");
    setAuthed(true);
  }

  async function onLogout() {
    await adminFetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setOverview(null);
    setOverviewLoading(true);
    setLeads(null);
    setWorkspace(null);
    setAccounts(null);
    setBilling(null);
    setExperiments(null);
  }

  async function saveExperiment(row: ExperimentRow, patch: Partial<ExperimentRow>) {
    setSavingKey(row.key);
    setError(null);
    try {
      const { res, body } = await adminFetch(`/api/admin/experiments/${row.key}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: patch.enabled ?? row.enabled,
          weights: patch.weights ?? row.weights,
          forcedVariant: patch.forcedVariant !== undefined ? patch.forcedVariant : row.forcedVariant,
        }),
      });
      if (!res.ok) throw new Error(body.message || "Could not save experiment");
      setExperiments((prev) => (prev || []).map((item) => (item.key === row.key ? { ...item, ...body.experiment } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveBilling(next: Partial<BillingSettings>) {
    if (!billing) return;
    const { res, body } = await adminFetch("/api/admin/billing", {
      method: "PUT",
      body: JSON.stringify({ ...billing, ...next }),
    });
    if (res.ok) setBilling(body.settings);
  }

  async function setAccess(id: string, action: "trial" | "paid" | "revoke") {
    const { res, body } = await adminFetch(`/api/admin/accounts/${id}/access`, {
      method: "POST",
      body: JSON.stringify({ action, days: trialDays }),
    });
    if (!res.ok) {
      setError(body.message || "Could not update access");
      return;
    }
    setAccounts((prev) => (prev || []).map((row) => (row.id === id ? body.account : row)));
    void loadOverview();
  }

  async function setCommunityRole(id: string, communityRole: "student" | "specialist" | "admin") {
    const { res, body } = await adminFetch(`/api/admin/accounts/${id}/access`, {
      method: "POST",
      body: JSON.stringify({ action: "role", communityRole }),
    });
    if (!res.ok) {
      setError(body.message || "Could not update community role");
      return;
    }
    setAccounts((prev) => (prev || []).map((row) => (row.id === id ? body.account : row)));
  }

  if (authed === null) {
    return (
      <main className="admin-shell admin-ops" aria-busy="true" data-testid="admin-skeleton">
        <div className="admin-skeleton-page">
          <div className="admin-skeleton admin-skeleton-title" />
          <div className="admin-stat-grid">
            <div className="admin-skeleton admin-skeleton-stat" />
            <div className="admin-skeleton admin-skeleton-stat" />
            <div className="admin-skeleton admin-skeleton-stat" />
            <div className="admin-skeleton admin-skeleton-stat" />
            <div className="admin-skeleton admin-skeleton-stat" />
            <div className="admin-skeleton admin-skeleton-stat" />
          </div>
          <div className="chart-grid">
            <div className="admin-skeleton admin-skeleton-chart" />
            <div className="admin-skeleton admin-skeleton-chart" />
          </div>
        </div>
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="admin-shell">
        <div className="admin-gate">
          <p className="eyebrow">Lokutara admin</p>
          <h1>Dashboard locked</h1>
          <p className="lead">
            Set <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code> in <code>.env.local</code>, restart{" "}
            <code>npm run dev</code>, then return here.
          </p>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="admin-shell">
        <form className="admin-gate dash-in" onSubmit={onLogin}>
          <p className="eyebrow">Founder ops</p>
          <h1>Lokutara admin</h1>
          <p className="lead">Sign in to see leads, signups, assessment runs, and community activity.</p>
          {emailRequired ? (
            <label className="admin-field">
              <span className="meta">Email</span>
              <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          ) : null}
          <label className="admin-field">
            <span className="meta">Password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {loginError ? <p className="admin-error">{loginError}</p> : null}
          <button type="submit" className="btn btn-primary admin-gate-submit">
            Open console
          </button>
        </form>
      </main>
    );
  }

  const metrics = overview?.metrics;
  const recentPeople = overview?.recent?.people || [];
  const recentLeads = overview?.recent?.leads || [];
  const recentRuns = overview?.recent?.runs || [];
  const recentThreads = overview?.recent?.threads || [];
  const recentInvoices = overview?.recent?.invoices || [];
  const commerce = overview?.commerce;
  const snapshotLine = overview
    ? `${formatInrFromPaise(overview.commerce?.revenueThisMonth || 0)} this month · ${fmt(overview.accounts.total)} people · ${fmt(overview.workspace.runs)} screens`
    : "Leads, signups, screens, bills, and community — one console.";
  const briefTitle = !overview
    ? "Loading live ops"
    : overview.accounts.total === 0
      ? "Waiting on the first signup"
      : `${fmt(overview.accounts.total)} ${overview.accounts.total === 1 ? "person" : "people"} on Lokutara`;
  const briefCopy = !overview || !metrics
    ? "Leads, trials, assessment runs, and community threads land here."
    : metrics.uniqueVisitors === 0 && overview.accounts.total === 0
      ? "No traffic or accounts yet. Public-site views (with analytics on) and /signup appear in this console."
      : `${fmt(metrics.sessions)} sessions in 30 days · ${pct(metrics.funnel.conversionRate)} visitor-to-lead · bounce ${pct(metrics.bounceRate)}.`;

  return (
    <main className="admin-shell admin-ops">
      <header className="admin-top dash-in">
        <div>
          <p className="eyebrow">Founder</p>
          <h1>Admin dashboard</h1>
          <p className="lead">{snapshotLine}</p>
        </div>
        <div className="admin-top-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (tab === "overview") void loadOverview();
              if (tab === "leads") setLeads(null);
              if (tab === "assessments" || tab === "community") setWorkspace(null);
              if (tab === "trials") {
                setAccounts(null);
                setBilling(null);
              }
              if (tab === "billing") {
                setAccounts(null);
                setBillingTick((n) => n + 1);
              }
              if (tab === "experiments") setExperiments(null);
            }}
          >
            Refresh
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Ops sections">
        {(
          [
            ["overview", "Overview"],
            ["leads", overview ? `Leads (${overview.metrics.funnel.leadsSubmitted})` : "Leads"],
            ["assessments", overview ? `Assessments (${overview.workspace.runs})` : "Assessments"],
            ["community", overview ? `Community (${overview.workspace.threads})` : "Community"],
            ["billing", overview ? `Billing (${formatInrFromPaise(overview.commerce?.revenueThisMonth || 0)})` : "Billing"],
            ["trials", overview ? `People (${overview.accounts.total})` : "People"],
            ["experiments", "Experiments"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "is-active" : undefined} onClick={() => setTab(id as Tab)}>
            {label}
          </button>
        ))}
      </nav>

      {error ? <p className="admin-error">{error}</p> : null}

      {tab === "overview" ? (
        <section className="admin-panel" data-testid="admin-overview">
          {overviewLoading && !overview ? (
            <div className="admin-skeleton-page" aria-busy="true">
              <div className="admin-skeleton admin-skeleton-hero" />
              <div className="admin-stat-grid">
                <div className="admin-skeleton admin-skeleton-stat" />
                <div className="admin-skeleton admin-skeleton-stat" />
                <div className="admin-skeleton admin-skeleton-stat" />
                <div className="admin-skeleton admin-skeleton-stat" />
                <div className="admin-skeleton admin-skeleton-stat" />
                <div className="admin-skeleton admin-skeleton-stat" />
              </div>
              <div className="chart-grid">
                <div className="admin-skeleton admin-skeleton-chart" />
                <div className="admin-skeleton admin-skeleton-chart" />
              </div>
            </div>
          ) : null}
          {overview && metrics ? (
            <>
              <section className="admin-brief dash-in">
                <div>
                  <p className="eyebrow">Live snapshot</p>
                  <h2>{briefTitle}</h2>
                  <p>{briefCopy}</p>
                </div>
                <dl className="admin-brief-kpis">
                  <div>
                    <dt>Trial</dt>
                    <dd className="num">{fmt(overview.accounts.trial)}</dd>
                  </div>
                  <div>
                    <dt>Paid</dt>
                    <dd className="num">{fmt(overview.accounts.paid)}</dd>
                  </div>
                  <div>
                    <dt>Expired</dt>
                    <dd className="num">{fmt(overview.accounts.expired)}</dd>
                  </div>
                  <div>
                    <dt>No access</dt>
                    <dd className="num">{fmt(overview.accounts.none)}</dd>
                  </div>
                </dl>
              </section>

              {commerce ? (
                <div className="admin-commerce dash-in delay-1">
                  <article>
                    <p className="meta">Revenue today</p>
                    <p className="admin-big">{formatInrFromPaise(commerce.revenueToday)}</p>
                    <p className="meta">IST calendar day</p>
                  </article>
                  <article>
                    <p className="meta">This month</p>
                    <p className="admin-big">{formatInrFromPaise(commerce.revenueThisMonth)}</p>
                    <p className="meta">{momLabel(commerce.momRevenuePct)}</p>
                  </article>
                  <article>
                    <p className="meta">Last month</p>
                    <p className="admin-big">{formatInrFromPaise(commerce.revenueLastMonth)}</p>
                    <p className="meta">{fmt(commerce.paidThisMonth)} paid bills this month</p>
                  </article>
                  <article>
                    <p className="meta">People this month</p>
                    <p className="admin-big">{fmt(commerce.peopleThisMonth)}</p>
                    <p className="meta">
                      {fmt(commerce.peopleLastMonth)} last month · {fmt(commerce.visitorsThisMonth)} visitors
                    </p>
                  </article>
                  <article>
                    <p className="meta">Outstanding</p>
                    <p className="admin-big">{formatInrFromPaise(commerce.outstandingPaise)}</p>
                    <p className="meta">{fmt(commerce.leadsThisMonth)} leads this month</p>
                  </article>
                </div>
              ) : null}

              {overview.accounts.expired > 0 || overview.accounts.none > 0 || metrics.uniqueVisitors === 0 ? (
                <div className="admin-attention dash-in delay-1">
                  {overview.accounts.expired > 0 ? (
                    <button type="button" className="admin-flag" onClick={() => setTab("trials")}>
                      <strong>{fmt(overview.accounts.expired)} expired</strong>
                      <span>Restore trial or paid access on People.</span>
                    </button>
                  ) : null}
                  {overview.accounts.none > 0 ? (
                    <button type="button" className="admin-flag" onClick={() => setTab("trials")}>
                      <strong>{fmt(overview.accounts.none)} without access</strong>
                      <span>These accounts cannot enter the app yet.</span>
                    </button>
                  ) : null}
                  {metrics.uniqueVisitors === 0 ? (
                    <div className="admin-flag" role="status">
                      <strong>No site visitors in 30 days</strong>
                      <span>Page views on lokutara.in with analytics accepted will fill the funnel.</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="admin-stat-grid dash-in delay-1">
                <Stat label="Visitors" value={fmt(metrics.uniqueVisitors)} hint={`${fmt(metrics.dau)} today · ${fmt(metrics.mau)} / 30d`} />
                <Stat label="Page views" value={fmt(metrics.pageViews)} hint={`${(metrics.pagesPerSession ?? 0).toFixed(1)} per session`} />
                <Stat label="Leads" value={fmt(metrics.funnel.leadsSubmitted)} hint={`${pct(metrics.funnel.conversionRate)} conversion`} />
                <Stat label="People" value={fmt(overview.accounts.total)} hint={`${overview.accounts.trial} trial · ${overview.accounts.paid} paid`} />
                <Stat label="Screens" value={fmt(overview.workspace.runs)} hint="assessment completions" />
                <Stat label="Community" value={fmt(overview.workspace.threads)} hint={`${fmt(overview.workspace.replies)} replies`} />
              </div>

              <div className="admin-split dash-in delay-2">
                <div className="admin-card">
                  <h2 className="admin-h2">Site funnel</h2>
                  <FunnelBars
                    steps={[
                      { label: "Page views", value: metrics.funnel.pageViews },
                      { label: "CTA clicks", value: metrics.funnel.ctaClicks },
                      { label: "Form starts", value: metrics.funnel.formStarts },
                      { label: "Leads", value: metrics.funnel.leadsSubmitted },
                    ]}
                  />
                  <p className="meta admin-hint">Bounce {pct(metrics.bounceRate)} · {fmt(metrics.sessions)} sessions in 30 days</p>
                </div>
                <div className="admin-card">
                  <h2 className="admin-h2">Traffic sources</h2>
                  {metrics.sources.length ? (
                    <ul className="admin-source-list">
                      {metrics.sources.map((source) => {
                        const max = Math.max(1, metrics.sources[0]?.visitors ?? 1);
                        return (
                          <li key={source.channel}>
                            <div className="funnel-bars-meta">
                              <span>{source.channel}</span>
                              <span className="num">{fmt(source.visitors)}</span>
                            </div>
                            <div className="funnel-track" aria-hidden="true">
                              <span style={{ width: `${Math.max(8, (source.visitors / max) * 100)}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="admin-empty">No source data yet. Views on the public site with analytics accepted will show here.</p>
                  )}
                </div>
              </div>

              <div className="chart-grid dash-in delay-2">
                <TrendChart points={overview.series} valueKey="views" label="Pageviews · 14 days" />
                <TrendChart points={overview.series} valueKey="leads" label="Leads · 14 days" />
                <TrendChart points={overview.series} valueKey="revenue" label="Revenue · 14 days" />
                <TrendChart points={overview.series} valueKey="signups" label="Signups · 14 days" />
              </div>

              <div className="admin-activity dash-in delay-3">
                <ActivityList
                  title="Latest people"
                  empty="No signups yet. New accounts from /signup appear here."
                  onViewAll={() => setTab("trials")}
                  items={recentPeople.map((person) => ({
                    key: person.id,
                    title: person.name,
                    meta: [person.email, person.city, person.phone, person.access.status, when(person.createdAt)]
                      .filter(Boolean)
                      .join(" · "),
                    pill: person.access.status,
                  }))}
                />
                <ActivityList
                  title="Latest leads"
                  empty="No enquiry forms yet."
                  onViewAll={() => setTab("leads")}
                  items={recentLeads.map((lead) => ({
                    key: lead.id,
                    title: lead.name,
                    meta: [lead.type, lead.organisation, lead.email, when(lead.createdAt)].filter(Boolean).join(" · "),
                    pill: lead.type,
                  }))}
                />
                <ActivityList
                  title="Latest screens"
                  empty="No assessment completions yet."
                  onViewAll={() => setTab("assessments")}
                  items={recentRuns.map((run) => ({
                    key: run.id,
                    title: assessmentTitle(run.assessmentId),
                    meta: `${run.accountName} · ${when(run.createdAt)}`,
                    bar: run.score,
                  }))}
                />
                <ActivityList
                  title="Latest threads"
                  empty="No community threads yet."
                  onViewAll={() => setTab("community")}
                  items={recentThreads.map((thread) => ({
                    key: thread.id,
                    title: thread.title,
                    meta: [
                      thread.authorName,
                      `${thread.answerCount} ${thread.answerCount === 1 ? "reply" : "replies"}`,
                      `${thread.views} views`,
                      thread.createdAt ? when(thread.createdAt) : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
                />
                <ActivityList
                  title="Latest bills"
                  empty="No invoices yet. Issue a workshop bill from Billing."
                  onViewAll={() => setTab("billing")}
                  items={recentInvoices.map((invoice) => ({
                    key: invoice.id,
                    title: `${invoice.number} · ${invoice.customerName}`,
                    meta: [invoice.label, invoice.totalLabel, invoice.status, when(invoice.createdAt)]
                      .filter(Boolean)
                      .join(" · "),
                    pill: invoice.status,
                  }))}
                />
              </div>
            </>
          ) : !overviewLoading ? (
            <p className="admin-empty">Could not load the dashboard. Use Refresh.</p>
          ) : null}
        </section>
      ) : null}

      {tab === "leads" ? (
        <section className="admin-panel">
          <div className="admin-card-head">
            <h2 className="admin-h2">Leads {leads ? `(${leads.length})` : ""}</h2>
          </div>
          {!leads ? (
            <div className="admin-skeleton" />
          ) : !leads.length ? (
            <p className="admin-empty">No leads stored yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Org</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="meta">{when(lead.createdAt)}</td>
                      <td>
                        <span className="admin-pill">{lead.type}</span>
                        {lead.redacted ? <span className="meta"> · masked</span> : null}
                      </td>
                      <td>{lead.name}</td>
                      <td>{lead.email}</td>
                      <td>{lead.phone}</td>
                      <td>{lead.organisation || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "assessments" ? (
        <section className="admin-panel">
          <div className="admin-card-head">
            <h2 className="admin-h2">Assessments {workspace ? `(${workspace.runs.length})` : ""}</h2>
          </div>
          {!workspace ? (
            <div className="admin-skeleton" />
          ) : !workspace.runs.length ? (
            <p className="admin-empty">No assessment completions yet. When someone finishes a screen in the app, it lands here.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Person</th>
                    <th>Assessment</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.runs.map((run) => (
                    <tr key={run.id}>
                      <td className="meta">{when(run.createdAt)}</td>
                      <td>{run.accountName}</td>
                      <td>{assessmentTitle(run.assessmentId)}</td>
                      <td className="num">{run.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "community" ? (
        <section className="admin-panel">
          <div className="admin-card-head">
            <h2 className="admin-h2">Community {workspace ? `(${workspace.threads.length})` : ""}</h2>
          </div>
          {!workspace ? (
            <div className="admin-skeleton" />
          ) : !workspace.threads.length ? (
            <p className="admin-empty">No community threads yet. Questions asked in the app appear here.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Thread</th>
                    <th>Author</th>
                    <th>Replies</th>
                    <th>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.threads.map((thread) => (
                    <tr key={thread.id}>
                      <td>{thread.title}</td>
                      <td>{thread.authorName}</td>
                      <td className="num">{thread.answerCount}</td>
                      <td className="num">{thread.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "trials" ? (
        <section className="admin-panel">
          {!billing || !accounts ? (
            <div className="admin-skeleton" />
          ) : (
            <>
              <div className="admin-card-head">
                <h2 className="admin-h2">People ({accounts.length})</h2>
              </div>
              <p className="lead admin-hint">Grant trial or paid access, or revoke the app.</p>
              <div className="trial-controls">
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={billing.autoTrialOnSignup}
                    onChange={(e) => void saveBilling({ autoTrialOnSignup: e.target.checked })}
                  />
                  <span>Auto-start trial on signup</span>
                </label>
                <label className="admin-field">
                  <span className="meta">Default trial days</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={trialDays}
                    onChange={(e) => setTrialDays(Number(e.target.value))}
                    onBlur={() => void saveBilling({ defaultTrialDays: trialDays })}
                  />
                </label>
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={billing.trialModules.assessments}
                    onChange={(e) =>
                      void saveBilling({
                        trialModules: { ...billing.trialModules, assessments: e.target.checked },
                      })
                    }
                  />
                  <span>Assessments on trial</span>
                </label>
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={billing.trialModules.community}
                    onChange={(e) =>
                      void saveBilling({
                        trialModules: { ...billing.trialModules, community: e.target.checked },
                      })
                    }
                  />
                  <span>Community on trial</span>
                </label>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Status</th>
                      <th>Modules</th>
                      <th>Reply role</th>
                      <th>Ends</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.name}
                          <br />
                          <span className="meta">{row.email}</span>
                          {row.phone || row.city ? (
                            <>
                              <br />
                              <span className="meta">
                                {[row.phone, row.city, row.age != null ? `${row.age}` : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </>
                          ) : null}
                        </td>
                        <td>
                          <span className="admin-pill">{row.access.status}</span>
                        </td>
                        <td className="meta">
                          {row.access.modules.assessments ? "assessments " : ""}
                          {row.access.modules.community ? "community" : ""}
                          {!row.access.modules.assessments && !row.access.modules.community ? "—" : ""}
                        </td>
                        <td>
                          <select
                            className="input"
                            aria-label={`Community role for ${row.name}`}
                            value={row.communityRole ?? "student"}
                            onChange={(e) =>
                              void setCommunityRole(
                                row.id,
                                e.target.value as "student" | "specialist" | "admin",
                              )
                            }
                          >
                            <option value="student">Student</option>
                            <option value="specialist">Specialist</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="meta">{row.access.trialEndsAt ? when(row.access.trialEndsAt) : "—"}</td>
                        <td className="admin-row-actions">
                          <button type="button" className="btn btn-secondary" onClick={() => void setAccess(row.id, "trial")}>
                            Trial
                          </button>
                          <button type="button" className="btn btn-secondary" onClick={() => void setAccess(row.id, "paid")}>
                            Paid
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => void setAccess(row.id, "revoke")}>
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!accounts.length ? <p className="admin-empty">No customer accounts yet. Signups from the trial form appear here.</p> : null}
            </>
          )}
        </section>
      ) : null}

      {tab === "billing" ? (
        <BillingModule
          key={billingTick}
          accounts={accounts}
          ensureAccounts={() => {
            if (accounts === null) {
              void (async () => {
                const a = await adminFetch("/api/admin/accounts");
                if (a.res.ok) setAccounts(a.body.accounts || []);
              })();
            }
          }}
          onChanged={() => void loadOverview()}
        />
      ) : null}

      {tab === "experiments" ? (
        <section className="admin-panel admin-experiments">
          {!experiments ? (
            <div className="admin-skeleton" />
          ) : !experiments.length ? (
            <p className="admin-empty">No known experiments.</p>
          ) : (
            experiments.map((row) => (
              <article key={row.key} className="admin-experiment">
                <header>
                  <div>
                    <h2 className="admin-h2">{row.label}</h2>
                    <p className="meta">{row.description}</p>
                  </div>
                  <label className="admin-toggle">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      disabled={savingKey === row.key}
                      onChange={(e) => void saveExperiment(row, { enabled: e.target.checked })}
                    />
                    <span>{row.enabled ? "Enabled" : "Disabled → control"}</span>
                  </label>
                </header>
                <div className="admin-experiment-grid">
                  <label className="admin-field">
                    <span className="meta">Control weight</span>
                    <input
                      type="number"
                      min={0}
                      defaultValue={row.weights.control}
                      key={`${row.key}-c-${row.weights.control}`}
                      onBlur={(e) => {
                        const control = Number(e.target.value);
                        if (!Number.isFinite(control) || control === row.weights.control) return;
                        void saveExperiment(row, { weights: { ...row.weights, control } });
                      }}
                    />
                  </label>
                  <label className="admin-field">
                    <span className="meta">Variant weight</span>
                    <input
                      type="number"
                      min={0}
                      defaultValue={row.weights.variant}
                      key={`${row.key}-v-${row.weights.variant}`}
                      onBlur={(e) => {
                        const variant = Number(e.target.value);
                        if (!Number.isFinite(variant) || variant === row.weights.variant) return;
                        void saveExperiment(row, { weights: { ...row.weights, variant } });
                      }}
                    />
                  </label>
                  <label className="admin-field">
                    <span className="meta">Forced variant</span>
                    <select
                      value={row.forcedVariant ?? ""}
                      disabled={savingKey === row.key}
                      onChange={(e) => {
                        const value = e.target.value;
                        const forcedVariant = value === "control" || value === "variant" ? value : null;
                        void saveExperiment(row, { forcedVariant });
                      }}
                    >
                      <option value="">None (weighted)</option>
                      <option value="control">Force control</option>
                      <option value="variant">Force variant</option>
                    </select>
                  </label>
                </div>
                <div className="admin-variant-stats">
                  {row.stats.variants.map((stat) => (
                    <div key={stat.variant} className="admin-variant-card">
                      <p className="eyebrow">{stat.variant}</p>
                      <p className="num admin-big">{fmt(stat.assignments)}</p>
                      <p className="meta">
                        {fmt(stat.ctaClicks)} CTA · CTR {pct(stat.ctr)}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="admin-stat">
      <p className="meta">{label}</p>
      <p className="num admin-big">{value}</p>
      <p className="meta">{hint}</p>
    </div>
  );
}

function ActivityList({
  title,
  empty,
  items,
  onViewAll,
}: {
  title: string;
  empty: string;
  onViewAll?: () => void;
  items: Array<{ key: string; title: string; meta: string; pill?: string; bar?: number }>;
}) {
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2 className="admin-h2">{title}</h2>
        {onViewAll ? (
          <button type="button" className="admin-text-btn" onClick={onViewAll}>
            View all
          </button>
        ) : null}
      </div>
      {items.length ? (
        <ul className="admin-activity-list">
          {items.map((item) => (
            <li key={item.key}>
              <div className="admin-activity-row">
                <div>
                  <strong>{item.title}</strong>
                  <p className="meta">{item.meta}</p>
                </div>
                {item.pill ? <span className="admin-pill">{item.pill}</span> : null}
                {item.bar != null ? (
                  <div className="admin-score">
                    <span className="funnel-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(8, Math.min(100, item.bar))}%` }} />
                    </span>
                    <span className="num">{item.bar}</span>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-empty">{empty}</p>
      )}
    </section>
  );
}
