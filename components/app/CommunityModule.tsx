"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CommunityRole } from "@/lib/access/billing";
import { COMMUNITY_TAG_GROUPS, COMMUNITY_TAGS, relativeDay } from "@/lib/product/workspace";
import { jsonFetch, useAppAccount } from "./AppShell";
import { showAppToast } from "./AppToast";
import { GRIEVANCE_EMAIL } from "@/lib/legal/compliance";

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

export type ReplyPolicy = {
  role: CommunityRole;
  canReply: boolean;
};

function QuestionCard({ thread }: { thread: ThreadView }) {
  const pending = thread.answerCount === 0;
  return (
    <Link href={`/app/community/${thread.id}`} className="question-card">
      <div className="question-card-main">
        <h2>{thread.title}</h2>
        <p>{thread.body.slice(0, 180)}</p>
        {thread.tags.length ? (
          <div className="tag-row">
            {thread.tags.map((tag) => (
              <span key={tag} className="tag tag-static">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
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
      showAppToast("Community is not on your plan.");
      setError("Community is not on your plan.");
      setReady(true);
      return;
    }
    if (!res.ok) {
      showAppToast(body.message || "Could not load threads. Try again in a moment.");
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
      <header className="community-head dash-in">
        <div>
          <p className="eyebrow">Connect</p>
          <h1>Community</h1>
          <p className="lead">Ask about workshops, managers, and day-to-day work. Replies stay in this workspace.</p>
        </div>
        <Link className="btn btn-primary" href="/app/community/ask">
          Ask a question
        </Link>
      </header>
      <form
        className="community-filters dash-in delay-1"
        onSubmit={(ev) => {
          ev.preventDefault();
          void load();
        }}
      >
        <input
          type="search"
          className="input"
          placeholder="Search questions"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search questions"
        />
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
        <select
          className="input"
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
      <div className="tag-row dash-in delay-1">
        {COMMUNITY_TAGS.map((item) => (
          <button
            key={item}
            type="button"
            className={tag === item ? "tag tag-btn is-on" : "tag tag-btn"}
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
      {error && !threads.length ? (
        <p className="lead">Community could not load. Refresh, or get in touch if this keeps happening.</p>
      ) : null}
      {!threads.length && !error ? (
        <p className="product-empty">No threads yet. Ask the first question for this workspace.</p>
      ) : (
        <ul className="thread-list">
          {threads.map((thread, i) => (
            <li key={thread.id} className={`dash-in delay-${Math.min(i, 4) || 1}`}>
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
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid =
    title.trim().length >= 10 &&
    body.trim().length >= 20 &&
    tags.length > 0 &&
    noticeAccepted;

  function toggle(tag: string) {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!valid) {
      showAppToast("Add a title, a short description, and at least one topic.");
      return;
    }
    setSaving(true);
    const { res, body: payload } = await jsonFetch("/api/workspace/community", {
      method: "POST",
      body: JSON.stringify({
        title,
        body,
        tags,
        communityNoticeAccepted: noticeAccepted,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showAppToast(payload.message || "Could not post. Try again in a moment.");
      return;
    }
    window.location.href = `/app/community/${payload.thread.id}`;
  }

  return (
    <form className="module-stack ask-form" onSubmit={onSubmit}>
      <p className="eyebrow">Ask</p>
      <h1>Ask a question</h1>
      <p className="lead">
        Share enough context for a useful reply. This is a member forum, not confidential
        counselling or an emergency channel.
      </p>
      <div className="safety-callout">
        Do not post names, contact details, diagnoses, session content, confidential
        employer information, or an identifiable story about another person.
      </div>
      <label className="admin-field">
        <span className="meta">Question title</span>
        <input
          className="input"
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
          className="input"
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
              <button
                key={tag}
                type="button"
                className={tags.includes(tag) ? "tag tag-btn is-on" : "tag tag-btn"}
                onClick={() => toggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="meta">{tags.length ? `${tags.length} topic${tags.length === 1 ? "" : "s"} selected` : "Select at least one topic"}</p>
      <label className="legal-check">
        <input
          type="checkbox"
          checked={noticeAccepted}
          onChange={(event) => setNoticeAccepted(event.target.checked)}
          required
        />
        <span>
          I have removed personal and confidential details and accept the{" "}
          <Link href="/terms">community rules</Link>.
        </span>
      </label>
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
  const account = useAppAccount();
  const [thread, setThread] = useState<ThreadView | null>(null);
  const [policy, setPolicy] = useState<ReplyPolicy | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [missing, setMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const answers = useMemo(() => thread?.answers || [], [thread]);
  const pending = (thread?.answerCount ?? answers.length) === 0;

  useEffect(() => {
    void (async () => {
      const [{ res, body }, session] = await Promise.all([
        jsonFetch(`/api/workspace/community/${id}`),
        jsonFetch("/api/auth/me"),
      ]);
      if (!res.ok) {
        showAppToast(body.message || "This thread could not be opened.");
        setMissing(true);
        return;
      }
      setThread(body.thread);
      if (body.replyPolicy) setPolicy(body.replyPolicy as ReplyPolicy);
      setMe(session.body.account?.id ?? null);
    })();
  }, [id]);

  async function sendReply(ev: FormEvent) {
    ev.preventDefault();
    if (reply.trim().length < 10) {
      showAppToast("Answer must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    const { res, body } = await jsonFetch(`/api/workspace/community/${id}/answers`, {
      method: "POST",
      body: JSON.stringify({ body: reply }),
    });
    setSubmitting(false);
    if (!res.ok) {
      showAppToast(body.message || "Could not reply. Try again in a moment.");
      return;
    }
    setThread(body.thread);
    setReply("");
  }

  async function upvote(answerId: string) {
    const { res, body } = await jsonFetch(`/api/workspace/community/${id}/answers/${answerId}/upvote`, {
      method: "POST",
    });
    if (res.ok) setThread(body.thread);
  }

  if (missing && !thread) {
    return (
      <p className="lead">
        This thread could not be opened. <Link href="/app/community">Back to community</Link>.
      </p>
    );
  }
  if (!thread) return <p className="meta">Opening thread…</p>;

  const role = policy?.role ?? account?.communityRole ?? "student";
  const canReply = policy?.canReply ?? (role === "specialist" || role === "admin");

  return (
    <article className="module-stack thread-detail">
      <Link href="/app/community" className="btn btn-ghost">
        Back to community
      </Link>
      <div className="question-hero dash-in">
        <div className="question-hero-top">
          <h1>{thread.title}</h1>
          <span className={pending ? "status-pill is-pending" : "status-pill is-answered"}>
            {pending ? "Pending" : "Answered"}
          </span>
        </div>
        <div className="tag-row">
          {thread.tags.map((tag) => (
            <span key={tag} className="tag tag-static is-on">
              {tag}
            </span>
          ))}
        </div>
        <p className="meta">
          {thread.authorName} · {relativeDay(thread.createdAt)} · {thread.views} views
        </p>
        <p className="thread-body">{thread.body}</p>
        <a
          className="meta"
          href={`mailto:${GRIEVANCE_EMAIL}?subject=${encodeURIComponent(`Community report: ${thread.id}`)}`}
        >
          Report privacy, safety, or rule concern
        </a>
      </div>
      <section className="answer-section dash-in delay-1">
        <h2 className="admin-h2">{answers.length} {answers.length === 1 ? "answer" : "answers"}</h2>
        {!answers.length ? (
          <p className="answer-empty">No answers yet.</p>
        ) : (
          <ul className="answer-list">
            {answers.map((answer) => {
              const liked = me ? answer.upvotedBy?.includes(me) : false;
              return (
                <li key={answer.id}>
                  <article className="answer-card">
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
                    <div className="answer-body">
                      <p>{answer.body}</p>
                      <p className="meta">
                        {answer.authorName} · {relativeDay(answer.createdAt)}
                      </p>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="reply-panel dash-in delay-2">
        <h2>Your answer</h2>
        {canReply ? (
          <form className="reply-composer" onSubmit={sendReply}>
            <label className="admin-field">
              <span className="meta">Write a reply</span>
              <textarea
                className="input"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={6}
                required
                minLength={10}
                placeholder="Share a clear, useful answer…"
              />
            </label>
            <div className="reply-composer-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting || reply.trim().length < 10}>
                {submitting ? "Posting…" : "Post answer"}
              </button>
            </div>
          </form>
        ) : (
          <p className="reply-locked">You can ask questions and upvote. Specialists post answers.</p>
        )}
      </section>
    </article>
  );
}
