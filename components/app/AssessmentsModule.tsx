"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AssessmentItem, LocalAssessment, RankItem, StoredAnswer } from "@/lib/product/workspace";
import { relativeDay } from "@/lib/product/workspace";
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
  latestRunId?: string | null;
  latestScore?: number | null;
};

type TraitScore = { id: string; label: string; score: number; max: number; note: string };

type Run = {
  id: string;
  assessmentId: string;
  title?: string;
  score: number;
  headline?: string;
  disclaimer?: string;
  traits?: TraitScore[];
  createdAt: string;
  resultsPath?: string;
};

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
        <div className="assessment-grid">
          <div className="app-skeleton app-skeleton-card" />
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
      <div className="assessment-grid">
        {filtered.map((item) => (
          <article key={item.id} className="module-card test-card">
            <div className="test-card-top">
              <p className="meta">{item.level}</p>
              {item.recommended ? <span className="app-plan-pill">Recommended</span> : null}
            </div>
            <h2>{item.title}</h2>
            <p className="test-card-copy">{item.copy}</p>
            <p className="meta">
              {item.duration} · {item.itemCount} items · {item.kind === "rank" ? "Kolb ranking" : "MCQ"}
            </p>
            <div className="test-card-actions">
              <Link className="btn btn-primary" href={`/app/assessments/${item.id}`}>
                {item.latestRunId ? "Retake" : "Start test"}
              </Link>
              {item.latestRunId ? (
                <Link className="btn btn-secondary" href={`/app/assessments/${item.id}/results`}>
                  View results
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {!filtered.length ? <p className="product-empty">No assessments match that filter.</p> : null}
      {runs.length ? (
        <section>
          <h2 className="admin-h2">Your results</h2>
          <p className="meta">Saved sketches from this dashboard — conversation tools, not licensed psychometrics.</p>
          <ul className="run-list">
            {runs.slice(0, 12).map((run) => (
              <li key={run.id}>
                <Link className="run-card" href={run.resultsPath || `/app/assessments/${run.assessmentId}/results?run=${run.id}`}>
                  <span>
                    <strong>{run.title || run.assessmentId}</strong>
                    <span className="meta">{relativeDay(run.createdAt)}</span>
                  </span>
                  <span className="num">{run.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="product-empty">No results yet. Finish a screen and it will show up here.</p>
      )}
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
    const resultsPath =
      body.run?.resultsPath || `/app/assessments/${assessmentId}/results?run=${body.run?.id ?? ""}`;
    router.push(resultsPath);
  }

  if (error && !assessment) {
    return (
      <div className="runner-stage">
        <p className="app-error">{error}</p>
      </div>
    );
  }
  if (!assessment) {
    return (
      <div className="runner-stage" aria-busy="true">
        <div className="app-skeleton app-skeleton-hero" />
      </div>
    );
  }

  const item: AssessmentItem | undefined = assessment.items[index];
  const progress = Math.round(((index + 1) / assessment.items.length) * 100);
  const answered = Object.keys(answers).length;

  if (complete) {
    return (
      <div className="runner-stage">
        <section className="runner runner-complete">
          <h1>Ready to submit?</h1>
          <p className="lead">
            {assessment.title}. You have answered {answered} of {assessment.items.length}.
          </p>
          {error ? <p className="app-error">{error}</p> : null}
          {answered < assessment.items.length ? (
            <p className="meta">Answer every item before submitting.</p>
          ) : null}
          <div className="runner-nav">
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
      </div>
    );
  }

  const isRank = item?.kind === "rank";

  function goNext() {
    if (index < assessment.items.length - 1) setIndex((n) => n + 1);
    else setComplete(true);
  }

  function selectMcq(itemId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [itemId]: { kind: "mcq", value } }));
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(goNext, reduceMotion ? 0 : 180);
  }

  return (
    <div className="runner-stage">
      <section className={`runner${isRank ? " is-kolb" : ""}`}>
        <button type="button" className="btn btn-ghost runner-exit" onClick={() => router.push("/app/assessments")}>
          All assessments
        </button>
        <header className="runner-hero">
          <div>
            <p className="eyebrow">{assessment.title}</p>
            <p className="meta">
              Question {index + 1} of {assessment.items.length}
            </p>
          </div>
          <span className="runner-pct num">{progress}%</span>
        </header>
        <div className="runner-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="runner-body">
          {item?.kind === "mcq" ? (
            <>
              <div className="runner-prompt">
                <h1 className="runner-q">{item.prompt}</h1>
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
                        onChange={() => selectMcq(item.id, option.value)}
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
                <h1 className="runner-q">{item.prompt}</h1>
                <p className="meta">Rank these statements from most like you (1) to least like you (4).</p>
              </div>
              <KolbRanker
                item={item}
                value={answers[item.id]?.kind === "rank" ? answers[item.id] : undefined}
                onChange={(next) => setAnswers((prev) => ({ ...prev, [item.id]: next }))}
              />
            </>
          ) : null}
        </div>
        {error ? <p className="app-error">{error}</p> : null}
        <div className="runner-nav">
          <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex((n) => n - 1)}>
            Previous
          </button>
          <button type="button" className="btn btn-primary" onClick={goNext}>
            {index === assessment.items.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TraitBars({ traits }: { traits: TraitScore[] }) {
  if (!traits.length) return null;
  return (
    <ul className="trait-list">
      {traits.map((trait) => {
        const pct = trait.max ? Math.max(0, Math.min(100, Math.round((trait.score / trait.max) * 100))) : 0;
        return (
          <li key={trait.id} className="trait-row">
            <div className="trait-row-top">
              <strong>{trait.label}</strong>
              <span className="num">{trait.score}</span>
            </div>
            <div className="trait-track" aria-hidden="true">
              <span className="trait-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="meta">{trait.note}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function AssessmentResults({ assessmentId }: { assessmentId: string }) {
  const searchParams = useSearchParams();
  const runQuery = searchParams.get("run");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [copy, setCopy] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);

  useEffect(() => {
    if (!assessmentId) return;
    void (async () => {
      const { res, body } = await jsonFetch(`/api/workspace/assessments/${assessmentId}/results`);
      if (res.status === 402) {
        setError("This module is not on your plan.");
        setReady(true);
        return;
      }
      if (!res.ok) {
        setError(body.message || "Could not load results");
        setReady(true);
        return;
      }
      const list = (body.runs || []) as Run[];
      setTitle(body.assessment?.title || assessmentId);
      setCopy(body.assessment?.copy || "");
      setRuns(list);
      const match = runQuery ? list.find((run) => run.id === runQuery) : list[0];
      if (match) {
        setSelected(match);
        setReady(true);
        return;
      }
      if (runQuery) {
        const one = await jsonFetch(`/api/workspace/runs/${runQuery}`);
        if (one.res.ok) {
          setSelected(one.body.run as Run);
          setReady(true);
          return;
        }
      }
      setSelected(list[0] ?? null);
      setReady(true);
    })();
  }, [assessmentId, runQuery]);

  if (error) return <p className="app-error">{error}</p>;
  if (!ready) {
    return (
      <div className="module-stack" aria-busy="true">
        <div className="app-skeleton app-skeleton-hero" />
        <div className="app-skeleton app-skeleton-card" />
      </div>
    );
  }

  if (!selected) {
    return (
      <section className="module-stack results-page">
        <p className="eyebrow">Results</p>
        <h1>{title || "Assessment"}</h1>
        <p className="lead">You have not finished this screen yet. Results stay in this dashboard after you submit.</p>
        <div className="runner-nav">
          <Link className="btn btn-primary" href={`/app/assessments/${assessmentId}`}>
            Start test
          </Link>
          <Link className="btn btn-secondary" href="/app/assessments">
            All assessments
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="module-stack results-page">
      <p className="eyebrow">Results</p>
      <h1>{selected.title || title}</h1>
      <p className="results-disclaimer">{selected.disclaimer}</p>
      <p className="lead">{selected.headline}</p>
      <p className="result-score num">{selected.score}</p>
      <p className="meta">
        Average self-report · {relativeDay(selected.createdAt)} · {copy || "A conversation sketch, not a diagnostic."}
      </p>
      <TraitBars traits={selected.traits || []} />
      <div className="runner-nav">
        <Link className="btn btn-primary" href={`/app/assessments/${assessmentId}`}>
          Retake
        </Link>
        <Link className="btn btn-secondary" href="/app/assessments">
          All assessments
        </Link>
      </div>
      {runs.length > 1 ? (
        <section>
          <h2 className="admin-h2">Earlier sketches</h2>
          <ul className="run-list">
            {runs
              .filter((run) => run.id !== selected.id)
              .map((run) => (
                <li key={run.id}>
                  <Link className="run-card" href={`/app/assessments/${assessmentId}/results?run=${run.id}`}>
                    <span>
                      <strong>{relativeDay(run.createdAt)}</strong>
                      <span className="meta">{run.headline}</span>
                    </span>
                    <span className="num">{run.score}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
