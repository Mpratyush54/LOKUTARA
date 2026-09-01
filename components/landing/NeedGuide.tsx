"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { PEOPLE_FIGURE_MAX, peopleCountForHeadcount, tierForHeadcount } from "@/lib/landing/content";
import {
  EMPTY_LANDING_QUERY,
  landingUrlLabel,
  parseLandingQuery,
  writeLandingUrl,
  type GuideStep,
  type LandingQuery,
  headcountForSizeBand,
  sizeBandForHeadcount,
} from "@/lib/landing/urlState";
import { submitLead, track } from "@/lib/tracking/client";
import { showAppToast } from "@/components/app/AppToast";
import { BuyNowButton } from "./BuyNowButton";

const EMPTY: GuideAnswers = {
  sizeBand: null,
  who: null,
  noticing: null,
  affected: null,
  success: null,
};

function answersFromQuery(query: LandingQuery): GuideAnswers {
  return {
    sizeBand: query.size,
    who: query.who,
    noticing: query.noticing,
    affected: query.affected,
    success: query.success,
  };
}

function stepFromQuery(query: LandingQuery): GuideStep {
  return query.gstep ?? "size";
}

function headcountFromQuery(query: LandingQuery): number {
  if (query.headcount) return query.headcount;
  if (query.size) return headcountForSizeBand(query.size);
  return 120;
}

