"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ABOUT_POINTS, AUDIENCE, OFFERINGS, PILLARS, PRICING, BOOKING_STEPS, tierForHeadcount } from "@/lib/landing/content";
import { NeedGuide } from "@/components/landing/NeedGuide";
import { PilotSteps } from "@/components/landing/PilotSteps";
import { experimentFor, loadExperimentConfigs, submitLead, track } from "@/lib/tracking/client";
import { useReveal } from "@/hooks/useMotion";

type FormType = "discovery" | "counselling" | "popup";

function RevealSection({
  id,
  className = "section",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { ref, className: revealClass } = useReveal<HTMLElement>();
  return (
    <section ref={ref} id={id} className={`${className} ${revealClass}`}>
      {children}
    </section>
  );
}

export function LandingExperience() {
  const [audience, setAudience] = useState(0);
  const [headcount, setHeadcount] = useState(120);
  const [offering, setOffering] = useState<(typeof OFFERINGS)[number] | null>(null);
  const [pillar, setPillar] = useState(0);
  const [phone, setPhone] = useState(1);
  const [phonePaused, setPhonePaused] = useState(false);
  const [form, setForm] = useState<FormType | null>(null);
  const [popup, setPopup] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStep, setChatStep] = useState(0);
  const [chatLog, setChatLog] = useState<Array<{ from: "bot" | "user"; text: string }>>([
    { from: "bot", text: "Hello. Are you looking for a company discovery call, or individual counselling?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Book a discovery call");
  const [navOpen, setNavOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [parallax, setParallax] = useState({ y: 0, opacity: 1, visualY: 0 });
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const outcomesReveal = useReveal<HTMLElement>();
  const tier = useMemo(() => tierForHeadcount(headcount), [headcount]);
  const bars = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ left: i * 4.2 + 1, height: 25 + ((i * 17) % 55), delay: (i % 7) * 0.2 })),
    [],
  );

  useEffect(() => {
    void (async () => {
      await loadExperimentConfigs();
      const variant = experimentFor("hero_cta");
      setCtaLabel(variant === "variant" ? "Talk to the founders" : "Book a discovery call");
    })();
    const timer = window.setTimeout(() => {
      if (!sessionStorage.getItem("lokutara-popup")) {
        setPopup(true);
        track("popup_shown");
      }
    }, 4500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phonePaused) return;
    const id = window.setInterval(() => setPhone((p) => (p + 1) % BOOKING_STEPS.length), 4500);
    return () => window.clearInterval(id);
  }, [phonePaused]);

  useEffect(() => {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.matchMedia("(max-width: 920px)").matches;
    function onScroll() {
      const y = window.scrollY;
      setNavScrolled(y > 12);
      if (reduce || narrow) {
        setParallax({ y: 0, opacity: 1, visualY: 0 });
        return;
      }
      const hero = document.getElementById("hero");
      const heroH = hero?.offsetHeight || 1;
      if (y < heroH) {
        const p = y / heroH;
        setParallax({
          y: y * 0.18,
          opacity: Math.max(0.55, 1 - p * 0.4),
          visualY: y * 0.08,
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activePillar = PILLARS[pillar];
  const wheelRotation = -(pillar * (360 / PILLARS.length));
  const activeBooking = BOOKING_STEPS[phone];

  function openForm(type: FormType) {
    setForm(type);
    setNavOpen(false);
    const variant = experimentFor("hero_cta");
    track("cta_click", { type, experiment: "hero_cta", variant });
    track("form_start", { type, experiment: "hero_cta", variant });
  }

  function dismissPopup() {
    setPopup(false);
    sessionStorage.setItem("lokutara-popup", "1");
    track("popup_dismissed");
  }

  function goTo(hash: string) {
    setNavOpen(false);
    const el = document.querySelector(hash);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <header className={`topnav${navScrolled ? " is-scrolled" : ""}`}>
        <div className="container topnav-inner">
          <a className="logo" href="#hero" onClick={(e) => { e.preventDefault(); goTo("#hero"); }}>
            Lokutara
          </a>
          <nav aria-label="Primary">
            <a href="#offerings" onClick={(e) => { e.preventDefault(); goTo("#offerings"); }}>Offerings</a>
            <a href="/app">Product</a>
            <a href="#approach" onClick={(e) => { e.preventDefault(); goTo("#approach"); }}>Approach</a>
            <a href="#resources" onClick={(e) => { e.preventDefault(); goTo("#resources"); }}>Resources</a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); goTo("#contact"); }}>Contact</a>
          </nav>
          <button type="button" className="btn btn-secondary" onClick={() => openForm("discovery")}>
            {ctaLabel}
          </button>
          <button
            type="button"
            className={`nav-toggle${navOpen ? " is-open" : ""}`}
            aria-label={navOpen ? "Close menu" : "Open menu"}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
        <div className={`mobile-nav${navOpen ? " is-open" : ""}`}>
          <a href="#offerings" onClick={(e) => { e.preventDefault(); goTo("#offerings"); }}>Offerings</a>
          <a href="/app">Product</a>
          <a href="#approach" onClick={(e) => { e.preventDefault(); goTo("#approach"); }}>Approach</a>
          <a href="#resources" onClick={(e) => { e.preventDefault(); goTo("#resources"); }}>Resources</a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); goTo("#contact"); }}>Contact</a>
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => openForm("discovery")}>
            {ctaLabel}
          </button>
        </div>
      </header>

      <main>
        <section className="section hero" id="hero">
          <div className="hero-bars" aria-hidden="true">
            {bars.map((bar) => (
              <div
                key={bar.left}
                className="hero-bar"
                style={{ left: `${bar.left}%`, height: `${bar.height}%`, animationDelay: `${bar.delay}s` }}
              />
            ))}
          </div>
          <div className="container hero-grid">
            <div
              ref={heroCopyRef}
              className="hero-copy reveal is-visible"
              style={{ transform: `translateY(${parallax.y}px)`, opacity: parallax.opacity }}
            >
              <p className="eyebrow" style={{ color: "var(--forest)" }}>
                Bengaluru · August 2026
              </p>
              <h1>Capacity building your managers can actually use.</h1>
              <p className="lead" style={{ marginTop: 20 }}>
                Lokutara is a psychology-led learning and support practice for knowledge-work startups and SMEs. We start
                with a complimentary discovery call, then a paid custom workshop — with counselling alongside, not an EAP
                platform pretending to be live.
              </p>
              <div className="row" style={{ marginTop: 32, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-primary" onClick={() => openForm("discovery")}>
                  {ctaLabel}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => openForm("counselling")}>
                  Request counselling
                </button>
              </div>
              <div className="scroll-hint" aria-hidden="true">
                <span>Scroll</span>
              </div>
            </div>
            <div
              ref={heroVisualRef}
              className="hero-visual-stage"
              aria-hidden="true"
              style={{ transform: `translateY(${parallax.visualY}px)` }}
            >
              <div className="hero-orb hero-orb-1" />
              <div className="hero-orb hero-orb-2" />
              <div className="hero-photo">Connect · Build · Measure · Support</div>
              <svg className="hero-char-a funky" viewBox="0 0 96 96" fill="none">
                <circle cx="48" cy="48" r="44" stroke="var(--accent)" strokeWidth="3" strokeDasharray="8 6" />
                <ellipse cx="48" cy="52" rx="22" ry="18" fill="var(--accent)" />
              </svg>
              <svg className="hero-char-b funky" viewBox="0 0 88 88" fill="none">
                <rect x="12" y="28" width="64" height="48" rx="12" stroke="var(--forest)" strokeWidth="3" fill="var(--surface)" />
                <circle cx="32" cy="48" r="6" fill="var(--accent)" />
                <circle cx="56" cy="48" r="6" fill="var(--accent)" />
              </svg>
              <div className="hero-badge">
                <strong>30–45 min</strong>
                complimentary discovery
              </div>
            </div>
          </div>
        </section>

        <RevealSection id="audience">
          <div className="container stack" style={{ gap: 40 }}>
            <div style={{ maxWidth: "28ch" }}>
              <p className="eyebrow" style={{ color: "var(--forest)" }}>
                Who we work with
              </p>
              <h2>One team. Four ways we can help</h2>
            </div>
            <div className="audience-tabs">
              {AUDIENCE.map((tab, i) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`audience-tab reveal-delay-${(i % 4) + 1}${audience === i ? " active" : ""}`}
                  aria-pressed={audience === i}
                  onMouseEnter={() => setAudience(i)}
                  onFocus={() => setAudience(i)}
                  onClick={() => setAudience(i)}
                >
                  <h3>{tab.title}</h3>
                  <p>{tab.copy}</p>
                </button>
              ))}
            </div>
            <div className="audience-detail" key={audience}>
              <p className="meta">{AUDIENCE[audience].detail}</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openForm(AUDIENCE[audience].form)}
              >
                {AUDIENCE[audience].cta}
              </button>
            </div>
          </div>
        </RevealSection>

        <RevealSection id="guide">
          <div className="container stack" style={{ gap: 32 }}>
            <div style={{ maxWidth: "22ch" }}>
              <p className="eyebrow" style={{ color: "var(--forest)" }}>
                If the four doors are not obvious
              </p>
              <h2>Not sure what you need? Let’s figure it out.</h2>
            </div>
            <NeedGuide
              onBookDiscovery={() => openForm("discovery")}
              onAskPsychologist={() => openForm("counselling")}
            />
          </div>
        </RevealSection>

        <RevealSection id="size">
          <div className="container grid-2-1">
            <div className="size-tool">
              <p className="eyebrow" style={{ color: "var(--forest)" }}>
                Right-sized for you
              </p>
              <h2>Select your company size</h2>
              <p className="lead" style={{ marginTop: 12 }}>
                Drag to see how we talk to teams of your size. The first segment is 50–500 people in Bengaluru.
              </p>
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
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setHeadcount(value);
                  track("slider_change", { headcount: value, tier: tierForHeadcount(value).tier });
                }}
              />
              <div className="size-copy" key={tier.tier}>{tier.msg}</div>
            </div>
            <div className="size-illus">
              <div className="size-people">
                {Array.from({ length: tier.count }, (_, i) => (
                  <div key={i} className={`size-person${i % 3 === 0 ? " accent" : ""}`} style={{ height: 48 + (i % 5) * 10 }} />
                ))}
              </div>
              <span className="size-illus-label">
                {tier.tier} · {headcount.toLocaleString("en-IN")} people
              </span>
            </div>
          </div>
        </RevealSection>

        <RevealSection className="guarantee-band" id="pilot">
          <div className="container guarantee-inner">
            <PilotSteps />
          </div>
        </RevealSection>

        <section
          ref={outcomesReveal.ref}
          className={`section ${outcomesReveal.className}`}
          id="about"
        >
          <div className="container">
            <div className={`outcomes-stage stack${outcomesReveal.visible ? " is-live" : ""}`} style={{ gap: 48 }}>
              <div style={{ maxWidth: "44ch" }}>
                <p className="eyebrow">About the practice</p>
                <h2>Who is behind the work, and how it stays responsible.</h2>
              </div>
              <ol className="about-grid">
                {ABOUT_POINTS.map((point, index) => (
                  <li key={point.id} className="about-card">
                    <p className="about-index num">{String(index + 1).padStart(2, "0")}</p>
                    <h3>{point.title}</h3>
                    {point.copy ? <p>{point.copy}</p> : <p className="about-pending">Copy coming next.</p>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <RevealSection id="approach">
          <div className="container approach-layout">
            <div className="approach-copy">
              <div>
                <p className="eyebrow" style={{ color: "var(--forest)" }}>
                  Four pillars + how we deliver
                </p>
                <h2>Click the wheel.</h2>
                <p className="lead" style={{ margin: "16px 0 0" }}>
                  Each node rotates into place. Launch vs later is labelled honestly.
                </p>
              </div>
              <div className="wheel-detail" key={activePillar.id}>
                <span className="pill">{activePillar.status}</span>
                <h3>{activePillar.label}</h3>
                <p>{activePillar.detail}</p>
                <p className="wheel-action">{activePillar.action}</p>
                <div className="wheel-cta">
                  {activePillar.id === "support" ? (
                    <>
                      <button type="button" className="btn btn-primary" onClick={() => openForm("counselling")}>
                        Request counselling
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => openForm("discovery")}>
                        Book a discovery call
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-primary" onClick={() => openForm("discovery")}>
                        Book a discovery call
                      </button>
                      {activePillar.accent === "now" ? (
                        <button type="button" className="btn btn-secondary" onClick={() => openForm("counselling")}>
                          Request counselling
                        </button>
                      ) : (
                        <button type="button" className="btn btn-secondary" onClick={() => goTo("#app")}>
                          See how booking works
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="approach-wheel">
              <div className="wheel-wrap" aria-label="Lokutara pillars">
                <div className="wheel-orbit" aria-hidden="true" />
                <div
                  className={`wheel-center${activePillar.accent === "now" ? " is-now" : " is-later"}`}
                  key={`center-${activePillar.id}`}
                >
                  {activePillar.label}
                </div>
                <div className="wheel-ring" style={{ transform: `rotate(${wheelRotation}deg)` }}>
                  {PILLARS.map((node, i) => {
                    const angle = (i / PILLARS.length) * Math.PI * 2 - Math.PI / 2;
                    const r = 42;
                    return (
                      <button
                        key={node.id}
                        type="button"
                        className={`wheel-node${pillar === i ? " active" : ""}${node.accent === "now" ? " is-now" : ""}`}
                        style={{
                          left: `${50 + Math.cos(angle) * r}%`,
                          top: `${50 + Math.sin(angle) * r}%`,
                          transform: `translate(-50%, -50%) rotate(${-wheelRotation}deg)${pillar === i ? " scale(1.08)" : ""}`,
                        }}
                        onClick={() => {
                          setPillar(i);
                          track("pillar_select", { pillar: node.id });
                        }}
                      >
                        {node.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </RevealSection>

        <RevealSection id="offerings">
          <div className="container stack" style={{ gap: 40 }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--forest)" }}>
                Launch offer
              </p>
              <h2>What we sell now. Click for detail.</h2>
            </div>
            <div className="service-grid">
              {OFFERINGS.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  className={`service-card reveal-delay-${(i % 4) + 1}`}
                  onClick={() => {
                    setOffering(item);
                    track("offering_open", { id: item.id });
                  }}
                >
                  <span className="svc-icon">●</span>
                  <h3>{item.title}</h3>
                  <p>{item.blurb}</p>
                  <span className="svc-arrow">{item.tag} →</span>
                </button>
              ))}
            </div>
          </div>
        </RevealSection>

        <RevealSection id="app">
          <div className="container stack phone-section" style={{ gap: 32 }}>
            <div style={{ textAlign: "center", maxWidth: "46ch", marginInline: "auto" }}>
              <p className="eyebrow" style={{ color: "var(--forest)" }}>
                Booking
              </p>
              <h2>Request, then we confirm.</h2>
              <p className="lead" style={{ marginInline: "auto" }}>
                The app is not live. Tap a phone to walk the human-handled path — what you send, what we confirm, what comes back.
              </p>
            </div>
            <div className="phone-carousel" onMouseEnter={() => setPhonePaused(true)} onMouseLeave={() => setPhonePaused(false)}>
              {BOOKING_STEPS.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  className={`phone-frame ${phone === i ? "center" : "side"}`}
                  aria-pressed={phone === i}
                  onClick={() => {
                    setPhone(i);
                    setPhonePaused(true);
                    track("booking_step_view", { step: item.id });
                  }}
                >
                  <div className="phone-screen">
                    <div className="phone-ui">
                      <div className="phone-step">Step {i + 1} of {BOOKING_STEPS.length}</div>
                      <div className="phone-title">{item.title}</div>
                      <div className="ui-list">
                        {item.ui.map((row, ri) => (
                          <div key={row} className={`ui-row${ri === 0 ? " is-accent" : ""}`}>{row}</div>
                        ))}
                      </div>
                      <div className="ui-btn">{item.cta}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="carousel-dots">
              {BOOKING_STEPS.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  className={`carousel-dot${phone === i ? " active" : ""}`}
                  onClick={() => {
                    setPhone(i);
                    setPhonePaused(true);
                  }}
                  aria-label={item.title}
                >
                  <span />
                </button>
              ))}
            </div>
            <div className="booking-explain" key={activeBooking.id}>
              <p className="eyebrow">Step {phone + 1}</p>
              <h3>{activeBooking.headline}</h3>
              <p>{activeBooking.body}</p>
              <div className="booking-cta-row">
                <button type="button" className="btn btn-primary" onClick={() => openForm("discovery")}>
                  Book a discovery call
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => openForm("counselling")}>
                  Request counselling
                </button>
              </div>
            </div>
          </div>
        </RevealSection>

        <RevealSection id="resources">
          <div className="container stack" style={{ gap: 48 }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--forest)" }}>
                Resource hub
              </p>
              <h2>Material we can talk through in a session.</h2>
            </div>
            <div className="resource-grid">
              {[
                ["Note", "Manager effectiveness, without clinical jargon"],
                ["Guide", "What a discovery call covers"],
                ["Boundary", "Non-emergency counselling and referral"],
                ["Roadmap", "Chat and the mobile app — later"],
              ].map(([kind, title]) => (
                <article key={title} className="resource-card">
                  <div className="resource-cover">{kind}</div>
                  <div className="card-body">
                    <h3>{title}</h3>
                    <p>Published as we run pilots. Not case studies we have not earned.</p>
                  </div>
                </article>
              ))}
            </div>
            <div>
              <h3 style={{ marginBottom: 8 }}>Launch prices</h3>
              <article className="log-row">
                <span className="meta num">₹{PRICING.virtualSession.inr.toLocaleString("en-IN")}</span>
                <div>
                  <h3>{PRICING.virtualSession.label}</h3>
                </div>
                <span className="meta">ex-GST</span>
              </article>
              <article className="log-row">
                <span className="meta num">₹{PRICING.workshop.inr.toLocaleString("en-IN")}</span>
                <div>
                  <h3>{PRICING.workshop.label}</h3>
                </div>
                <span className="meta">ex-GST</span>
              </article>
              <article className="log-row">
                <span className="meta num">₹{PRICING.fullDay.inr.toLocaleString("en-IN")}</span>
                <div>
                  <h3>{PRICING.fullDay.label}</h3>
                </div>
                <span className="meta">ex-GST</span>
              </article>
            </div>
          </div>
        </RevealSection>

        <RevealSection id="contact">
          <div className="container">
            <div className="cta-band">
              <h2>Book 30–45 minutes with Joel and Divya.</h2>
              <p className="lead" style={{ margin: "16px auto 32px" }}>
                Founders, 50:50, full-time, Bengaluru. Tell us the team and the problem. We will say if a pilot fits.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => openForm("discovery")}>
                {ctaLabel}
              </button>
            </div>
          </div>
        </RevealSection>
      </main>

      <footer className="pagefoot">
        <div className="container row-between">
          <span>© Lokutara · Bengaluru · 2026</span>
          <span className="meta">
            <a href="/cookies">Cookies</a>
            {" · "}
            Not an emergency or psychiatric crisis line.
          </span>
        </div>
      </footer>

      <div className={`service-page${offering ? " open" : ""}`}>
        <div className="service-page-inner">
          <button type="button" className="btn btn-ghost" onClick={() => setOffering(null)}>
            ← Back to offerings
          </button>
          {offering ? (
            <>
              <p className="pill">{offering.tag}</p>
              <h1 style={{ marginTop: 16 }}>{offering.title}</h1>
              <p className="lead" style={{ marginTop: 16 }}>
                {offering.detail}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className={`overlay${popup ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && dismissPopup()}>
        <div className="modal" role="dialog" aria-labelledby="popup-title">
          <button type="button" className="modal-close" onClick={dismissPopup} aria-label="Close">
            ×
          </button>
          <p className="eyebrow">Complimentary · 30–45 min</p>
          <h2 id="popup-title">Book a discovery call</h2>
          <p style={{ color: "var(--muted)", margin: "12px 0 24px" }}>
            For HR leads and founders. We will not send you a fake webinar.
          </p>
          <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={() => { dismissPopup(); openForm("popup"); }}>
            Continue
          </button>
          <button type="button" className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }} onClick={dismissPopup}>
            Maybe later
          </button>
        </div>
      </div>

      {form ? <LeadModal type={form} onClose={() => setForm(null)} /> : null}

      <div className="chatbot">
        <div className={`chat-panel${chatOpen ? " open" : ""}`}>
          <div className="chat-header">Lokutara</div>
          <div className="chat-body">
            {chatLog.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.from}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              const text = chatInput.trim();
              if (!text) return;
              setChatLog((log) => [...log, { from: "user", text }]);
              setChatInput("");
              track("chat_widget_message");
              if (chatStep === 0) {
                setChatStep(1);
                window.setTimeout(() => {
                  setChatLog((log) => [
                    ...log,
                    { from: "bot", text: "Use Book a discovery call on the page, or Request counselling. A person will reply." },
                  ]);
                }, 400);
              }
            }}
          >
            <input className="input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} aria-label="Chat message" />
            <button type="submit" className="btn btn-primary">
              Send
            </button>
          </form>
        </div>
        <button
          type="button"
          className="chat-toggle"
          aria-label="Open chat"
          onClick={() => {
            setChatOpen((o) => !o);
            track("chat_widget_opened");
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z"
            />
          </svg>
        </button>
      </div>
    </>
  );
}

function LeadModal({ type, onClose }: { type: FormType; onClose: () => void }) {
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const isCounselling = type === "counselling";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      await submitLead({
        type: type === "popup" ? "discovery" : type,
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone"),
        role: data.get("role"),
        organisation: data.get("organisation"),
        sizeBand: data.get("sizeBand"),
        preferredTime: data.get("preferredTime"),
      });
      await track("lead_submitted", { type: isCounselling ? "counselling" : "discovery" });
      if (type === "popup") await track("popup_submitted");
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    }
  }

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={onSubmit}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{isCounselling ? "Request counselling" : "Discovery call"}</h2>
        <p className="meta" style={{ margin: "8px 0 20px" }}>
          {isCounselling
            ? "Non-emergency only. Do not write clinical details here."
            : "30–45 minutes with the founders. Complimentary."}
        </p>
        {ok ? (
          <p className="form-ok">Received. Joel or Divya will reply.</p>
        ) : (
          <>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="field">
              <label htmlFor="name">Name</label>
              <input className="input" id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input className="input" id="email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input className="input" id="phone" name="phone" required />
            </div>
            {isCounselling ? (
              <div className="field">
                <label htmlFor="preferredTime">Preferred time</label>
                <input className="input" id="preferredTime" name="preferredTime" />
              </div>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="role">Role</label>
                  <input className="input" id="role" name="role" />
                </div>
                <div className="field">
                  <label htmlFor="organisation">Organisation</label>
                  <input className="input" id="organisation" name="organisation" required />
                </div>
                <div className="field">
                  <label htmlFor="sizeBand">Company size</label>
                  <select className="input" id="sizeBand" name="sizeBand" defaultValue="50-500">
                    <option value="1-49">Under 50</option>
                    <option value="50-500">50–500</option>
                    <option value="501-2000">501–2000</option>
                    <option value="2000+">2000+</option>
                  </select>
                </div>
              </>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
              Send
            </button>
          </>
        )}
      </form>
    </div>
  );
}
