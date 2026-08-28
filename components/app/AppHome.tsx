"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { jsonFetch } from "@/components/app/AppShell";

export function AppHome() {
  const [data, setData] = useState<{
    runs: Array<{ id: string; assessmentId: string; score: number }>;
    threadCount: number;
    recentThreads: Array<{ id: string; title: string; answerCount: number }>;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const { res, body } = await jsonFetch("/api/workspace/home");
      if (res.ok) setData(body);
    })();
  }, []);

  return (
    <div className="module-stack">
      <header>
        <p className="eyebrow">Workspace</p>
        <h1>Your Lokutara dashboard</h1>
        <p className="lead">
          Assessments, community, and account live here as modules. There is no second tests site and no second forum site.
        </p>
      </header>
      <div className="module-grid">
        <Link href="/app/assessments" className="module-card">
          <p className="eyebrow">Measure</p>
          <h2>Assessments</h2>
          <p>Run the OCEAN and placement screens. Last score {data?.runs[0]?.score ?? "—"}.</p>
        </Link>
        <Link href="/app/community" className="module-card">
          <p className="eyebrow">Connect</p>
          <h2>Community</h2>
          <p>{data?.threadCount ?? 0} threads in this workspace.</p>
        </Link>
        <Link href="/app/account" className="module-card">
          <p className="eyebrow">Billing</p>
          <h2>Account</h2>
          <p>Trial, paid access, and which modules you can open.</p>
        </Link>
      </div>
      {data?.recentThreads.length ? (
        <section>
          <h2 className="admin-h2">Recent threads</h2>
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
        </section>
      ) : null}
    </div>
  );
}
