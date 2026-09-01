"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AccessSnapshot } from "@/lib/access/billing";
import { CheckoutButton } from "./CheckoutButton";

export type AppAccount = {
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

const NAV = [
  { href: "/app", label: "Dashboard", match: (path: string) => path === "/app" },
  { href: "/app/assessments", label: "Assessments", match: (path: string) => path.startsWith("/app/assessments") },
  { href: "/app/community", label: "Community", match: (path: string) => path.startsWith("/app/community") },
  { href: "/app/billing", label: "Billing", match: (path: string) => path.startsWith("/app/billing") },
  { href: "/app/account", label: "Profile", match: (path: string) => path.startsWith("/app/account") },
] as const;

async function jsonFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

const AppAccountContext = createContext<AppAccount | null>(null);
const AppAccountSetterContext = createContext<(account: AppAccount) => void>(() => {});

export function useAppAccount() {
  return useContext(AppAccountContext);
}

export function useSetAppAccount() {
  return useContext(AppAccountSetterContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadMe = useCallback(async () => {
    const { res, body } = await jsonFetch("/api/auth/me");
    setAccount(res.ok ? (body.account as AppAccount) : null);
    setReady(true);
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    document.body.classList.toggle("app-nav-open", menuOpen);
    return () => document.body.classList.remove("app-nav-open");
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function logout() {
    await jsonFetch("/api/auth/logout", { method: "POST" });
    setAccount(null);
    window.location.href = "/login";
  }

  if (!ready) {
    return (
      <div className="app-shell" data-testid="app-skeleton" aria-busy="true">
        <aside className="app-sidebar" aria-hidden="true" />
        <div className="app-main">
          <div className="app-content">
            <div className="app-skeleton app-skeleton-hero" />
            <div className="dash-stats">
              <div className="app-skeleton app-skeleton-stat" />
              <div className="app-skeleton app-skeleton-stat" />
              <div className="app-skeleton app-skeleton-stat" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="app-shell app-gate-wrap">
        <PaywallCard
          title="This product is behind a login"
          copy="Assessments, community, and your Lokutara tools live in one dashboard. Sign in or start a trial — there is no separate tests site or forum site."
          status="none"
        />
      </div>
    );
  }

  if (!account.access.canEnterApp && pathname !== "/app/billing") {
    return (
      <div className="app-shell app-gate-wrap">
        <PaywallCard
          title={account.access.status === "expired" ? "Your trial has ended" : "Start a trial to open the dashboard"}
          copy={
            account.access.status === "expired"
              ? "Pay for 12 months of workspace access to keep assessments, reports, and community. You can pay here."
              : "One product, one paywall. Start a trial from signup, or pay now for 12 months of access."
          }
          status={account.access.status}
          email={account.email}
        />
      </div>
    );
  }

  return (
    <AppAccountSetterContext.Provider value={setAccount}>
    <AppAccountContext.Provider value={account}>
      <div className="app-shell">
        <aside id="app-sidebar" className={`app-sidebar${menuOpen ? " is-open" : ""}`}>
          <div className="app-brand">
            <Link href="/app">Lokutara</Link>
            <p className="meta">Workspace</p>
          </div>
          <nav aria-label="Product">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.match(pathname) ? "is-current" : undefined}
                aria-current={item.match(pathname) ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="app-sidebar-foot">
            <p className="app-user-name">{account.name}</p>
            <p className="meta app-plan-pill">{account.access.status}</p>
            <p className="meta">
              <Link href="/privacy">Privacy</Link>
              {" · "}
              <Link href="/safeguards">Safeguards</Link>
            </p>
            <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </aside>
        <div className="app-main">
          <header className="app-mobile-bar">
            <button
              type="button"
              className={`nav-toggle app-menu-btn${menuOpen ? " is-open" : ""}`}
              aria-expanded={menuOpen}
              aria-controls="app-sidebar"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
            <Link href="/app" className="logo">
              Lokutara
            </Link>
            <span className="meta app-plan-pill">{account.access.status}</span>
          </header>
          {menuOpen ? <button type="button" className="app-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}
          {account.access.status === "trial" ? (
            <UpgradeBanner daysLeft={account.access.daysLeft} />
          ) : null}
          <div className="app-content">{children}</div>
        </div>
      </div>
    </AppAccountContext.Provider>
    </AppAccountSetterContext.Provider>
  );
}

export function PaywallCard({
  title,
  copy,
  status,
  email,
}: {
  title: string;
  copy: string;
  status: string;
  email?: string;
}) {
  return (
    <section className="paywall-card" data-testid="paywall">
      <p className="eyebrow">Paywall</p>
      <h1>{title}</h1>
      <p className="lead">{copy}</p>
      {email ? <p className="meta">Signed in as {email} · {status}</p> : null}
      <div className="paywall-actions">
        {email ? (
          <>
            <CheckoutButton sku="app_access">Upgrade now</CheckoutButton>
            <Link className="btn btn-secondary" href="/app/billing">
              See plans
            </Link>
            <a className="btn btn-ghost" href="/#contact">
              Get in touch
            </a>
          </>
        ) : (
          <>
            <Link className="btn btn-primary" href="/signup">
              Start free trial
            </Link>
            <Link className="btn btn-secondary" href="/login">
              Sign in
            </Link>
            <a className="btn btn-ghost" href="/#contact">
              Get in touch
            </a>
          </>
        )}
      </div>
    </section>
  );
}

function UpgradeBanner({ daysLeft }: { daysLeft: number | null }) {
  const days = daysLeft ?? 0;
  const copy =
    days <= 1
      ? "Your trial ends today. Upgrade to keep assessments, reports, and community."
      : `${days} days left on your trial. Upgrade to keep assessments, reports, and community after it ends.`;
  return (
    <div className="upgrade-banner" data-testid="upgrade-banner" role="status">
      <p>{copy}</p>
      <div className="upgrade-banner-actions">
        <CheckoutButton sku="app_access">Upgrade now</CheckoutButton>
        <Link className="btn btn-ghost" href="/app/billing">
          See plans
        </Link>
      </div>
    </div>
  );
}

export { jsonFetch };
