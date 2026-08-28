"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { jsonFetch } from "@/components/app/AppShell";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const { res, body } = await jsonFetch(isSignup ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(body.message || "Could not sign in");
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
          One login for assessments, community, and your workspace. Not three products.
        </p>
        {isSignup ? (
          <label className="admin-field">
            <span className="meta">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
        ) : null}
        <label className="admin-field">
          <span className="meta">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label className="admin-field">
          <span className="meta">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>
        {error ? <p className="app-error">{error}</p> : null}
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
