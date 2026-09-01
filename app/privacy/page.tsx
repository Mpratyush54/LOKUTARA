import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalNav } from "@/components/legal/LegalNav";
import { LEGAL_VERSION, RETENTION_SCHEDULE } from "@/lib/legal/compliance";

export const metadata: Metadata = {
  title: "Privacy notice · Lokutara",
  description: "What Lokutara collects, why, who receives it, and your choices.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="container legal-inner">
        <p className="eyebrow">Effective {LEGAL_VERSION}</p>
        <h1>Privacy notice</h1>
        <p className="lead">
          Lokutara provides workplace learning, assessment screens, a member community,
          and counselling booking in India. This notice is for visitors, leads, account
          holders, assessment participants, community members, and buyers.
        </p>

        <section>
          <h2>Data and purpose</h2>
          <ul>
            <li>
              <strong>Account:</strong> name, email, phone, age, city, organisation,
              password hash, access plan, and consent record—to create, secure, and
              support your account.
            </li>
            <li>
              <strong>Assessments:</strong> answers, score, report, time, and assessment
              consent—to provide the screen and your report.
            </li>
            <li>
              <strong>Community:</strong> profile name, questions, replies, tags, and
              votes—to operate the member community. Other members can see posted content.
            </li>
            <li>
              <strong>Enquiries:</strong> contact and organisation details—to answer a
              discovery or counselling request. Do not put symptoms, diagnoses, case
              details, or confidential workplace allegations in a general form.
            </li>
            <li>
              <strong>Payments:</strong> payer, invoice, service, tax, status, and
              Razorpay references—to take payment, issue records, and meet tax duties.
              Lokutara does not ask this application to store full card or UPI credentials.
            </li>
            <li>
              <strong>Optional analytics:</strong> device, page, referral, campaign, and
              interaction identifiers—only after optional analytics consent.
            </li>
            <li>
              <strong>Security:</strong> sessions, IP-derived operational data, and
              relevant logs—to prevent abuse, investigate incidents, and comply with law.
            </li>
          </ul>
        </section>

        <section>
          <h2>Who receives data</h2>
          <p>
            Authorised Lokutara personnel and contracted processors receive only what they
            need. Current processor categories can include hosting/database providers,
            email or communications services, security/monitoring services, optional
            analytics vendors you accept, and Razorpay for payment. An employer does not
            receive individual counselling content. Assessment results are not shared with
            an employer unless the participant authorises a defined use or law requires it.
          </p>
        </section>

        <section>
          <h2>Retention</h2>
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
          <h2>Your choices and rights</h2>
          <p>
            You may ask for access, correction, erasure, consent withdrawal, or grievance
            handling. Signed-in users can manage profile and data controls from Account.
            Some invoice, security, dispute, or statutory records cannot be erased
            immediately; they are restricted and retained only for the applicable duty.
            Withdrawing consent does not invalidate processing already lawfully completed.
          </p>
          <LegalContact />
        </section>

        <section>
          <h2>Children</h2>
          <p>
            The software and paid services are for adults aged 18 or older. Do not create
            an account or submit another child’s data. A separately designed service for
            children would require verified parent or lawful-guardian authorisation and
            additional safeguards before launch.
          </p>
        </section>

        <section>
          <h2>Important boundaries</h2>
          <p>
            The assessment screens are developmental aids, not diagnosis or emergency
            services. The member community is not confidential clinical care. See the{" "}
            <Link href="/safeguards">clinical and assessment safeguards</Link>.
          </p>
        </section>

        <LegalNav />
        <p className="legal-back">
          <Link href="/">Back to Lokutara</Link>
        </p>
      </article>
    </main>
  );
}
