"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LOCAL_ASSESSMENTS, relativeDay } from "@/lib/product/workspace";
import { jsonFetch, useAppAccount } from "@/components/app/AppShell";
import { showAppToast } from "@/components/app/AppToast";

type HomePayload = {
  runs: Array<{ id: string; assessmentId: string; title?: string; score: number; createdAt: string }>;
  threadCount: number;
  recentThreads: Array<{ id: string; title: string; answerCount: number; createdAt?: string }>;
};

function titleFor(id: string) {
  return LOCAL_ASSESSMENTS.find((item) => item.id === id)?.title ?? id;
}

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function AppHome() {
  const account = useAppAccount();
  const [data, setData] = useState<HomePayload | null>(null);

  useEffect(() => {
    void (async () => {
      const { res, body } = await jsonFetch("/api/workspace/home");
      if (!res.ok) {
        showAppToast(body.message || "Could not load your workspace. Try again in a moment.");
        setData({ runs: [], threadCount: 0, recentThreads: [] });
        return;
      }
      setData(body as HomePayload);
    })();
  }, []);

  const taken = useMemo(() => new Set((data?.runs || []).map((run) => run.assessmentId)), [data]);
  const nextAssessment = LOCAL_ASSESSMENTS.find((item) => !taken.has(item.id)) ?? LOCAL_ASSESSMENTS[0];
  const finishedAll = LOCAL_ASSESSMENTS.every((item) => taken.has(item.id));
  const lastRun = data?.runs[0];

  if (!data) {
    return (
      <div className="dash-home" aria-busy="true" data-testid="home-skeleton">
        <div className="app-skeleton app-skeleton-hero" />
        <div className="dash-layout">
          <div className="app-skeleton app-skeleton-card" />
          <div className="app-skeleton app-skeleton-card" />
        </div>
      </div>
    );
  }

  const days = account?.access.daysLeft;
  const firstName = account?.name?.split(" ")[0] || "there";
  const planLabel =
    account?.access.status === "trial" && days != null
      ? `${days} day${days === 1 ? "" : "s"} left`
      : account?.access.status === "paid"
        ? "Paid"
        : "Trial";

  const briefTitle = finishedAll
    ? "You have finished the catalog"
    : lastRun
      ? `Next: ${nextAssessment.title}`
      : `Start with ${nextAssessment.title}`;
  const briefCopy = finishedAll
    ? "Open a report, or ask the community a follow-up from a workshop."
    : nextAssessment.copy;
  const briefHref = finishedAll
    ? lastRun
      ? `/app/assessments/runs/${lastRun.id}`
      : "/app/assessments"
    : `/app/assessments/${nextAssessment.id}`;
  const briefCta = finishedAll ? "View report" : lastRun ? "Continue" : "Start now";

  return (
    <div className="dash-home">
      <header className="dash-top dash-in">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>
            {greeting()}, {firstName}
          </h1>
          <p className="lead">
            {account?.city ? `${account.city}. ` : null}
            {account?.organisation ? `${account.organisation}. ` : null}
            {data?.runs.length
              ? `${data.runs.length} screen${data.runs.length === 1 ? "" : "s"} on file.`
              : "Take a screen, then ask a question if you want a second view."}
          </p>
        </div>
        <div className="dash-top-meta">
          <span className="app-plan-pill">{planLabel}</span>
          {account?.email ? <p className="meta">{account.email}</p> : null}
        </div>
      </header>

      <section className="dash-brief dash-in delay-1">
        <div>
          <p className="eyebrow">{finishedAll ? "Caught up" : lastRun ? "Continue" : "Start here"}</p>
          <h2>{briefTitle}</h2>
          <p>{briefCopy}</p>
          {!finishedAll ? <p className="meta">{nextAssessment.duration} · {nextAssessment.items.length} items</p> : null}
        </div>
        <div className="dash-brief-actions">
          <Link className="btn btn-primary" href={briefHref}>
            {briefCta}
          </Link>
          <Link className="btn btn-secondary" href="/app/community/ask">
            Ask a question
          </Link>
        </div>
      </section>

      <div className="dash-layout">
        <section className="dash-panel dash-in delay-2">
          <div className="dash-panel-head">
            <h2>Recent screens</h2>
            <Link href="/app/assessments">All assessments</Link>
          </div>
          {data?.runs.length ? (
            <ul className="dash-runs">
              {data.runs.map((run) => (
                <li key={run.id}>
                  <Link href={`/app/assessments/runs/${run.id}`} className="dash-run">
                    <div>
                      <strong>{run.title || titleFor(run.assessmentId)}</strong>
                      <p className="meta">{relativeDay(run.createdAt)} · View report</p>
                    </div>
                    <div className="dash-run-score">
                      <span className="dash-run-track" aria-hidden="true">
                        <span style={{ width: `${Math.max(8, run.score)}%` }} />
                      </span>
                      <span className="num">{run.score}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-empty">
              No screens yet. Start with {nextAssessment.title} — {nextAssessment.duration}.
            </p>
          )}
        </section>

        <section className="dash-panel dash-in delay-3">
          <div className="dash-panel-head">
            <h2>Community</h2>
            <Link href="/app/community">Open feed</Link>
          </div>
          {data?.recentThreads.length ? (
            <ul className="dash-threads">
              {data.recentThreads.map((thread) => (
                <li key={thread.id}>
                  <Link href={`/app/community/${thread.id}`} className="dash-thread">
                    <strong>{thread.title}</strong>
                    <p className="meta">
                      {thread.answerCount} {thread.answerCount === 1 ? "reply" : "replies"}
                      {thread.createdAt ? ` · ${relativeDay(thread.createdAt)}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-empty">No threads yet. Ask one after a session — it stays in this workspace.</p>
          )}
        </section>
      </div>
    </div>
  );
}
