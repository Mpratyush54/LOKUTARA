"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AccessSnapshot } from "@/lib/access/billing";

export type AppAccount = {
  id: string;
  email: string;
  name: string;
  seats: number;
  createdAt: string;
  access: AccessSnapshot;
};

const NAV = [
  { href: "/app", label: "Home", match: (path: string) => path === "/app" },
  { href: "/app/assessments", label: "Assessments", match: (path: string) => path.startsWith("/app/assessments") },
  { href: "/app/community", label: "Community", match: (path: string) => path.startsWith("/app/community") },
  { href: "/app/account", label: "Account", match: (path: string) => path.startsWith("/app/account") },
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

  async function logout() {
    await jsonFetch("/api/auth/logout", { method: "POST" });
    setAccount(null);
    window.location.href = "/login";
  }

  if (!ready) {
    return (
      <div className="app-shell">
        <div className="app-skeleton" aria-busy="true">
          Loading workspace…
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

  if (!account.access.canEnterApp) {
    return (
      <div className="app-shell app-gate-wrap">
        <PaywallCard
          title={account.access.status === "expired" ? "Your trial has ended" : "Start a trial to open the dashboard"}
          copy="One product, one paywall. Ask the founder to grant a trial or convert you to paid — modules stay inside this same dashboard."
          status={account.access.status}
          email={account.email}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`app-sidebar${menuOpen ? " is-open" : ""}`}>
        <div className="app-brand">
          <Link href="/app">Lokutara</Link>
          <p className="meta">One product</p>
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
          <p className="meta">{account.name}</p>
          <p className="meta app-plan-pill">{account.access.status}</p>
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-mobile-bar">
          <button type="button" className="app-menu-btn" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            Menu
          </button>
          <Link href="/app" className="logo">
            Lokutara
          </Link>
          <span className="meta app-plan-pill">{account.access.status}</span>
        </header>
        {menuOpen ? <button type="button" className="app-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}
        <div className="app-content">{children}</div>
      </div>
    </div>
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
        <Link className="btn btn-primary" href="/signup">
          Start free trial
        </Link>
        <Link className="btn btn-secondary" href="/login">
          Sign in
        </Link>
        <a className="btn btn-ghost" href="/#contact">
          Talk to founder
        </a>
      </div>
    </section>
  );
}

export { jsonFetch };
