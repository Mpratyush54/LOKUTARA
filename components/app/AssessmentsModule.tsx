"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AssessmentItem, LocalAssessment, RankItem, StoredAnswer } from "@/lib/product/workspace";
import { jsonFetch } from "./AppShell";

type CatalogItem = {
  id: string;
  title: string;
  duration: string;
  copy: string;
  itemCount: number;
  level: string;
  track: "psychology" | "placement";
  recommended: boolean;
  kind: "mcq" | "rank";
};

type Run = { id: string; assessmentId: string; score: number; createdAt: string };

export function AssessmentsCatalog() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState<"all" | "psychology" | "placement">("all");
  const [tab, setTab] = useState<"recommended" | "all">("all");

  useEffect(() => {
    void (async () => {
      const { res, body } = await jsonFetch("/api/workspace/assessments");
      if (res.status === 402) {
        setError("This module is not on your plan.");
        setReady(true);
        return;
      }
      if (!res.ok) {
        setError(body.message || "Could not load assessments");
        setReady(true);
        return;
      }
      setItems(body.assessments || []);
      setRuns(body.runs || []);
      setReady(true);
    })();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const hay = `${item.title} ${item.copy}`.toLowerCase();
      const matchesSearch = !search || hay.includes(search.toLowerCase());
      const matchesTrack = track === "all" || item.track === track;
      const matchesTab = tab === "all" || item.recommended;
      return matchesSearch && matchesTrack && matchesTab;
    });
  }, [items, search, track, tab]);

  if (error) return <p className="app-error">{error}</p>;
  if (!ready) {
    return (
      <div className="module-stack" aria-busy="true">
        <div className="app-skeleton app-skeleton-hero" />
        <div className="module-grid">
          <div className="app-skeleton app-skeleton-card" />
          <div className="app-skeleton app-skeleton-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="module-stack">
      <header>
        <p className="eyebrow">Measure</p>
        <h1>Assessments</h1>
        <p className="lead">
          Catalog and runner remapped from Competency-Mapping: search, recommended, MCQ, and Kolb ranking. Not a second product URL — and not a licensed psychometric.
        </p>
      </header>
      <div className="community-filters">
        <input
          type="search"
          placeholder="Search assessments"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search assessments"
        />
        <select value={track} onChange={(e) => setTrack(e.target.value as typeof track)} aria-label="Filter by track">
          <option value="all">All tracks</option>
          <option value="psychology">Psychology</option>
          <option value="placement">Placement</option>
        </select>
      </div>
      <div className="tag-row" role="tablist" aria-label="Assessment lists">
        <button type="button" className={tab === "all" ? "tag is-on" : "tag"} onClick={() => setTab("all")}>
          All
        </button>
        <button type="button" className={tab === "recommended" ? "tag is-on" : "tag"} onClick={() => setTab("recommended")}>
          Recommended
        </button>
      </div>
      <div className="module-grid">
        {filtered.map((item) => (
          <article key={item.id} className="module-card test-card">
            <div className="row-between">
              <p className="meta">{item.level}</p>
              {item.recommended ? <span className="app-plan-pill">Recommended</span> : null}
            </div>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
            <p className="meta">
              {item.duration} · {item.itemCount} items · {item.kind === "rank" ? "Kolb ranking" : "MCQ"}
            </p>
            <Link className="btn btn-primary" href={`/app/assessments/${item.id}`}>
              Start test
            </Link>
          </article>
        ))}
      </div>
      {!filtered.length ? <p className="product-empty">No assessments match that filter.</p> : null}
      {runs.length ? (
        <section>
          <h2 className="admin-h2">Your recent runs</h2>
          <ul className="run-list">
            {runs.slice(0, 8).map((run) => (
              <li key={run.id}>
                <span>{run.assessmentId}</span>
                <span className="num">{run.score}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KolbRanker({
  item,
  value,
  onChange,
}: {
  item: RankItem;
  value?: StoredAnswer & { kind: "rank" };
  onChange: (next: StoredAnswer) => void;
}) {
  const order = value?.ranked.map((row) => row.optionId) ?? item.options.map((option) => option.id);
  const options = order
    .map((id) => item.options.find((option) => option.id === id))
    .filter((option): option is RankItem["options"][number] => Boolean(option));

  function move(index: number, dir: -1 | 1) {
    const next = [...options];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange({
      kind: "rank",
      ranked: next.map((option, rank) => ({
        optionId: option.id,
        label: option.label,
        mode: option.mode,
        rank: rank + 1,
      })),
    });
  }

  return (
    <div className="kolb-ranker">
      <p className="meta">Rank 1 = most like you, {options.length} = least like you. Use the arrows to reorder.</p>
      <ol>
        {options.map((option, index) => (
          <li key={option.id} className="kolb-row">
            <span className="kolb-rank num">{index + 1}</span>
            <span className="kolb-label">{option.label}</span>
            <span className="kolb-move">
              <button type="button" className="btn btn-ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                Up
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={index === options.length - 1}
                onClick={() => move(index, 1)}
                aria-label="Move down"
              >
                Down
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AssessmentRunner({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<LocalAssessment | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StoredAnswer>>({});
  const [complete, setComplete] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bufferKey = `lokutara_test_${assessmentId}`;

  useEffect(() => {
    if (!assessmentId) return;
    void (async () => {
      const { res, body } = await jsonFetch(`/api/workspace/assessments/${assessmentId}`);
      if (!res.ok) {
        setError(body.message || "Could not open this assessment");
        return;
      }
      setAssessment(body.assessment as LocalAssessment);
    })();
  }, [assessmentId]);

  useEffect(() => {
    if (!assessment) return;
    try {
      const saved = localStorage.getItem(bufferKey);
      if (saved) setAnswers(JSON.parse(saved) as Record<string, StoredAnswer>);
    } catch {
      /* ignore */
    }
  }, [assessment, bufferKey]);

  useEffect(() => {
    if (!assessmentId) return;
    try {
      localStorage.setItem(bufferKey, JSON.stringify(answers));
    } catch {
      /* ignore */
    }
  }, [answers, bufferKey, assessmentId]);

  useEffect(() => {
    const current = assessment?.items[index];
    if (!current || current.kind !== "rank") return;
    setAnswers((prev) => {
      if (prev[current.id]) return prev;
      return {
        ...prev,
        [current.id]: {
          kind: "rank",
          ranked: current.options.map((option, rank) => ({
            optionId: option.id,
            label: option.label,
            mode: option.mode,
            rank: rank + 1,
          })),
        },
      };
    });
  }, [assessment, index]);

  async function submit() {
    setSaving(true);
    setError(null);
    const { res, body } = await jsonFetch(`/api/workspace/assessments/${assessmentId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(body.message || "Could not save");
      return;
    }
    try {
      localStorage.removeItem(bufferKey);
    } catch {
      /* ignore */
    }
    setScore(body.run.score);
  }

  if (error && !assessment) return <p className="app-error">{error}</p>;
  if (!assessment) return <div className="app-skeleton app-skeleton-hero" aria-busy="true" />;

  const item: AssessmentItem | undefined = assessment.items[index];
  const progress = Math.round(((index + 1) / assessment.items.length) * 100);
  const answered = Object.keys(answers).length;

  if (score !== null) {
    return (
      <section className="module-stack">
        <p className="eyebrow">Result</p>
        <h1>Assessment complete</h1>
        <p className="result-score num">{score}</p>
        <p className="lead">
          {assessment.title} · {answered} of {assessment.items.length} answered. A conversation sketch, not a diagnostic.
        </p>
        <div className="paywall-actions">
          <Link className="btn btn-primary" href="/app/assessments">
            Back to assessments
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => { setScore(null); setComplete(false); }}>
            Review answers
          </button>
        </div>
      </section>
    );
  }

  if (complete) {
    return (
      <section className="runner-complete">
        <h1>Ready to submit?</h1>
        <p className="lead">
          {assessment.title}. You have answered {answered} of {assessment.items.length}.
        </p>
        {error ? <p className="app-error">{error}</p> : null}
        <div className="paywall-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setComplete(false)}>
            Review
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || answered < assessment.items.length}
            onClick={() => void submit()}
          >
            {saving ? "Saving…" : "Submit test"}
          </button>
        </div>
      </section>
    );
  }

  const isRank = item?.kind === "rank";

  return (
    <section className={`runner${isRank ? " is-kolb" : ""}`}>
      <button type="button" className="btn btn-ghost" onClick={() => router.push("/app/assessments")}>
        All assessments
      </button>
      <header className="runner-hero">
        <div>
          <p className="eyebrow">{assessment.title}</p>
          <p className="meta">
            Question {index + 1} of {assessment.items.length}
          </p>
        </div>
        <span className="num">{progress}%</span>
      </header>
      <div className="runner-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      {item?.kind === "mcq" ? (
        <>
          <div className="runner-prompt">
            <h1>{item.prompt}</h1>
          </div>
          <div className="likert" role="radiogroup" aria-label={item.prompt}>
            {item.options.map((option) => {
              const selected = answers[item.id]?.kind === "mcq" && answers[item.id].value === option.value;
              return (
                <label key={option.value} className={selected ? "is-on" : undefined}>
                  <input
                    type="radio"
                    name={item.id}
                    value={option.value}
                    checked={selected}
                    onChange={() => {
                      setAnswers((prev) => ({ ...prev, [item.id]: { kind: "mcq", value: option.value } }));
                      window.setTimeout(() => {
                        if (index < assessment.items.length - 1) setIndex((n) => n + 1);
                        else setComplete(true);
                      }, 180);
                    }}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </>
      ) : null}
      {item?.kind === "rank" ? (
        <>
          <div className="runner-prompt">
            <h1>{item.prompt}</h1>
            <p className="meta">Rank these statements from most like you (1) to least like you (4).</p>
          </div>
          <KolbRanker
            item={item}
            value={answers[item.id]?.kind === "rank" ? answers[item.id] : undefined}
            onChange={(next) => setAnswers((prev) => ({ ...prev, [item.id]: next }))}
          />
        </>
      ) : null}
      {error ? <p className="app-error">{error}</p> : null}
      <div className="runner-nav">
        <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex((n) => n - 1)}>
          Previous
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (index < assessment.items.length - 1) setIndex((n) => n + 1);
            else setComplete(true);
          }}
        >
          {index === assessment.items.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </section>
  );
}
