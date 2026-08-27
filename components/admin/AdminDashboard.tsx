"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { MetricsWindow } from "@/lib/tracking/metrics";
import type { ExperimentKey, ExperimentVariant } from "@/lib/tracking/experiment";

type AdminLead = {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  role: string | null;
  organisation: string | null;
  sizeBand: string | null;
  preferredTime: string | null;
  visitorId: string | null;
  createdAt: string;
  redacted: boolean;
};

type AdminEvent = {
  name: string;
  at: string;
  path: string;
  visitorId: string;
  sessionId: string;
  channel: string | null;
  experiment: string | null;
  variant: ExperimentVariant | null;
  props: Record<string, unknown>;
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
    key: ExperimentKey;
    variants: Array<{
      variant: ExperimentVariant;
      assignments: number;
      ctaClicks: number;
      ctr: number;
    }>;
  };
};

type Tab = "overview" | "leads" | "events" | "experiments";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsWindow | null>(null);
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRow[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, l, e, x] = await Promise.all([
        adminFetch("/api/admin/metrics"),
        adminFetch("/api/admin/leads?limit=50"),
        adminFetch("/api/admin/events?limit=100"),
        adminFetch("/api/admin/experiments"),
      ]);
      if ([m, l, e, x].some((r) => r.res.status === 401)) {
        setAuthed(false);
        return;
      }
      if (!m.res.ok) throw new Error(m.body.message || "Could not load metrics");
      setMetrics(m.body as MetricsWindow);
      setLeads((l.body.leads as AdminLead[]) || []);
      setEvents((e.body.events as AdminEvent[]) || []);
      setExperiments((x.body.experiments as ExperimentRow[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (authed) void loadData();
  }, [authed, loadData]);

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
    setMetrics(null);
    setLeads([]);
    setEvents([]);
    setExperiments([]);
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
      setExperiments((prev) => prev.map((item) => (item.key === row.key ? { ...item, ...body.experiment } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingKey(null);
    }
  }

  if (authed === null) {
    return (
      <main className="admin-shell">
        <p className="meta">Checking session…</p>
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
            Set <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code> in{" "}
            <code>.env.local</code> (or legacy <code>ADMIN_DASHBOARD_SECRET</code>), restart{" "}
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
          <p className="eyebrow">Lokutara admin</p>
          <h1>Founder dashboard</h1>
          <p className="lead">
            Sign in with your admin email and password to view tracking and control experiments.
          </p>
          {emailRequired ? (
            <label className="admin-field">
              <span className="meta">Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          ) : null}
          <label className="admin-field">
            <span className="meta">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {loginError ? <p className="admin-error">{loginError}</p> : null}
          <button type="submit" className="btn btn-primary admin-gate-submit">
            Open dashboard
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-top">
        <div>
          <p className="eyebrow">Internal</p>
          <h1>Lokutara control</h1>
          <p className="lead">Launch metrics from first-party events — workshops and counselling only.</p>
        </div>
        <div className="admin-top-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void loadData()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Dashboard sections">
        {(
          [
            ["overview", "Overview"],
            ["leads", "Leads"],
            ["events", "Events"],
            ["experiments", "Experiments"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "is-active" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? <p className="admin-error">{error}</p> : null}

      {tab === "overview" ? (
        <section className="admin-panel">
          {!metrics || (metrics.pageViews === 0 && metrics.uniqueVisitors === 0) ? (
            <p className="admin-empty">No events in the last 30 days yet. Browse the site with analytics consent to seed data.</p>
          ) : (
            <>
              <div className="admin-stat-grid">
                <Stat label="Page views" value={fmt(metrics.pageViews)} hint="30 days" />
                <Stat label="Unique visitors" value={fmt(metrics.uniqueVisitors)} hint="approx · 30d" />
                <Stat label="Sessions" value={fmt(metrics.sessions)} hint="30 days" />
                <Stat label="DAU" value={fmt(metrics.dau)} hint="24 hours" />
                <Stat label="WAU" value={fmt(metrics.wau)} hint="7 days" />
                <Stat label="MAU" value={fmt(metrics.mau)} hint="30 days" />
                <Stat label="Bounce rate" value={pct(metrics.bounceRate)} hint="single page sessions" />
                <Stat label="Conversion" value={pct(metrics.funnel.conversionRate)} hint="leads / visitors" />
              </div>

              <h2 className="admin-h2">Funnel</h2>
              <div className="admin-funnel">
                <FunnelStep label="Page views" value={metrics.funnel.pageViews} />
                <FunnelStep label="CTA clicks" value={metrics.funnel.ctaClicks} />
                <FunnelStep label="Form starts" value={metrics.funnel.formStarts} />
                <FunnelStep label="Leads" value={metrics.funnel.leadsSubmitted} />
              </div>

              {metrics.sources.length ? (
                <>
                  <h2 className="admin-h2">Sources</h2>
                  <ul className="admin-source-list">
                    {metrics.sources.map((source) => (
                      <li key={source.channel}>
                        <span>{source.channel}</span>
                        <span className="num">{fmt(source.visitors)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {tab === "leads" ? (
        <section className="admin-panel">
          {!leads.length ? (
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

      {tab === "events" ? (
        <section className="admin-panel">
          {!events.length ? (
            <p className="admin-empty">No events stored yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Path</th>
                    <th>Experiment</th>
                    <th>Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, idx) => (
                    <tr key={`${event.at}-${event.name}-${idx}`}>
                      <td className="meta">{when(event.at)}</td>
                      <td>
                        <code>{event.name}</code>
                      </td>
                      <td>{event.path}</td>
                      <td className="meta">
                        {event.experiment ? `${event.experiment} · ${event.variant || "?"}` : "—"}
                      </td>
                      <td className="meta">{event.channel || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "experiments" ? (
        <section className="admin-panel admin-experiments">
          {!experiments.length ? (
            <p className="admin-empty">No known experiments.</p>
          ) : (
            experiments.map((row) => (
              <article key={row.key} className="admin-experiment">
                <header>
                  <div>
                    <h2 className="admin-h2">{row.label}</h2>
                    <p className="meta">{row.description}</p>
                    <p className="meta">
                      key <code>{row.key}</code>
                      {row.updatedAt ? ` · updated ${when(row.updatedAt)}` : " · defaults"}
                    </p>
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
                        const forcedVariant =
                          value === "control" || value === "variant" ? value : null;
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
                      <p className="meta">assignments</p>
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

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-funnel-step">
      <p className="num admin-big">{fmt(value)}</p>
      <p className="meta">{label}</p>
    </div>
  );
}
