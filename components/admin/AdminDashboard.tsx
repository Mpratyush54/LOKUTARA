"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { MetricsWindow } from "@/lib/tracking/metrics";
import type { ExperimentKey, ExperimentVariant } from "@/lib/tracking/experiment";
import type { AccessSnapshot, BillingSettings } from "@/lib/access/billing";
import type { DayPoint } from "@/lib/charts/series";
import type { CommerceSnapshot } from "@/lib/billing/commerce";
import { formatInrFromPaise } from "@/lib/billing/invoices";
import { LOCAL_ASSESSMENTS } from "@/lib/product/workspace";
import { FunnelBars, TrendChart, CountUp, DonutChart } from "@/components/charts/TrendChart";
import { BillingModule } from "@/components/admin/BillingModule";
import { LokutaraLogo } from "@/components/brand/LokutaraLogo";

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
  banned?: boolean;
  banReason?: string | null;
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
    runs: Array<{ id: string; assessmentId: string; createdAt: string }>;
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

type WorkspaceThread = {
  id: string;
  title: string;
  body?: string;
  authorName: string;
  authorId?: string;
  tags: string[];
  views: number;
  answerCount: number;
  createdAt?: string;
};

type ModeratedAnswer = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  upvotes: number;
  createdAt: string;
};

type ModeratedThread = WorkspaceThread & {
  answers: ModeratedAnswer[];
};

export type AdminTab = "overview" | "leads" | "assessments" | "community" | "trials" | "billing" | "experiments";

export type BillingView = "bills" | "new" | "promos" | "seller";

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

