"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { MetricsWindow } from "@/lib/tracking/metrics";
import type { ExperimentKey, ExperimentVariant } from "@/lib/tracking/experiment";
import type { AccessSnapshot, BillingSettings } from "@/lib/access/billing";
import type { DayPoint } from "@/lib/charts/series";
import { FunnelBars, TrendChart } from "@/components/charts/TrendChart";

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
  seats: number;
  createdAt: string;
  access: AccessSnapshot;
};

type OverviewPayload = {
  metrics: MetricsWindow;
  series: DayPoint[];
  accounts: { none: number; trial: number; paid: number; expired: number; total: number };
  workspace: { runs: number; threads: number; replies: number };
};

type Tab = "overview" | "leads" | "assessments" | "community" | "trials" | "experiments";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
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
  const [overviewLoading, setOverviewLoading] = useState(false);
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
    if (authed && tab === "overview") void loadOverview();
  }, [authed, tab, loadOverview]);

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
    if (tab === "trials" && (accounts === null || billing === null)) {
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
    setOverview(null);
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
        <form className="admin-gate" onSubmit={onLogin}>
          <p className="eyebrow">Founder ops</p>
          <h1>Lokutara console</h1>
          <p className="lead">One admin for the funnel, trials, assessments, and community — not three products.</p>
          {emailRequired ? (
            <label className="admin-field">
              <span className="meta">Email</span>
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          ) : null}
          <label className="admin-field">
            <span className="meta">Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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

  return (
    <main className="admin-shell admin-ops">
      <header className="admin-top">
        <div>
          <p className="eyebrow">Founder</p>
          <h1>Ops console</h1>
          <p className="lead">Live funnel, product usage, and trial controls in one place.</p>
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
              if (tab === "experiments") setExperiments(null);
            }}
          >
            Refresh tab
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
            ["leads", "Leads"],
            ["assessments", "Assessments"],
            ["community", "Community"],
            ["trials", "Trials"],
            ["experiments", "Experiments"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "is-active" : undefined} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {error ? <p className="admin-error">{error}</p> : null}

      {tab === "overview" ? (
        <section className="admin-panel">
          {overviewLoading && !overview ? (
            <div className="admin-skeleton-page" aria-busy="true">
              <div className="admin-stat-grid">
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
              <div className="admin-stat-grid">
                <Stat label="Page views" value={fmt(metrics.pageViews)} hint="30 days" />
                <Stat label="Visitors" value={fmt(metrics.uniqueVisitors)} hint="30 days" />
                <Stat label="Conversion" value={pct(metrics.funnel.conversionRate)} hint="leads / visitors" />
                <Stat label="Trials" value={fmt(overview.accounts.trial)} hint={`${overview.accounts.paid} paid`} />
                <Stat label="Runs" value={fmt(overview.workspace.runs)} hint="assessments" />
                <Stat label="Threads" value={fmt(overview.workspace.threads)} hint={`${overview.workspace.replies} replies`} />
              </div>
              <div className="chart-grid">
                <TrendChart points={overview.series} valueKey="views" label="Pageviews · 14d" />
                <TrendChart points={overview.series} valueKey="leads" label="Leads · 14d" />
              </div>
              <h2 className="admin-h2">Funnel</h2>
              <FunnelBars
                steps={[
                  { label: "Page views", value: metrics.funnel.pageViews },
                  { label: "CTA clicks", value: metrics.funnel.ctaClicks },
                  { label: "Form starts", value: metrics.funnel.formStarts },
                  { label: "Leads", value: metrics.funnel.leadsSubmitted },
                ]}
              />
            </>
          ) : !overviewLoading ? (
            <p className="admin-empty">No overview yet. Browse the public site with analytics on to seed charts.</p>
          ) : null}
        </section>
      ) : null}

      {tab === "leads" ? (
        <section className="admin-panel">
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
          {!workspace ? (
            <div className="admin-skeleton" />
          ) : !workspace.runs.length ? (
            <p className="admin-empty">No assessment completions yet. Completions from the customer dashboard land here.</p>
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
                      <td>{run.assessmentId}</td>
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
          {!workspace ? (
            <div className="admin-skeleton" />
          ) : !workspace.threads.length ? (
            <p className="admin-empty">No community threads yet. This is the same product — there is no second forum admin.</p>
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
                        </td>
                        <td>
                          <span className="admin-pill">{row.access.status}</span>
                        </td>
                        <td className="meta">
                          {row.access.modules.assessments ? "assessments " : ""}
                          {row.access.modules.community ? "community" : ""}
                          {!row.access.modules.assessments && !row.access.modules.community ? "—" : ""}
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
              {!accounts.length ? <p className="admin-empty">No customer accounts yet. Signups from /signup appear here.</p> : null}
            </>
          )}
        </section>
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
