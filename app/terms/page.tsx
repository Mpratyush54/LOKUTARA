import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalNav } from "@/components/legal/LegalNav";
import { LEGAL_VERSION } from "@/lib/legal/compliance";

export const metadata: Metadata = {
  title: "Terms of service · Lokutara",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article className="container legal-inner">
        <p className="eyebrow">Effective {LEGAL_VERSION}</p>
        <h1>Terms of service</h1>
        <p className="lead">
          These terms cover the Lokutara website, workspace, developmental assessment
          screens, community, workshops, and online booking. A signed proposal or
          counselling agreement may add service-specific terms.
        </p>

        <section>
          <h2>Who may use the service</h2>
          <p>
            You must be at least 18, able to enter a contract, and provide accurate
            information. Keep your account private. Tell us promptly if you believe it has
            been accessed without permission.
          </p>
        </section>

        <section>
          <h2>Assessments</h2>
          <p>
            Screens in this workspace are for reflection and development. Unless a screen
            expressly identifies a publisher, validation study, norm group, and qualified
            administration requirement, it is not a licensed psychometric instrument. It
            is not medical diagnosis, treatment, or a sole basis for hiring, firing,
            promotion, discipline, compensation, or another consequential decision.
          </p>
        </section>

        <section>
          <h2>Counselling and emergencies</h2>
          <p>
            A booking or community post does not create emergency care. If there is
            immediate danger, contact local emergency services or an appropriate crisis
            service. Clinical services, when offered, are delivered only under a separate
            informed-consent process by a professional whose role and credentials are
            stated. Employers do not receive session content.
          </p>
        </section>

        <section>
          <h2>Community</h2>
          <p>
            Do not post confidential employer information, personal data about another
            person, clinical records, threats, harassment, discrimination, unlawful
            material, or content you lack the right to share. Community replies are
            educational and are not a substitute for professional care. Lokutara may
            restrict, preserve, or remove content to protect people, enforce these terms,
            or comply with law.
          </p>
        </section>

        <section>
          <h2>Prices, scheduling, cancellation, and refunds</h2>
          <p>
            Checkout shows the payable amount including GST. A payment reserves the
            purchased service, subject to scheduling confirmation. The applicable
            proposal or checkout must state the delivery, cancellation, rescheduling, and
            refund terms before payment. Lokutara will provide a full refund if it accepts
            payment but cannot provide the purchased service. Nothing limits mandatory
            consumer remedies. Contact us before paying if a date is essential.
          </p>
        </section>

        <section>
          <h2>Intellectual property and acceptable use</h2>
          <p>
            Lokutara materials may be used for the booked participant or internal team
            purpose. Do not resell, scrape, reverse engineer, publish assessment items, or
            use the service to train another model without written permission. Your own
            community content remains yours; you give Lokutara a limited licence to host
            and display it for the community until it is removed, subject to lawful
            retention.
          </p>
        </section>

        <section>
          <h2>Availability and responsibility</h2>
          <p>
            We aim to keep the service accurate and available, but developmental outputs
            require human judgment. Nothing excludes a right or liability that cannot be
            excluded under Indian law. Otherwise, responsibility is limited to reasonably
            foreseeable direct loss connected to the affected paid service.
          </p>
        </section>

        <section>
          <h2>Complaints and governing law</h2>
          <p>
            Raise a service, privacy, or content complaint with enough non-sensitive detail
            for us to identify it. These terms are governed by Indian law, with courts in
            Bengaluru, Karnataka having jurisdiction, subject to mandatory consumer
            forums and other non-excludable remedies.
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
