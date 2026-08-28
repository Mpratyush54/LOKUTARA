"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LOCAL_ASSESSMENTS } from "@/lib/product/workspace";
import { jsonFetch, useAppAccount } from "@/components/app/AppShell";

type HomePayload = {
  runs: Array<{ id: string; assessmentId: string; score: number; createdAt: string }>;
  threadCount: number;
  recentThreads: Array<{ id: string; title: string; answerCount: number }>;
};

function titleFor(id: string) {
  return LOCAL_ASSESSMENTS.find((item) => item.id === id)?.title ?? id;
}

const FIRST_ASSESSMENT = LOCAL_ASSESSMENTS.find((item) => item.recommended)?.id ?? "psychology";

export function AppHome() {
  const account = useAppAccount();
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { res, body } = await jsonFetch("/api/workspace/home");
      if (!res.ok) {
        setError(body.message || "Could not load your workspace");
        return;
      }
      setData(body as HomePayload);
    })();
  }, []);

  if (!data && !error) {
    return (
      <div className="module-stack" aria-busy="true" data-testid="home-skeleton">
        <div className="app-skeleton app-skeleton-hero" />
        <div className="dash-stats">
          <div className="app-skeleton app-skeleton-stat" />
          <div className="app-skeleton app-skeleton-stat" />
          <div className="app-skeleton app-skeleton-stat" />
          <div className="app-skeleton app-skeleton-stat" />
        </div>
        <div className="module-grid">
          <div className="app-skeleton app-skeleton-card" />
          <div className="app-skeleton app-skeleton-card" />
          <div className="app-skeleton app-skeleton-card" />
        </div>
      </div>
    );
  }

  const lastRun = data?.runs[0];
  const days = account?.access.daysLeft;
  const firstName = account?.name?.split(" ")[0] || "there";
  const planLine =
    account?.access.status === "trial" && days != null
      ? `${days} day${days === 1 ? "" : "s"} left on trial`
      : account?.access.status === "paid"
        ? "Paid access"
        : account?.access.status ?? "Trial";

  return (
    <div className="module-stack dash-home">
      <header className="dash-in">
        <p className="eyebrow">Workspace</p>
        <h1>Hello, {firstName}</h1>
        <p className="lead">
          Assessments and community sit in this one dashboard. {planLine}.
        </p>
      </header>

      {error ? <p className="app-error">{error}</p> : null}

      <div className="dash-stats dash-in delay-1">
        <div className="folio-stat">
          <p className="meta">Screens taken</p>
          <p className="num folio-num">{data?.runs.length ?? 0}</p>
        </div>
        <div className="folio-stat">
          <p className="meta">Last score</p>
          {lastRun ? (
            <p className="num folio-num">
              <Link href={`/app/assessments/${lastRun.assessmentId}/results?run=${lastRun.id}`}>{lastRun.score}</Link>
            </p>
          ) : (
            <p className="num folio-num">—</p>
          )}
        </div>
        <div className="folio-stat">
          <p className="meta">Threads</p>
          <p className="num folio-num">{data?.threadCount ?? 0}</p>
        </div>
        <div className="folio-stat">
          <p className="meta">Plan</p>
          <p className="folio-plan">{planLine}</p>
        </div>
      </div>

      {data?.runs.length ? (
        <div className="score-ruler dash-in delay-2" aria-label="Recent scores">
          {data.runs
            .slice()
            .reverse()
            .map((run) => (
              <span key={run.id} className="score-tick" style={{ height: `${Math.max(12, run.score)}%` }} title={`${titleFor(run.assessmentId)} · ${run.score}`} />
            ))}
        </div>
      ) : null}

      <div className="module-grid">
        <Link href="/app/assessments" className="module-card folio-card dash-in delay-2">
          <p className="eyebrow">Measure</p>
          <h2>Assessments</h2>
          <p>
            {lastRun
              ? `Last run: ${titleFor(lastRun.assessmentId)} scored ${lastRun.score}. Open the sketch anytime.`
              : "Start with a workshop screen. Results stay in this workspace."}
          </p>
          <span className="folio-cta">{lastRun ? "Open catalog and results" : "Take first screen"}</span>
        </Link>
        <Link href="/app/community" className="module-card folio-card dash-in delay-3">
          <p className="eyebrow">Connect</p>
          <h2>Community</h2>
          <p>
            {data?.threadCount
              ? `${data.threadCount} thread${data.threadCount === 1 ? "" : "s"} in this workspace.`
              : "Ask a question after a workshop. Same login, same product."}
          </p>
          <span className="folio-cta">{data?.threadCount ? "Browse threads" : "Open community"}</span>
        </Link>
        <Link href="/app/account" className="module-card folio-card dash-in delay-4">
          <p className="eyebrow">Billing</p>
          <h2>Account</h2>
          <p>Trial, paid access, and psychometric identity (phone, email, gender, age, city).</p>
          <span className="folio-cta">View access</span>
        </Link>
      </div>

      <section className="dash-next dash-in delay-3">
        <h2 className="admin-h2">Next step</h2>
        <div className="dash-next-row">
          <Link className="btn btn-primary" href={lastRun ? "/app/assessments" : `/app/assessments/${FIRST_ASSESSMENT}`}>
            {lastRun ? "Run another assessment" : `Start ${titleFor(FIRST_ASSESSMENT)}`}
          </Link>
          <Link className="btn btn-secondary" href="/app/community/ask">
            Ask the community
          </Link>
        </div>
      </section>

      <section className="dash-in delay-4">
        <h2 className="admin-h2">Recent threads</h2>
        {data?.recentThreads.length ? (
          <ul className="thread-list">
            {data.recentThreads.map((thread) => (
              <li key={thread.id}>
                <Link href={`/app/community/${thread.id}`} className="thread-card">
                  <h2>{thread.title}</h2>
                  <p className="meta">{thread.answerCount} replies</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="product-empty">
            No threads yet. Ask one question after a session — it stays in this dashboard, not a second forum.
          </p>
        )}
      </section>
    </div>
  );
}