export function AdminDashboard({
  initialTab = "overview",
  initialBillingView = "bills",
}: {
  initialTab?: AdminTab;
  initialBillingView?: BillingView;
} = {}) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailRequired, setEmailRequired] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [billingView, setBillingView] = useState<BillingView>(initialBillingView);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [leads, setLeads] = useState<AdminLead[] | null>(null);
  const [leadsQuery, setLeadsQuery] = useState("");
  const [leadsType, setLeadsType] = useState("");
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPages, setLeadsPages] = useState(1);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [workspace, setWorkspace] = useState<{
    runs: Array<{ id: string; assessmentId: string; createdAt: string }>;
    threads: WorkspaceThread[];
  } | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [billing, setBilling] = useState<BillingSettings | null>(null);
  const [experiments, setExperiments] = useState<ExperimentRow[] | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState(14);
  const [billingTick, setBillingTick] = useState(0);
  const [communityQuery, setCommunityQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<ModeratedThread | null>(null);
  const [moderating, setModerating] = useState<string | null>(null);
  const [blockedWords, setBlockedWords] = useState<string[] | null>(null);
  const [newWord, setNewWord] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");

  const visibleAccounts = (accounts || []).filter((row) => {
    const q = peopleQuery.trim().toLowerCase();
    if (!q) return true;
    return `${row.name} ${row.email} ${row.city ?? ""} ${row.organisation ?? ""}`.toLowerCase().includes(q);
  });

  async function loadLeads(page: number, q: string, type: string) {
    const params = new URLSearchParams({ limit: "25", page: String(page) });
    if (q.trim()) params.set("q", q.trim());
    if (type) params.set("type", type);
    const { res, body } = await adminFetch(`/api/admin/leads?${params.toString()}`);
    if (!res.ok) {
      setError(body.message || "Could not load leads");
      return;
    }
    setLeads(body.leads || []);
    setLeadsTotal(body.total ?? (body.leads || []).length);
    setLeadsPages(body.pages ?? 1);
    setLeadsPage(body.page ?? page);
  }

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
      void loadLeads(1, "", "");
    }
    if ((tab === "assessments" || tab === "community") && workspace === null) {
      void (async () => {
        const { res, body } = await adminFetch("/api/admin/workspace");
        if (res.ok) setWorkspace(body);
      })();
    }
    if (tab === "community" && blockedWords === null) {
      void (async () => {
        const { res, body } = await adminFetch("/api/admin/billing");
        if (res.ok) setBlockedWords(body.settings?.blockedWords ?? []);
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
  }, [authed, tab, leads, workspace, accounts, billing, experiments, blockedWords]);

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
    setLeadsQuery("");
    setLeadsType("");
    setLeadsPage(1);
    setLeadsPages(1);
    setLeadsTotal(0);
    setWorkspace(null);
    setAccounts(null);
    setBilling(null);
    setExperiments(null);
    setSelectedThreadId(null);
    setSelectedThread(null);
    setCommunityQuery("");
    setBlockedWords(null);
    setNewWord("");
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

  async function setBanned(id: string, banned: boolean) {
    let reason = "";
    if (banned) {
      const input = window.prompt("Ban reason (shown to nobody, stored for records):", "");
      if (input === null) return;
      reason = input;
    } else if (!window.confirm("Unban this account? They will still need access granted to enter the app.")) {
      return;
    }
    const { res, body } = await adminFetch(`/api/admin/accounts/${id}/access`, {
      method: "POST",
      body: JSON.stringify({ action: banned ? "ban" : "unban", reason }),
    });
    if (!res.ok) {
      setError(body.message || "Could not update ban");
      return;
    }
    setAccounts((prev) => (prev || []).map((row) => (row.id === id ? body.account : row)));
    void loadOverview();
  }

  async function saveBlockedWords(next: string[]) {
    setError(null);
    const current = billing
      ? { ...billing }
      : { autoTrialOnSignup: true, defaultTrialDays: trialDays, trialModules: { assessments: true, community: true } };
    const { res, body } = await adminFetch("/api/admin/billing", {
      method: "PUT",
      body: JSON.stringify({ ...current, blockedWords: next }),
    });
    if (!res.ok) {
      setError(body.message || "Could not save blocked words");
      return;
    }
    setBlockedWords(body.settings?.blockedWords ?? next);
    if (billing) setBilling(body.settings);
  }

  async function openThreadForModeration(id: string) {
    setSelectedThreadId(id);
    setSelectedThread(null);
    setError(null);
    const { res, body } = await adminFetch(`/api/admin/threads/${id}`);
    if (!res.ok) {
      setError(body.message || "Could not open thread");
      return;
    }
    setSelectedThread(body.thread as ModeratedThread);
  }

  async function removeThread(id: string) {
    if (!window.confirm("Delete this thread and all its replies? This cannot be undone.")) return;
    setModerating(id);
    setError(null);
    const { res, body } = await adminFetch(`/api/admin/threads/${id}`, { method: "DELETE" });
    setModerating(null);
    if (!res.ok) {
      setError(body.message || "Could not delete thread");
      return;
    }
    setWorkspace((prev) =>
      prev ? { ...prev, threads: prev.threads.filter((thread) => thread.id !== id) } : prev,
    );
    if (selectedThreadId === id) {
      setSelectedThreadId(null);
      setSelectedThread(null);
    }
    void loadOverview();
  }

  async function removeAnswer(threadId: string, answerId: string) {
    if (!window.confirm("Delete this reply? This cannot be undone.")) return;
    setModerating(answerId);
    setError(null);
    const { res, body } = await adminFetch(`/api/admin/threads/${threadId}/answers/${answerId}`, {
      method: "DELETE",
    });
    setModerating(null);
    if (!res.ok) {
      setError(body.message || "Could not delete reply");
      return;
    }
    if (body.thread) setSelectedThread(body.thread as ModeratedThread);
    setWorkspace((prev) =>
      prev
        ? {
            ...prev,
            threads: prev.threads.map((thread) =>
              thread.id === threadId
                ? { ...thread, answerCount: Math.max(0, thread.answerCount - 1) }
                : thread,
            ),
          }
        : prev,
    );
    void loadOverview();
  }

  const filteredThreads = (workspace?.threads || []).filter((thread) => {
    const q = communityQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      thread.title.toLowerCase().includes(q) ||
      (thread.body || "").toLowerCase().includes(q) ||
      thread.authorName.toLowerCase().includes(q) ||
      thread.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const NAV: Array<{ id: AdminTab; label: string; count?: string }> = [
    { id: "overview", label: "Overview" },
    { id: "leads", label: "Leads", count: overview ? String(overview.metrics.funnel.leadsSubmitted) : undefined },
    { id: "assessments", label: "Assessments", count: overview ? String(overview.workspace.runs) : undefined },
    { id: "community", label: "Community", count: overview ? String(overview.workspace.threads) : undefined },
    {
      id: "billing",
      label: "Billing",
      count: overview ? formatInrFromPaise(overview.commerce?.revenueThisMonth || 0) : undefined,
    },
    { id: "trials", label: "People", count: overview ? String(overview.accounts.total) : undefined },
    { id: "experiments", label: "Experiments" },
  ];

  function goTab(id: AdminTab) {
    setTab(id);
    router.push(`/admin/${id}`);
  }

  function goBilling(view: BillingView) {
    setTab("billing");
    setBillingView(view);
    router.push(view === "bills" ? "/admin/billing" : `/admin/billing/${view}`);
  }

  if (authed === null) {
    return (
      <main className="admin-shell admin-ops" aria-busy="true" data-testid="admin-skeleton">
        <div className="admin-login-wrap">
          <LokutaraLogo size={40} subtitle="Founder console" />
          <div className="admin-skeleton-page" style={{ width: "100%" }}>
            <div className="admin-skeleton admin-skeleton-title" />
            <div className="admin-stat-grid">
              <div className="admin-skeleton admin-skeleton-stat" />
              <div className="admin-skeleton admin-skeleton-stat" />
              <div className="admin-skeleton admin-skeleton-stat" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="admin-shell">
        <div className="admin-login-wrap">
          <LokutaraLogo size={44} subtitle="Founder console" />
          <div className="admin-gate admin-card">
            <p className="eyebrow">Lokutara admin</p>
            <h1>Dashboard locked</h1>
            <p className="lead">
              Set <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code> in <code>.env.local</code>, restart{" "}
              <code>npm run dev</code>, then return here.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="admin-shell">
        <div className="admin-login-wrap">
          <LokutaraLogo size={44} subtitle="Founder console" />
          <form className="admin-gate admin-card dash-in" onSubmit={onLogin}>
            <p className="eyebrow">Founder ops</p>
            <h1>Lokutara admin</h1>
            <p className="lead">Sign in to see leads, signups, assessment runs, billing, and community moderation.</p>
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
            <p className="meta">Protected by rate limits · httpOnly session cookie · 7-day expiry.</p>
          </form>
        </div>
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
    <main className="admin-shell admin-ops admin-dash">
      <div className="admin-dash-grid">
        <aside className="admin-side" aria-label="Admin navigation">
          <LokutaraLogo size={34} subtitle="Founder console" />
          <nav className="admin-tabs admin-tabs-vertical" aria-label="Ops sections">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? "is-active" : undefined}
                onClick={() => goTab(item.id)}
              >
                <span>{item.label}</span>
                {item.count ? <span className="admin-nav-count">{item.count}</span> : null}
              </button>
            ))}
          </nav>
          <nav className="admin-side-links" aria-label="Product">
            <a href="/">View website</a>
            <a href="/app">Open app</a>
            <a href="/app/billing">App billing</a>
            <a href="/app/community">App community</a>
          </nav>
          <div className="admin-side-foot">
            <button type="button" className="btn btn-ghost" onClick={() => void onLogout()}>
              Sign out
            </button>
          </div>
        </aside>
        <div className="admin-main">
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
                  if (tab === "leads") {
                    setLeads(null);
                    void loadLeads(1, leadsQuery, leadsType);
                    setLeadsPage(1);
                  }
                  if (tab === "assessments" || tab === "community") {
                    setWorkspace(null);
                    setSelectedThreadId(null);
                    setSelectedThread(null);
                  }
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
              <button type="button" className="btn btn-ghost admin-signout-inline" onClick={() => void onLogout()}>
                Sign out
              </button>
            </div>
          </header>

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
                    <p className="admin-big"><CountUp value={commerce.revenueToday} format={(n) => formatInrFromPaise(Math.round(n))} /></p>
                    <p className="meta">IST calendar day</p>
                  </article>
                  <article>
                    <p className="meta">This month</p>
                    <p className="admin-big"><CountUp value={commerce.revenueThisMonth} format={(n) => formatInrFromPaise(Math.round(n))} /></p>
                    <p className="meta">{momLabel(commerce.momRevenuePct)}</p>
                  </article>
                  <article>
                    <p className="meta">Last month</p>
                    <p className="admin-big"><CountUp value={commerce.revenueLastMonth} format={(n) => formatInrFromPaise(Math.round(n))} /></p>
                    <p className="meta">{fmt(commerce.paidThisMonth)} paid bills this month</p>
                  </article>
                  <article>
                    <p className="meta">People this month</p>
                    <p className="admin-big"><CountUp value={commerce.peopleThisMonth} format={(n) => fmt(Math.round(n))} /></p>
                    <p className="meta">
                      {fmt(commerce.peopleLastMonth)} last month · {fmt(commerce.visitorsThisMonth)} visitors
                    </p>
                  </article>
                  <article>
                    <p className="meta">Outstanding</p>
                    <p className="admin-big"><CountUp value={commerce.outstandingPaise} format={(n) => formatInrFromPaise(Math.round(n))} /></p>
                    <p className="meta">{fmt(commerce.leadsThisMonth)} leads this month</p>
                  </article>
                </div>
              ) : null}

              {overview.accounts.expired > 0 || overview.accounts.none > 0 || metrics.uniqueVisitors === 0 ? (
                <div className="admin-attention dash-in delay-1">
                  {overview.accounts.expired > 0 ? (
                    <button type="button" className="admin-flag" onClick={() => goTab("trials")}>
                      <strong>{fmt(overview.accounts.expired)} expired</strong>
                      <span>Restore trial or give complimentary access on People.</span>
                    </button>
                  ) : null}
                  {overview.accounts.none > 0 ? (
                    <button type="button" className="admin-flag" onClick={() => goTab("trials")}>
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
                <Stat label="Visitors" value={fmt(metrics.uniqueVisitors)} hint={`${fmt(metrics.dau)} today · ${fmt(metrics.mau)} / 30d`} raw={metrics.uniqueVisitors} />
                <Stat label="Page views" value={fmt(metrics.pageViews)} hint={`${(metrics.pagesPerSession ?? 0).toFixed(1)} per session`} raw={metrics.pageViews} />
                <Stat label="Leads" value={fmt(metrics.funnel.leadsSubmitted)} hint={`${pct(metrics.funnel.conversionRate)} conversion`} raw={metrics.funnel.leadsSubmitted} />
                <Stat label="People" value={fmt(overview.accounts.total)} hint={`${overview.accounts.trial} trial · ${overview.accounts.paid} paid`} raw={overview.accounts.total} />
                <Stat label="Screens" value={fmt(overview.workspace.runs)} hint="assessment completions" raw={overview.workspace.runs} />
                <Stat label="Community" value={fmt(overview.workspace.threads)} hint={`${fmt(overview.workspace.replies)} replies`} raw={overview.workspace.threads} />
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
                              <span className="funnel-fill-animated" style={{ width: `${Math.max(8, (source.visitors / max) * 100)}%` }} />
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
                <DonutChart
                  label="People mix"
                  segments={[
                    { label: "Trial", value: overview.accounts.trial, color: "var(--sage)" },
                    { label: "Paid", value: overview.accounts.paid, color: "var(--forest)" },
                    { label: "Expired", value: overview.accounts.expired, color: "var(--accent)" },
                    { label: "No access", value: overview.accounts.none, color: "var(--sand)" },
                  ]}
                />
                <DonutChart
                  label="Workspace mix"
                  segments={[
                    { label: "Screens", value: overview.workspace.runs, color: "var(--forest)" },
                    { label: "Threads", value: overview.workspace.threads, color: "var(--accent)" },
                    { label: "Replies", value: overview.workspace.replies, color: "var(--sage)" },
                  ]}
                />
              </div>

              <div className="admin-activity dash-in delay-3">
                <ActivityList
                  title="Latest people"
                  empty="No signups yet. New accounts from /signup appear here."
                  onViewAll={() => goTab("trials")}
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
                  onViewAll={() => goTab("leads")}
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
                  onViewAll={() => goTab("assessments")}
                  items={recentRuns.map((run) => ({
                    key: run.id,
                    title: assessmentTitle(run.assessmentId),
                    meta: `Participant result private · ${when(run.createdAt)}`,
                  }))}
                />
                <ActivityList
                  title="Latest threads"
                  empty="No community threads yet."
                  onViewAll={() => goTab("community")}
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
                  onViewAll={() => goBilling("bills")}
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
        <section className="admin-panel" data-testid="admin-leads">
          <div className="admin-card-head">
            <h2 className="admin-h2">Leads{leadsTotal > 0 ? ` (${leadsTotal})` : ""}</h2>
          </div>
          <form
            className="admin-moderation-tools admin-lead-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setLeadsPage(1);
              void loadLeads(1, leadsQuery, leadsType);
            }}
          >
            <input
              type="search"
              className="input"
              placeholder="Search name, email, phone, org"
              value={leadsQuery}
              onChange={(e) => setLeadsQuery(e.target.value)}
              aria-label="Search leads"
            />
            <select
              className="input"
              value={leadsType}
              onChange={(e) => {
                setLeadsType(e.target.value);
                setLeadsPage(1);
                void loadLeads(1, leadsQuery, e.target.value);
              }}
              aria-label="Filter leads by type"
            >
              <option value="">All types</option>
              <option value="discovery">Discovery</option>
              <option value="counselling">Counselling</option>
              <option value="popup">Popup</option>
            </select>
            <button type="submit" className="btn btn-secondary">
              Search
            </button>
          </form>
          {!leads ? (
            <div className="admin-skeleton" />
          ) : !leads.length ? (
            <p className="admin-empty">No leads match. Clear the search to see everything.</p>
          ) : (
            <>
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
              <div className="admin-pagination">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={leadsPage <= 1}
                  onClick={() => void loadLeads(leadsPage - 1, leadsQuery, leadsType)}
                >
                  ← Prev
                </button>
                <span className="meta">
                  Page {leadsPage} of {leadsPages} · {leadsTotal} total
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={leadsPage >= leadsPages}
                  onClick={() => void loadLeads(leadsPage + 1, leadsQuery, leadsType)}
                >
                  Next →
                </button>
              </div>
            </>
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
                    <th>Assessment</th>
                    <th>Privacy</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.runs.map((run) => (
                    <tr key={run.id}>
                      <td className="meta">{when(run.createdAt)}</td>
                      <td>{assessmentTitle(run.assessmentId)}</td>
                      <td className="meta">Individual result withheld</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "community" ? (
        <section className="admin-panel" data-testid="admin-community">
          <div className="admin-card-head">
            <h2 className="admin-h2">Community moderation {workspace ? `(${workspace.threads.length})` : ""}</h2>
          </div>
          <p className="lead admin-hint">
            Search threads, open one to read the full body and replies, then delete a thread or an individual reply.
            Deletes are permanent and flow to the app immediately. Banning happens on People.
          </p>
          <div className="admin-card admin-blocked-words">
            <div className="admin-card-head">
              <h3 className="admin-h2" style={{ fontSize: 18 }}>Blocked words</h3>
            </div>
            <p className="meta">Posts and replies containing these whole words are rejected. {blockedWords === null ? "Loading…" : `${blockedWords.length} word${blockedWords.length === 1 ? "" : "s"}.`}</p>
            {blockedWords && blockedWords.length ? (
              <div className="tag-row" style={{ marginTop: 8 }}>
                {blockedWords.map((word) => (
                  <span key={word} className="tag tag-static">
                    {word}
                    <button
                      type="button"
                      className="admin-text-btn"
                      aria-label={`Remove blocked word ${word}`}
                      onClick={() => void saveBlockedWords(blockedWords.filter((w) => w !== word))}
                      style={{ marginLeft: 6 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <form
              className="admin-blocked-form"
              onSubmit={(e) => {
                e.preventDefault();
                const word = newWord.trim().toLowerCase();
                if (!word || !blockedWords) return;
                if (blockedWords.includes(word)) {
                  setNewWord("");
                  return;
                }
                setNewWord("");
                void saveBlockedWords([...blockedWords, word]);
              }}
            >
              <input
                className="input"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Add a word"
                aria-label="Add a blocked word"
                maxLength={40}
              />
              <button type="submit" className="btn btn-secondary" disabled={!newWord.trim() || blockedWords === null}>
                Add
              </button>
            </form>
          </div>
          <div className="admin-moderation-tools">
            <input
              type="search"
              className="input"
              placeholder="Search title, body, author, or tag"
              value={communityQuery}
              onChange={(e) => setCommunityQuery(e.target.value)}
              aria-label="Search community threads"
            />
          </div>
          {!workspace ? (
            <div className="admin-skeleton" />
          ) : !workspace.threads.length ? (
            <p className="admin-empty">No community threads yet. Questions asked in the app appear here.</p>
          ) : filteredThreads.length === 0 ? (
            <p className="admin-empty">No threads match “{communityQuery}”. Clear the search to see everything.</p>
          ) : (
            <div className="admin-mod-grid">
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Thread</th>
                      <th>Author</th>
                      <th>Replies</th>
                      <th>Views</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredThreads.map((thread) => (
                      <tr key={thread.id} className={selectedThreadId === thread.id ? "is-selected" : undefined}>
                        <td>
                          <button
                            type="button"
                            className="admin-text-btn admin-thread-link"
                            onClick={() => void openThreadForModeration(thread.id)}
                          >
                            {thread.title}
                          </button>
                          {thread.body ? (
                            <p className="meta">{thread.body.slice(0, 120)}{thread.body.length > 120 ? "…" : ""}</p>
                          ) : null}
                          {thread.tags.length ? (
                            <p className="meta">{thread.tags.join(" · ")}</p>
                          ) : null}
                        </td>
                        <td>{thread.authorName}</td>
                        <td className="num">{thread.answerCount}</td>
                        <td className="num">{thread.views}</td>
                        <td className="admin-row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => void openThreadForModeration(thread.id)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={moderating === thread.id}
                            onClick={() => void removeThread(thread.id)}
                          >
                            {moderating === thread.id ? "Deleting…" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-card admin-thread-detail">
                {!selectedThreadId ? (
                  <p className="admin-empty">Select Open on a thread to read and moderate it here.</p>
                ) : !selectedThread ? (
                  <p className="meta">Loading thread…</p>
                ) : (
                  <>
                    <div className="admin-card-head">
                      <h3 className="admin-h2" style={{ fontSize: 20 }}>{selectedThread.title}</h3>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={moderating === selectedThread.id}
                        onClick={() => void removeThread(selectedThread.id)}
                      >
                        {moderating === selectedThread.id ? "Deleting…" : "Delete thread"}
                      </button>
                    </div>
                    <p className="meta">
                      {selectedThread.authorName} · {selectedThread.views} views ·{" "}
                      {selectedThread.createdAt ? when(selectedThread.createdAt) : "—"}
                    </p>
                    <p>{selectedThread.body}</p>
                    {selectedThread.tags.length ? (
                      <div className="tag-row">
                        {selectedThread.tags.map((tag) => (
                          <span key={tag} className="tag tag-static">{tag}</span>
                        ))}
                      </div>
                    ) : null}
                    <h4 className="admin-h2" style={{ fontSize: 18, marginTop: 16 }}>
                      Replies ({selectedThread.answers.length})
                    </h4>
                    {selectedThread.answers.length === 0 ? (
                      <p className="admin-empty">No replies yet.</p>
                    ) : (
                      <ul className="admin-activity-list">
                        {selectedThread.answers.map((answer) => (
                          <li key={answer.id}>
                            <div className="admin-activity-row">
                              <div>
                                <strong>{answer.authorName}</strong>
                                <p>{answer.body}</p>
                                <p className="meta">
                                  {answer.upvotes} upvotes · {when(answer.createdAt)}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={moderating === answer.id}
                                onClick={() => void removeAnswer(selectedThread.id, answer.id)}
                              >
                                {moderating === answer.id ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
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
                <h2 className="admin-h2">People ({visibleAccounts.length}{accounts && visibleAccounts.length !== accounts.length ? ` of ${accounts.length}` : ""})</h2>
              </div>
              <p className="lead admin-hint">
                Grant a trial, give complimentary access (₹0, Given by Admin, not revenue), revoke, or ban the app. Paid checkout still goes through Razorpay.
              </p>
              <div className="admin-moderation-tools">
                <input
                  type="search"
                  className="input"
                  placeholder="Search name, email, city, org"
                  value={peopleQuery}
                  onChange={(e) => setPeopleQuery(e.target.value)}
                  aria-label="Search people"
                />
              </div>
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
                    {visibleAccounts.map((row) => (
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
                          <span className="admin-pill">{row.banned ? "banned" : row.access.status}</span>
                          {row.banned && row.banReason ? (
                            <>
                              <br />
                              <span className="meta">{row.banReason}</span>
                            </>
                          ) : null}
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
                            Give access
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => void setAccess(row.id, "revoke")}>
                            Revoke
                          </button>
                          {row.banned ? (
                            <button type="button" className="btn btn-ghost" onClick={() => void setBanned(row.id, false)}>
                              Unban
                            </button>
                          ) : (
                            <button type="button" className="btn btn-ghost" onClick={() => void setBanned(row.id, true)}>
                              Ban
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!visibleAccounts.length ? <p className="admin-empty">{accounts.length ? "No people match that search." : "No customer accounts yet. Signups from the trial form appear here."}</p> : null}
            </>
          )}
        </section>
      ) : null}

      {tab === "billing" ? (
        <BillingModule
          key={`${billingTick}-${billingView}`}
          view={billingView}
          onNavigate={(view) => goBilling(view)}
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
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, hint, raw }: { label: string; value: string; hint: string; raw?: number }) {
  return (
    <div className="admin-stat">
      <p className="meta">{label}</p>
      <p className="num admin-big">{raw != null ? <CountUp value={raw} format={(n) => fmt(Math.round(n))} /> : value}</p>
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
