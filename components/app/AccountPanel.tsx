"use client";

import { useEffect, useState } from "react";
import type { AppAccount } from "./AppShell";
import { jsonFetch } from "./AppShell";

export function AccountPanel() {
  const [account, setAccount] = useState<AppAccount | null>(null);

  useEffect(() => {
    void (async () => {
      const { res, body } = await jsonFetch("/api/auth/me");
      if (res.ok) setAccount(body.account);
    })();
  }, []);

  if (!account) return <p className="meta">Loading account…</p>;

  return (
    <section className="module-stack">
      <p className="eyebrow">Account</p>
      <h1>{account.name}</h1>
      <p className="lead">{account.email}</p>
      <dl className="account-dl">
        <div>
          <dt>Status</dt>
          <dd className="app-plan-pill">{account.access.status}</dd>
        </div>
        <div>
          <dt>Trial ends</dt>
          <dd>{account.access.trialEndsAt ? new Date(account.access.trialEndsAt).toLocaleDateString("en-IN") : "—"}</dd>
        </div>
        <div>
          <dt>Days left</dt>
          <dd>{account.access.daysLeft ?? "—"}</dd>
        </div>
        <div>
          <dt>Seats</dt>
          <dd>{account.seats}</dd>
        </div>
        <div>
          <dt>Assessments</dt>
          <dd>{account.access.modules.assessments ? "Included" : "Locked"}</dd>
        </div>
        <div>
          <dt>Community</dt>
          <dd>{account.access.modules.community ? "Included" : "Locked"}</dd>
        </div>
      </dl>
      <p className="meta">
        Billing is managed by the founder in the admin console. There is no separate Forum or Competency checkout.
      </p>
    </section>
  );
}
