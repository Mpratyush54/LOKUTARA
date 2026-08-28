"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { COMMUNITY_TAG_GROUPS, COMMUNITY_TAGS, relativeDay } from "@/lib/product/workspace";
import { jsonFetch } from "./AppShell";

export type ThreadView = {
  id: string;
  authorName: string;
  title: string;
  body: string;
  tags: string[];
  views: number;
  answerCount: number;
  createdAt: string;
  answers?: Array<{
    id: string;
    authorName: string;
    body: string;
    createdAt: string;
    upvotes: number;
    upvotedBy: string[];
  }>;
};

function QuestionCard({ thread }: { thread: ThreadView }) {
  const pending = thread.answerCount === 0;
  return (
    <Link href={`/app/community/${thread.id}`} className="question-card">
      <div className="question-card-main">
        <h2>{thread.title}</h2>
        <p>{thread.body.slice(0, 180)}</p>
        <div className="tag-row">
          {thread.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <p className="meta">
          {thread.authorName} · {relativeDay(thread.createdAt)}
        </p>
      </div>
      <div className="question-card-stats">
        <p>
          <span className="num">{thread.answerCount}</span> replies
        </p>
        <p>
          <span className="num">{thread.views}</span> views
        </p>
        <span className={pending ? "status-pill is-pending" : "status-pill is-answered"}>
          {pending ? "Pending" : "Answered"}
        </span>
      </div>
    </Link>
  );
}

export function CommunityExplore() {
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<"latest" | "unanswered">("latest");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  async function load(nextQ = q, nextTag = tag, nextSort = sort) {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextTag) params.set("tag", nextTag);
    params.set("sort", nextSort);
    const { res, body } = await jsonFetch(`/api/workspace/community?${params.toString()}`);
    if (res.status === 402) {
      setError("Community is not on your plan.");
      setReady(true);
      return;
    }
    if (!res.ok) {
      setError(body.message || "Could not load threads");
      setReady(true);
      return;
    }
    setThreads(body.threads || []);
    setReady(true);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="app-error">{error}</p>;
  if (!ready) {
    return (
      <div className="module-stack" aria-busy="true">
        <div className="app-skeleton app-skeleton-hero" />
        <div className="app-skeleton app-skeleton-card" />
        <div className="app-skeleton app-skeleton-card" />
      </div>
    );
  }

  return (
    <div className="module-stack">
      <header className="row-between">
        <div>
          <p className="eyebrow">Connect</p>
          <h1>Explore</h1>
          <p className="lead">
            Search, tags, pending/answered — remapped from the Forum explore feed into this dashboard. Not a second site.
          </p>
        </div>
        <Link className="btn btn-primary" href="/app/community/ask">
          Ask a question
        </Link>
      </header>
      <form
        className="community-filters"
        onSubmit={(ev) => {
          ev.preventDefault();
          void load();
        }}
      >
        <input
          type="search"
          placeholder="Search questions"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search questions"
        />
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
        <select
          value={sort}
          aria-label="Sort questions"
          onChange={(e) => {
            const next = e.target.value as "latest" | "unanswered";
            setSort(next);
            void load(q, tag, next);
          }}
        >
          <option value="latest">Latest</option>
          <option value="unanswered">Unanswered</option>
        </select>
      </form>
      <div className="tag-row">
        {COMMUNITY_TAGS.map((item) => (
          <button
            key={item}
            type="button"
            className={tag === item ? "tag is-on" : "tag"}
            onClick={() => {
              const next = tag === item ? "" : item;
              setTag(next);
              void load(q, next, sort);
            }}
          >
            {item}
          </button>
        ))}
      </div>
      {error ? <p className="app-error">{error}</p> : null}
      {!threads.length ? (
        <p className="product-empty">No threads yet. Ask the first question for this workspace.</p>
      ) : (
        <ul className="thread-list">
          {threads.map((thread) => (
            <li key={thread.id}>
              <QuestionCard thread={thread} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AskThread() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const valid = title.trim().length >= 10 && body.trim().length >= 20 && tags.length > 0;

  function toggle(tag: string) {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!valid) return;
    setSaving(true);
    const { res, body: payload } = await jsonFetch("/api/workspace/community", {
      method: "POST",
      body: JSON.stringify({ title, body, tags }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(payload.message || "Could not post");
      return;
    }
    window.location.href = `/app/community/${payload.thread.id}`;
  }

  return (
    <form className="module-stack ask-form" onSubmit={onSubmit}>
      <p className="eyebrow">Ask</p>
      <h1>Ask a question</h1>
      <p className="lead">Get help from people in this workspace — same dashboard, not a second forum login.</p>
      <label className="admin-field">
        <span className="meta">Question title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={10}
          placeholder="e.g. How do we brief managers after a workshop?"
        />
      </label>
      <label className="admin-field">
        <span className="meta">Description</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={20}
          rows={8}
          placeholder="Give enough context for a useful reply."
        />
      </label>
      {(Object.keys(COMMUNITY_TAG_GROUPS) as Array<keyof typeof COMMUNITY_TAG_GROUPS>).map((group) => (
        <div key={group}>
          <p className="meta">{group}</p>
          <div className="tag-row">
            {COMMUNITY_TAG_GROUPS[group].map((tag) => (
              <button key={tag} type="button" className={tags.includes(tag) ? "tag is-on" : "tag"} onClick={() => toggle(tag)}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error ? <p className="app-error">{error}</p> : null}
      <div className="paywall-actions">
        <button type="submit" className="btn btn-primary" disabled={!valid || saving}>
          {saving ? "Posting…" : "Submit question"}
        </button>
        <Link className="btn btn-secondary" href="/app/community">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function ThreadDetail({ id }: { id: string }) {
  const [thread, setThread] = useState<ThreadView | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const answers = useMemo(() => thread?.answers || [], [thread]);

  useEffect(() => {
    void (async () => {
      const [{ res, body }, session] = await Promise.all([
        jsonFetch(`/api/workspace/community/${id}`),
        jsonFetch("/api/auth/me"),
      ]);
      if (!res.ok) {
        setError(body.message || "Thread missing");
        return;
      }
      setThread(body.thread);
      setMe(session.body.account?.id ?? null);
    })();
  }, [id]);

  async function sendReply(ev: FormEvent) {
    ev.preventDefault();
    if (reply.trim().length < 10) {
      setError("Answer must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    const { res, body } = await jsonFetch(`/api/workspace/community/${id}/answers`, {
      method: "POST",
      body: JSON.stringify({ body: reply }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(body.message || "Could not reply");
      return;
    }
    setThread(body.thread);
    setReply("");
    setError(null);
  }

  async function upvote(answerId: string) {
    const { res, body } = await jsonFetch(`/api/workspace/community/${id}/answers/${answerId}/upvote`, {
      method: "POST",
    });
    if (res.ok) setThread(body.thread);
  }

  if (error && !thread) return <p className="app-error">{error}</p>;
  if (!thread) return <p className="meta">Opening thread…</p>;

  return (
    <article className="module-stack">
      <Link href="/app/community" className="btn btn-ghost">
        Back to explore
      </Link>
      <div className="question-hero">
        <h1>{thread.title}</h1>
        <div className="tag-row">
          {thread.tags.map((tag) => (
            <span key={tag} className="tag is-on">
              {tag}
            </span>
          ))}
        </div>
        <p className="meta">
          {thread.authorName} · {relativeDay(thread.createdAt)} · {thread.views} views
        </p>
        <p className="thread-body">{thread.body}</p>
      </div>
      <h2 className="admin-h2">{answers.length} {answers.length === 1 ? "answer" : "answers"}</h2>
      <ul className="answer-list">
        {answers.map((answer) => {
          const liked = me ? answer.upvotedBy?.includes(me) : false;
          return (
            <li key={answer.id} className="answer-card">
              <button
                type="button"
                className={liked ? "upvote is-on" : "upvote"}
                onClick={() => void upvote(answer.id)}
                aria-pressed={liked}
                aria-label="Upvote answer"
              >
                <span aria-hidden="true">▲</span>
                <span className="num">{answer.upvotes ?? 0}</span>
              </button>
              <div>
                <p>{answer.body}</p>
                <p className="meta">
                  {answer.authorName} · {relativeDay(answer.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <form className="ask-form" onSubmit={sendReply}>
        <label className="admin-field">
          <span className="meta">Your answer</span>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={6} required minLength={10} />
        </label>
        {error ? <p className="app-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={submitting || reply.trim().length < 10}>
          {submitting ? "Posting…" : "Post answer"}
        </button>
      </form>
    </article>
  );
}
