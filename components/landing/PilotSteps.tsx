import { PILOT_STEPS } from "@/lib/landing/content";

function ConnectIcon() {
  return (
    <svg viewBox="0 0 72 64" aria-hidden="true">
      <path
        d="M14 14h28a10 10 0 0 1 10 10v8a10 10 0 0 1-10 10H28l-12 8v-8h-2A10 10 0 0 1 4 24v-0a10 10 0 0 1 10-10Z"
        fill="var(--forest)"
      />
      <path
        d="M32 26h26a9 9 0 0 1 9 9v7a9 9 0 0 1-9 9h-8l-10 7v-7h-8a9 9 0 0 1-9-9v-7a9 9 0 0 1 9-9Z"
        fill="var(--sand)"
      />
    </svg>
  );
}

function BuildIcon() {
  return (
    <svg viewBox="0 0 72 64" aria-hidden="true">
      <rect x="10" y="34" width="22" height="22" rx="3" fill="var(--forest)" />
      <rect x="36" y="38" width="22" height="18" rx="3" fill="var(--sand)" />
      <path d="M24 8 46 34H2Z" fill="var(--accent)" />
    </svg>
  );
}

function MeasureIcon() {
  return (
    <svg viewBox="0 0 72 64" aria-hidden="true">
      <rect x="6" y="42" width="8" height="14" rx="1.5" fill="var(--sand)" />
      <rect x="18" y="30" width="8" height="26" rx="1.5" fill="var(--sand)" />
      <rect x="30" y="22" width="8" height="34" rx="1.5" fill="var(--sand)" />
      <rect x="42" y="34" width="8" height="22" rx="1.5" fill="var(--sand)" />
      <circle cx="48" cy="22" r="13" fill="none" stroke="var(--forest)" strokeWidth="4" />
      <circle cx="48" cy="22" r="7" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      <path d="M57 32l10 12" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 72 64" aria-hidden="true">
      <path
        d="M8 40c0-8 6-14 14-14 3 0 6 1 8 3 2-2 5-3 8-3 8 0 14 6 14 14v6c0 4-3 8-8 8H16c-5 0-8-4-8-8v-6Z"
        fill="var(--forest)"
      />
      <path
        d="M28 40c0-8 6-14 14-14 3 0 6 1 8 3 2-2 5-3 8-3 8 0 14 6 14 14v6c0 4-3 8-8 8H36c-5 0-8-4-8-8v-6Z"
        fill="var(--forest)"
      />
      <circle cx="36" cy="28" r="12" fill="var(--sand)" />
      <circle cx="36" cy="23" r="3.5" fill="var(--accent)" />
      <path d="M28 36c1.5-5 14.5-5 16 0v2H28v-2Z" fill="var(--accent)" />
    </svg>
  );
}

const ICONS = {
  connect: ConnectIcon,
  build: BuildIcon,
  measure: MeasureIcon,
  support: SupportIcon,
} as const;

function Arrow() {
  return (
    <svg className="pilot-arrow-icon" viewBox="0 0 28 16" aria-hidden="true">
      <path
        d="M0 8h22M16 2l8 6-8 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PilotSteps() {
  return (
    <>
      <header className="pilot-head">
        <p className="eyebrow">How a pilot works</p>
        <h2>Connect, Build, Measure, Support</h2>
      </header>
      <ol className="pilot-track" aria-label="Four steps of a pilot">
        {PILOT_STEPS.map((step, index) => {
          const Icon = ICONS[step.id];
          return (
            <li key={step.id} className="pilot-item">
              {index > 0 ? (
                <span className="pilot-arrow" aria-hidden="true">
                  <Arrow />
                </span>
              ) : null}
              <article className="pilot-card">
                <span className="pilot-num">{index + 1}</span>
                <div className="pilot-icon">
                  <Icon />
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            </li>
          );
        })}
      </ol>
    </>
  );
}
