"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  GUIDE_QUESTIONS,
  GUIDE_SERVICES,
  GUIDE_SIZE_OPTIONS,
  encodeGuideLead,
  recommendGuide,
  recommendHeadline,
  type GuideAnswers,
  type GuideLetter,
} from "@/lib/landing/guide";
import { submitLead, track } from "@/lib/tracking/client";

type Step = "size" | "who" | "noticing" | "affected" | "success" | "contact" | "result";

const EMPTY: GuideAnswers = {
  sizeBand: null,
  who: null,
  noticing: null,
  affected: null,
  success: null,
};

export function NeedGuide({
  onBookDiscovery,
  onAskPsychologist,
}: {
  onBookDiscovery: () => void;
  onAskPsychologist: () => void;
}) {
  const [step, setStep] = useState<Step>("size");
  const [answers, setAnswers] = useState<GuideAnswers>(EMPTY);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const individual = answers.who === "e";
  const services = recommendGuide(answers);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function go(next: Step, patch: Partial<GuideAnswers>) {
    setAnswers((current) => ({ ...current, ...patch }));
    setStep(next);
  }

  function back() {
    if (step === "who") setStep("size");
    else if (step === "noticing") setStep("who");
    else if (step === "affected") setStep("noticing");
    else if (step === "success") setStep("affected");
    else if (step === "contact") setStep(individual ? "who" : "success");
    else if (step === "result") setStep("contact");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSending(true);
    const data = new FormData(e.currentTarget);
    const rec = recommendGuide(answers);
    const encoded = encodeGuideLead(answers, rec);
    try {
      const leadType = individual ? "counselling" : "discovery";
      await track("form_start", { type: leadType });
      await submitLead({
        type: leadType,
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone"),
        organisation: individual ? "" : data.get("organisation"),
        sizeBand: answers.sizeBand,
        role: encoded.role,
        preferredTime: encoded.preferredTime,
      });
      await track("lead_submitted", { type: leadType, rec: encoded.preferredTime });
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  const question =
    step === "who" || step === "noticing" || step === "affected" || step === "success"
      ? GUIDE_QUESTIONS[step]
      : null;

  return (
    <div className="guide-panel">
      <div className="guide-progress" aria-hidden="true">
        <span className={mark(step, "size")}>Size</span>
        <span className={mark(step, "who")}>Who</span>
        {!individual ? (
          <>
            <span className={mark(step, "noticing")}>Noticing</span>
            <span className={mark(step, "affected")}>Affected</span>
            <span className={mark(step, "success")}>Success</span>
          </>
        ) : null}
        <span className={mark(step, "contact")}>Details</span>
        <span className={mark(step, "result")}>Recommendation</span>
      </div>

      {step !== "size" && step !== "result" ? (
        <button type="button" className="btn btn-ghost guide-back" onClick={back}>
          ← Back
        </button>
      ) : null}

      {step === "size" ? (
        <>
          <p className="eyebrow">A short conversation</p>
          <h3 ref={headingRef} tabIndex={-1}>
            Start with the company size
          </h3>
          <p className="lead" style={{ marginTop: 10 }}>
            Then we’ll ask about the problem — not the service you think you need.
          </p>
          <div className="guide-choices">
            {GUIDE_SIZE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`guide-choice${answers.sizeBand === option.id ? " is-on" : ""}`}
                onClick={() => go("who", { sizeBand: option.id })}
              >
                <span className="guide-letter">·</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {question ? (
        <>
          <p className="eyebrow">{question.kicker}</p>
          <h3 ref={headingRef} tabIndex={-1}>
            {question.prompt}
          </h3>
          {"hint" in question && question.hint ? (
            <p className="lead" style={{ marginTop: 10 }}>
              {question.hint}
            </p>
          ) : null}
          <div className="guide-choices">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`guide-choice${answers[step as "who"] === option.id ? " is-on" : ""}`}
                onClick={() => {
                  const letter = option.id as GuideLetter;
                  if (step === "who") {
                    go(letter === "e" ? "contact" : "noticing", { who: letter });
                  } else if (step === "noticing") go("affected", { noticing: letter });
                  else if (step === "affected") go("success", { affected: letter });
                  else go("contact", { success: letter });
                }}
              >
                <span className="guide-letter">{option.id.toUpperCase()}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === "contact" ? (
        <form className="guide-form" onSubmit={onSubmit}>
          <p className="eyebrow">Your details</p>
          <h3 ref={headingRef} tabIndex={-1}>
            Where should we send the recommendation?
          </h3>
          <p className="lead" style={{ marginTop: 10 }}>
            Name, email, and phone. We’ll show the recommendation on this page as soon as this is in.
          </p>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="field">
            <label htmlFor="guide-name">Name</label>
            <input className="input" id="guide-name" name="name" required autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="guide-email">{individual ? "Email" : "Work email"}</label>
            <input
              className="input"
              id="guide-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
            />
          </div>
          <div className="field">
            <label htmlFor="guide-phone">Phone</label>
            <input
              className="input"
              id="guide-phone"
              name="phone"
              required
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
          {!individual ? (
            <div className="field">
              <label htmlFor="guide-org">Organisation</label>
              <input className="input" id="guide-org" name="organisation" required autoComplete="organization" />
            </div>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Sending…" : "Show my recommendation"}
          </button>
        </form>
      ) : null}

      {step === "result" ? (
        <div className="guide-result">
          <p className="eyebrow">Received</p>
          <h3 ref={headingRef} tabIndex={-1}>
            {recommendHeadline(services)}
          </h3>
          <ul className="guide-services">
            {services.map((id) => {
              const item = GUIDE_SERVICES[id];
              return (
                <li key={id} className="guide-service">
                  <span className="pill">{item.verb}</span>
                  <strong>{item.title}</strong>
                  <p>{item.blurb}</p>
                </li>
              );
            })}
          </ul>
          <div className="guide-result-actions">
            {individual ? (
              <button type="button" className="btn btn-primary" onClick={onAskPsychologist}>
                Ask a psychologist
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={onBookDiscovery}>
                Book a discovery call
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setAnswers(EMPTY);
                setStep("size");
              }}
            >
              Start again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mark(current: Step, id: Step): string {
  const order: Step[] = ["size", "who", "noticing", "affected", "success", "contact", "result"];
  const here = order.indexOf(current);
  const at = order.indexOf(id);
  if (here === at) return "is-now";
  if (here > at) return "is-done";
  return "";
}
