"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { jsonFetch } from "@/components/app/AppShell";
import { showAppToast } from "@/components/app/AppToast";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [password, setPassword] = useState("");
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    const payload = isSignup
      ? {
          name,
          email,
          phone,
          age: Number(age),
          city,
          organisation: organisation.trim() || undefined,
          password,
          acceptLegal,
        }
      : { email, password };
    const { res, body } = await jsonFetch(isSignup ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      showAppToast(body.message || "Could not sign in. Check your details and try again.");
      return;
    }
    window.location.href = "/app";
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Lokutara</p>
        <h1>{isSignup ? "Start a trial" : "Sign in"}</h1>
        <p className="lead">
          {isSignup
            ? "Tell us who you are so we can set up assessments, community, and your workspace."
            : "One login for assessments, community, and your workspace. Not three products."}
        </p>
        {isSignup ? (
          <>
            <div className="field">
              <label htmlFor="auth-name">Name</label>
              <input
                className="input"
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
              />
            </div>
            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input
                className="input"
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="auth-phone">Phone</label>
                <input
                  className="input"
                  id="auth-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                  minLength={8}
                />
              </div>
              <div className="field">
                <label htmlFor="auth-age">Age</label>
                <input
                  className="input"
                  id="auth-age"
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="auth-city">City</label>
                <input
                  className="input"
                  id="auth-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  autoComplete="address-level2"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </div>
              <div className="field">
                <label htmlFor="auth-org">Organisation</label>
                <input
                  className="input"
                  id="auth-org"
                  value={organisation}
                  onChange={(e) => setOrganisation(e.target.value)}
                  autoComplete="organization"
                  maxLength={120}
                  placeholder="Optional"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              className="input"
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-password">Password</label>
          <input
            className="input"
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </div>
        {isSignup ? (
          <label className="legal-check">
            <input
              type="checkbox"
              checked={acceptLegal}
              onChange={(event) => setAcceptLegal(event.target.checked)}
              required
            />
            <span>
              I am 18 or older, accept the <Link href="/terms">Terms</Link>, and
              acknowledge the <Link href="/privacy">Privacy Notice</Link>. I understand
              that the assessment screens are developmental, not diagnostic.
            </span>
          </label>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Working…" : isSignup ? "Create account" : "Open dashboard"}
        </button>
        <p className="meta">
          {isSignup ? (
            <>
              Already have access? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/signup">Start a free trial</Link>
            </>
          )}
        </p>
        <p className="meta">
          <Link href="/">Back to the public site</Link>
        </p>
      </form>
    </main>
  );
}
