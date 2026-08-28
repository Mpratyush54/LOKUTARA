"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AppAccount } from "./AppShell";
import { jsonFetch, useAppAccount } from "./AppShell";
import { GENDER_OPTIONS } from "@/lib/access/profile";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  gender: "",
  age: "",
  city: "",
};

export function AccountPanel() {
  const fromShell = useAppAccount();
  const [account, setAccount] = useState<AppAccount | null>(fromShell);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function applyAccount(next: AppAccount) {
    setAccount(next);
    setForm({
      name: next.name ?? "",
      email: next.email ?? "",
      phone: next.phone ?? "",
      gender: next.gender ?? "",
      age: next.age != null ? String(next.age) : "",
      city: next.city ?? "",
    });
  }

  useEffect(() => {
    if (fromShell) {
      applyAccount(fromShell);
      return;
    }
    void (async () => {
      const { res, body } = await jsonFetch("/api/auth/me");
      if (res.ok) applyAccount(body.account);
    })();
  }, [fromShell]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const { res, body } = await jsonFetch("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone,
        gender: form.gender,
        age: form.age === "" ? null : Number(form.age),
        city: form.city,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(body.message || "Could not save profile");
      return;
    }
    applyAccount(body.account as AppAccount);
    setSaved(true);
  }

  if (!account) {
    return <div className="app-skeleton app-skeleton-hero" aria-busy="true" data-testid="account-skeleton" />;
  }

  return (
    <section className="module-stack">
      <p className="eyebrow">Account</p>
      <h1>{account.name}</h1>
      <p className="lead">
        Identity for workshop conversations. Email is the one you signed up with — you can update it here. Billing
        stays in the founder admin console.
      </p>
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
        <div>
          <dt>Community role</dt>
          <dd>{account.communityRole ?? "student"}</dd>
        </div>
      </dl>

      <form className="profile-form" onSubmit={(ev) => void onSubmit(ev)}>
        <h2 className="admin-h2">Psychometric identity</h2>
        <p className="meta">
          Used as context for conversation tools in this dashboard. Not a licensed psychometric profile and not shared
          as a diagnostic.
        </p>
        <label className="admin-field">
          <span className="meta">Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            autoComplete="name"
            required
          />
        </label>
        <label className="admin-field">
          <span className="meta">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            autoComplete="email"
            required
          />
        </label>
        <div className="profile-grid">
          <label className="admin-field">
            <span className="meta">Phone</span>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              autoComplete="tel"
              placeholder="8–15 digits"
            />
          </label>
          <label className="admin-field">
            <span className="meta">Age</span>
            <input
              type="number"
              inputMode="numeric"
              min={13}
              max={120}
              value={form.age}
              onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
            />
          </label>
        </div>
        <div className="profile-grid">
          <label className="admin-field">
            <span className="meta">Gender</span>
            <select
              value={form.gender}
              onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
              aria-label="Gender"
            >
              <option value="">Prefer not to add</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span className="meta">City</span>
            <input
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              autoComplete="address-level2"
            />
          </label>
        </div>
        {error ? <p className="app-error">{error}</p> : null}
        {saved ? <p className="meta profile-saved">Saved to this workspace.</p> : null}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
      <p className="meta">
        Billing is managed by the founder in the admin console. There is no separate Forum or Competency checkout.
      </p>
    </section>
  );
}
