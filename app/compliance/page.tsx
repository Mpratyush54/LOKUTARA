import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalNav } from "@/components/legal/LegalNav";
import {
  COMPLIANCE_REGISTER,
  LEGAL_VERSION,
  RETENTION_SCHEDULE,
} from "@/lib/legal/compliance";

export const metadata: Metadata = {
  title: "Compliance register · Lokutara",
  description:
    "The Indian legal and professional requirements Lokutara maps to product and operational controls.",
};

const STATUS = {
  "in-force": "In force",
  transition: "Staged commencement",
  "scope-review": "Counsel must confirm scope",
  professional: "Professional safeguard",
} as const;

export default function CompliancePage() {
  return (
    <main className="legal-page">
      <article className="container legal-wide">
        <p className="eyebrow">Control register · {LEGAL_VERSION}</p>
        <h1>Compliance register</h1>
        <p className="lead">
          This is Lokutara’s working India-first requirements map. It distinguishes law
          currently in force, staged requirements, scope questions for counsel, and
          professional safeguards. It is not a certification or a substitute for legal
          advice.
        </p>

        <div className="compliance-grid">
          {COMPLIANCE_REGISTER.map((item) => (
            <section className="compliance-card" key={item.id} id={item.id}>
              <div className="compliance-card-head">
                <h2>{item.name}</h2>
                <span className={`compliance-status is-${item.status}`}>
                  {STATUS[item.status]}
                </span>
              </div>
              <p>{item.applies}</p>
              <h3>Required control</h3>
              <ul>
                {item.controls.map((control) => (
                  <li key={control}>{control}</li>
                ))}
              </ul>
              <a href={item.source} rel="noreferrer" target="_blank">
                Primary or authoritative source ↗
              </a>
            </section>
          ))}
        </div>

        <section>
          <h2>Retention schedule</h2>
          <dl className="legal-schedule">
            {RETENTION_SCHEDULE.map((item) => (
              <div key={item.record}>
                <dt>{item.record}</dt>
                <dd>{item.period}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2>Controls that software cannot complete</h2>
          <ul>
            <li>Verify the legal entity name, address, GSTIN, and grievance contacts.</li>
            <li>Sign processor agreements and maintain a current vendor/subprocessor list.</li>
            <li>Confirm Karnataka mental-health-establishment scope and registrations.</li>
            <li>Verify every practitioner’s credentials and permitted scope.</li>
            <li>Run breach exercises, access reviews, backups, restoration tests, and staff training.</li>
            <li>
              Validate any psychometric before representing it as suitable for a particular
              population or decision.
            </li>
          </ul>
          <LegalContact />
        </section>

        <LegalNav />
        <p className="legal-back">
          <Link href="/">Back to Lokutara</Link>
        </p>
      </article>
    </main>
  );
}
