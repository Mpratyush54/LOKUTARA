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
        fill="var(--sage)"
      />
    </svg>
  );
}

function BuildIcon() {
  return (
    <svg viewBox="0 0 72 64" aria-hidden="true">
      <rect x="12" y="36" width="22" height="22" rx="3" fill="var(--forest)" />
      <rect x="38" y="38" width="22" height="20" rx="3" fill="var(--sage)" />
      <path d="M36 6 52 32H20Z" fill="var(--accent)" />
    </svg>
  );
}

function MeasureIcon() {
  return (
    <svg viewBox="0 0 72 64" aria-hidden="true">
      <rect x="6" y="42" width="8" height="14" rx="1.5" fill="var(--sage)" />
      <rect x="18" y="30" width="8" height="26" rx="1.5" fill="var(--sage)" />
      <rect x="30" y="22" width="8" height="34" rx="1.5" fill="var(--sage)" />
      <rect x="42" y="34" width="8" height="22" rx="1.5" fill="var(--sage)" />
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
        d="M8 50c1-16 9-22 18-18 3 1.4 5 6 5 11"
        fill="none"
        stroke="var(--forest)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M64 50c-1-16-9-22-18-18-3 1.4-5 6-5 11"
        fill="none"
        stroke="var(--forest)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="36" cy="24" r="13" fill="var(--sage)" />
      <circle cx="36" cy="20" r="4.2" fill="var(--accent)" />
      <path d="M26 33c2.4-6 17.6-6 20 0v3.5H26V33Z" fill="var(--accent)" />
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