export function NeedGuide({
  initial,
  onBookDiscovery,
  onAskPsychologist,
}: {
  initial?: LandingQuery;
  onBookDiscovery: () => void;
  onAskPsychologist: () => void;
}) {
  const seed = initial ?? EMPTY_LANDING_QUERY;
  const [step, setStep] = useState<GuideStep>(stepFromQuery(seed));
  const [answers, setAnswers] = useState<GuideAnswers>(answersFromQuery(seed));
  const [headcount, setHeadcount] = useState(() => headcountFromQuery(seed));
  const [sending, setSending] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const individual = answers.who === "e";
  const services = recommendGuide(answers);
  const tier = useMemo(() => tierForHeadcount(headcount), [headcount]);
  const peopleShown = peopleCountForHeadcount(headcount);
  const sizeBand = sizeBandForHeadcount(headcount);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    function sync() {
      const query = parseLandingQuery(new URLSearchParams(window.location.search));
      setStep(stepFromQuery(query));
      setAnswers(answersFromQuery(query));
      setHeadcount(headcountFromQuery(query));
    }
    window.addEventListener("popstate", sync);
    window.addEventListener("lokutara:url", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("lokutara:url", sync);
    };
  }, []);

  function publish(nextStep: GuideStep, patch: Partial<GuideAnswers>, mode: "replace" | "push" = "push") {
    const next = { ...answers, ...patch };
    setAnswers(next);
    setStep(nextStep);
    const current =
      typeof window !== "undefined"
        ? parseLandingQuery(new URLSearchParams(window.location.search))
        : EMPTY_LANDING_QUERY;
    const nextHeadcount =
      next.sizeBand == null
        ? null
        : current.headcount && sizeBandForHeadcount(current.headcount) === next.sizeBand
          ? current.headcount
          : headcountForSizeBand(next.sizeBand);
    if (nextHeadcount) setHeadcount(nextHeadcount);
    writeLandingUrl(
      {
        gstep: nextStep,
        size: next.sizeBand,
        who: next.who,
        noticing: next.noticing,
        affected: next.affected,
        success: next.success,
        headcount: nextHeadcount,
      },
      mode,
    );
  }

  function onSlider(value: number) {
    const band = sizeBandForHeadcount(value);
    setHeadcount(value);
    setAnswers((prev) => ({ ...prev, sizeBand: band }));
    writeLandingUrl({ headcount: value, size: band, gstep: "size" }, "replace");
    track("slider_change", { headcount: value, tier: tierForHeadcount(value).tier });
  }

  function chooseSize(band: (typeof GUIDE_SIZE_OPTIONS)[number]["id"]) {
    setHeadcount(headcountForSizeBand(band));
    publish("who", { sizeBand: band });
  }

  function back() {
    if (step === "who") publish("size", {});
    else if (step === "noticing") publish("who", {});
    else if (step === "affected") publish("noticing", {});
    else if (step === "success") publish("affected", {});
    else if (step === "contact") publish(individual ? "who" : "success", {});
    else if (step === "result") publish("contact", {});
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
        privacyAccepted: data.get("privacyAccepted") === "on",
        adultConfirmed: data.get("privacyAccepted") === "on",
      });
      await track("lead_submitted", { type: leadType, rec: encoded.preferredTime });
      publish("result", {}, "push");
    } catch (err) {
      showAppToast(err instanceof Error ? err.message : "Could not send. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  const question =
    step === "who" || step === "noticing" || step === "affected" || step === "success"
      ? GUIDE_QUESTIONS[step]
      : null;
  const urlPreview = landingUrlLabel({
    ...EMPTY_LANDING_QUERY,
    gstep: step,
    size: answers.sizeBand ?? sizeBand,
    who: answers.who,
    noticing: answers.noticing,
    affected: answers.affected,
    success: answers.success,
    headcount,
  });

  return (
    <div className="guide-browser">
      <div className="guide-browser-bar">
        <button type="button" className="btn btn-ghost" onClick={back} disabled={step === "size"} aria-label="Back">
          ←
        </button>
        <p className="guide-url" title={urlPreview}>
          {urlPreview}
        </p>
      </div>
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

        {step === "size" ? (
          <>
            <p className="eyebrow">Question 1</p>
            <h3 ref={headingRef} tabIndex={-1}>
              Select your company size
            </h3>
            <p className="lead" style={{ marginTop: 10 }}>
              Drag the count, or tap a band. The people fill in as you go — this is the size we use for everything that follows.
            </p>
            <div className="guide-size">
              <div className="guide-size-tool">
                <div className="size-display num">{headcount.toLocaleString("en-IN")}</div>
                <span className="meta">employees</span>
                <input
                  className="size-slider"
                  type="range"
                  min={20}
                  max={2000}
                  step={10}
                  value={headcount}
                  aria-label="Company size in employees"
                  onChange={(e) => onSlider(Number(e.target.value))}
                />
                <div className="guide-choices">
                  {GUIDE_SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`guide-choice${sizeBand === option.id ? " is-on" : ""}`}
                      onClick={() => chooseSize(option.id)}
                    >
                      <span className="guide-letter">·</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
                <div className="size-copy" key={tier.tier}>
                  {tier.msg}
                </div>
              </div>
              <div className="size-illus">
                <div className="size-people">
                  {Array.from({ length: PEOPLE_FIGURE_MAX }, (_, i) => (
                    <div
                      key={i}
                      className={`size-person${i % 3 === 0 ? " accent" : ""}`}
                      style={{
                        height: 42 + (i % 6) * 8,
                        opacity: i < peopleShown ? 1 : 0,
                        transform: i < peopleShown ? "translateY(0)" : "translateY(16px)",
                        transitionDelay: `${i * 28}ms`,
                      }}
                    />
                  ))}
                </div>
                <span className="size-illus-label">
                  {tier.tier} · {headcount.toLocaleString("en-IN")} people
                </span>
              </div>
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
                      publish(letter === "e" ? "contact" : "noticing", { who: letter });
                    } else if (step === "noticing") publish("affected", { noticing: letter });
                    else if (step === "affected") publish("success", { affected: letter });
                    else publish("contact", { success: letter });
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
              Name, email, and phone. The recommendation stays on this page, and in the URL, so a reload does not lose it.
            </p>
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
            <label className="legal-check">
              <input type="checkbox" name="privacyAccepted" required />
              <span>
                I am 18 or older, have read the <a href="/privacy">Privacy Notice</a>,
                and agree to be contacted about this request. I will not put clinical or
                confidential details here.
              </span>
            </label>
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
            <p className="lead" style={{ marginTop: 10 }}>
              Same five things as the cards below. You can pay here, or open a card for the full description.
            </p>
            <ul className="guide-services">
              {services.map((id) => {
                const item = GUIDE_SERVICES[id];
                return (
                  <li key={id} className="guide-service">
                    <span className="pill">{item.verb}</span>
                    <strong>{item.title}</strong>
                    <p>{item.blurb}</p>
                    {item.sku ? (
                      <BuyNowButton sku={item.sku}>Buy now</BuyNowButton>
                    ) : (
                      <button type="button" className="btn btn-secondary" onClick={onBookDiscovery}>
                        Get in touch
                      </button>
                    )}
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
                  writeLandingUrl(
                    {
                      gstep: "size",
                      size: null,
                      who: null,
                      noticing: null,
                      affected: null,
                      success: null,
                    },
                    "push",
                  );
                }}
              >
                Start again
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function mark(current: GuideStep, id: GuideStep): string {
  const order: GuideStep[] = ["size", "who", "noticing", "affected", "success", "contact", "result"];
  const here = order.indexOf(current);
  const at = order.indexOf(id);
  if (here === at) return "is-now";
  if (here > at) return "is-done";
  return "";
}
