import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalNav } from "@/components/legal/LegalNav";
import { LEGAL_VERSION } from "@/lib/legal/compliance";

export const metadata: Metadata = {
  title: "Clinical and assessment safeguards · Lokutara",
};

export default function SafeguardsPage() {
  return (
    <main className="legal-page">
      <article className="container legal-inner">
        <p className="eyebrow">Reviewed {LEGAL_VERSION}</p>
        <h1>Clinical and assessment safeguards</h1>
        <p className="lead">
          Clear boundaries for developmental screens, workplace use, counselling,
          confidentiality, and emergencies.
        </p>

        <section>
          <h2>What the current screens are</h2>
          <p>
            The in-product psychology inventory, OCEAN sketch, learning-style ranking,
            and placement screen are short, self-report conversation aids. They are not
            represented as licensed psychometrics, medical tests, diagnosis, or validated
            predictors of job performance. Their reports describe patterns in the answers
            provided; they do not establish a clinical fact.
          </p>
        </section>

        <section>
          <h2>Rules for workplace use</h2>
          <ul>
            <li>Tell the participant the purpose, audience, and voluntary or required status.</li>
            <li>Provide a reasonable accommodation or alternative route where needed.</li>
            <li>Do not use a score as the sole basis for employment or disciplinary action.</li>
            <li>Use a qualified human reviewer for any consequential interpretation.</li>
            <li>
              Share an individual report with an employer only under a defined, authorised
              arrangement; prefer aggregate or de-identified programme reporting.
            </li>
            <li>Do not infer diagnosis, disability, fitness, honesty, or risk from these screens.</li>
          </ul>
        </section>

        <section>
          <h2>Licensed instruments</h2>
          <p>
            Before adding a published psychometric, Lokutara must verify licensing,
            administrator qualifications, intended population, Indian relevance, evidence
            of reliability and validity, current norms, scoring security, accommodations,
            report wording, and retention. A product name or familiar model is not enough.
          </p>
        </section>

        <section>
          <h2>Counselling confidentiality</h2>
          <p>
            Counselling is separate from workplace assessment and general analytics.
            Employers may receive administrative information needed to operate a programme
            and an agreed aggregate summary, but not session content or an individual’s
            mental-health information. A professional may disclose only where the person
            authorises it or a specific legal or safety exception applies.
          </p>
        </section>

        <section>
          <h2>Professional credentials</h2>
          <p>
            Lokutara must verify the title, education, scope, registration, and current
            standing of each practitioner before listing or assigning them. Anyone
            described as a clinical or rehabilitation psychologist must have the
            registration required for that role in India. Other psychologists and
            counsellors must be described without implying a protected qualification they
            do not hold.
          </p>
        </section>

        <section>
          <h2>Emergency boundary</h2>
          <div className="safety-callout">
            <strong>This site is not a crisis or emergency service.</strong>
            <p>
              If someone may be in immediate danger, contact local emergency services or
              go to the nearest appropriate emergency facility. Do not wait for a website,
              community reply, booking confirmation, or email.
            </p>
          </div>
        </section>

        <section>
          <h2>Questions, accommodations, and complaints</h2>
          <p>
            Ask before starting if you need an accessible format, more time, an
            alternative interaction, clarification of who will see results, or a human
            review.
          </p>
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
