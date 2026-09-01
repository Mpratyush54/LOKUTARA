"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AppAccount } from "./AppShell";
import { jsonFetch, useAppAccount, useSetAppAccount } from "./AppShell";
import { CheckoutButton } from "./CheckoutButton";
import { showAppToast } from "./AppToast";

export function AccountPanel() {
  const fromShell = useAppAccount();
  const setShell = useSetAppAccount();
  const [fetched, setFetched] = useState<AppAccount | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const account = fromShell ?? fetched;

  useEffect(() => {
    if (fromShell) return;
    void (async () => {
      const { res, body } = await jsonFetch("/api/auth/me");
      if (res.ok) setFetched(body.account);
      else setMissing(true);
    })();
  }, [fromShell]);

  useEffect(() => {
    if (!account || hydrated) return;
    setName(account.name || "");
    setPhone(account.phone || "");
    setAge(account.age != null ? String(account.age) : "");
    setCity(account.city || "");
    setOrganisation(account.organisation || "");
    if (!account.phone || !account.city || account.age == null) setEditing(true);
    setHydrated(true);
  }, [account, hydrated]);

  async function onSave(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    const { res, body } = await jsonFetch("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({
        name,
        phone,
        age: Number(age),
        city,
        organisation: organisation.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showAppToast(body.message || "Could not save profile. Try again in a moment.");
      return;
    }
    const next = body.account as AppAccount;
    setFetched(next);
    setShell(next);
    setEditing(false);
  }

  async function onDelete(ev: FormEvent) {
    ev.preventDefault();
    if (!window.confirm("Delete your account, assessment answers, and reports? This cannot be undone.")) {
      return;
    }
    setDeleting(true);
    const { res, body } = await jsonFetch("/api/auth/me", {
      method: "DELETE",
      body: JSON.stringify({ password: deletePassword }),
    });
    setDeleting(false);
    if (!res.ok) {
      showAppToast(body.message || "Could not delete the account.");
      return;
    }
    window.location.href = "/";
  }

  if (missing) {
    return (
      <p className="lead">
        Could not load your profile. <a href="/login">Sign in again</a>.
      </p>
    );
  }

  if (!account) {
    return <div className="app-skeleton app-skeleton-hero" aria-busy="true" data-testid="account-skeleton" />;
  }

  const initial = (account.name || "?").trim().charAt(0).toUpperCase();

  return (
    <section className="module-stack profile-page">
      <header className="profile-hero dash-in">
        <div className="profile-avatar" aria-hidden="true">
          {initial}
        </div>
        <div>
          <p className="eyebrow">Profile</p>
          <h1>{account.name}</h1>
          <p className="lead">{account.email}</p>
        </div>
      </header>

      {editing ? (
        <form className="profile-card dash-in delay-1" onSubmit={onSave}>
          <div className="profile-card-head">
            <h2>Your details</h2>
            <p className="meta">Name, phone, age, city, and organisation used on this account.</p>
          </div>
          <div className="field">
            <label htmlFor="profile-name">Name</label>
            <input className="input" id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="profile-phone">Phone</label>
              <input className="input" id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={8} />
            </div>
            <div className="field">
              <label htmlFor="profile-age">Age</label>
              <input className="input" id="profile-age" type="number" min={18} max={120} value={age} onChange={(e) => setAge(e.target.value)} required />
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="profile-city">City</label>
              <input className="input" id="profile-city" value={city} onChange={(e) => setCity(e.target.value)} required minLength={2} />
            </div>
            <div className="field">
              <label htmlFor="profile-org">Organisation</label>
              <input className="input" id="profile-org" value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="paywall-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
            {account.phone && account.city && account.age != null ? (
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="profile-card dash-in delay-1">
          <div className="profile-card-head">
            <h2>Your details</h2>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
          <dl className="account-dl">
            <div>
              <dt>Phone</dt>
              <dd>{account.phone || "—"}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{account.age ?? "—"}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{account.city || "—"}</dd>
            </div>
            <div>
              <dt>Organisation</dt>
              <dd>{account.organisation || "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="profile-card dash-in delay-2">
        <div className="profile-card-head">
          <h2>Access</h2>
          {account.access.status !== "paid" ? (
            <CheckoutButton sku="app_access">Upgrade now</CheckoutButton>
          ) : null}
        </div>
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
            <dt>Assessments</dt>
            <dd>{account.access.modules.assessments ? "Included" : "Locked"}</dd>
          </div>
          <div>
            <dt>Community</dt>
            <dd>{account.access.modules.community ? "Included" : "Locked"}</dd>
          </div>
        </dl>
        {account.access.status !== "paid" ? (
          <p className="meta access-note">
            12 months of workspace access. Pay from here or open{" "}
            <a href="/app/billing">Billing</a>.
          </p>
        ) : null}
      </div>

      <div className="profile-card dash-in delay-3">
        <div className="profile-card-head">
          <div>
            <h2>Your data</h2>
            <p className="meta">
              Download your account, assessment, community, and linked invoice records.
            </p>
          </div>
          <a className="btn btn-secondary" href="/api/auth/data-export" download>
            Export JSON
          </a>
        </div>
        <form onSubmit={onDelete}>
          <p className="meta">
            Deleting removes your account and assessment records and anonymises your
            community authorship. Statutory invoice, security, dispute, or legal-hold
            records may remain restricted for the required period.
          </p>
          <div className="field">
            <label htmlFor="delete-password">Current password</label>
            <input
              className="input"
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              minLength={8}
            />
          </div>
          <button
            type="submit"
            className="btn btn-secondary"
            disabled={deleting || deletePassword.length < 8}
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </form>
      </div>
    </section>
  );
}
