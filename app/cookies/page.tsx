import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie policy · Lokutara",
  description:
    "How Lokutara uses necessary, analytics, and marketing cookies on our Bengaluru learning and development site.",
};

export default function CookiesPage() {
  return (
    <main className="legal-page">
      <div className="container legal-inner">
        <p className="eyebrow">Lokutara · Bengaluru</p>
        <h1>Cookie policy</h1>
        <p className="lead">
          This page explains the cookies we use on the Lokutara site. We build psychology-led
          workshops, manager effectiveness programmes, and counselling for Bengaluru startups and
          SMEs — and we want cookie choices to be clear, not buried in jargon.
        </p>

        <section>
          <h2>Necessary cookies</h2>
          <p>
            These keep the site working: remembering that you have already chosen cookie settings,
            securing form submissions, and basic session continuity while you browse. They do not
            profile you for advertising. You can use the site with only these enabled.
          </p>
        </section>

        <section>
          <h2>Analytics cookies</h2>
          <p>
            If you accept analytics, we measure things like page views, return visits, and which
            calls-to-action people use (for example booking a discovery call or exploring
            workshops). That helps us improve the site for founders and people managers. Counselling
            form answers and clinical detail are never sent to analytics tools.
          </p>
        </section>

        <section>
          <h2>Marketing cookies</h2>
          <p>
            These are optional. If we later connect ad platforms (for example Meta), marketing
            cookies would help us understand whether campaigns led people here. They stay off unless
            you choose Accept all (or a future preference control that opts you in).
          </p>
        </section>

        <section>
          <h2>How long your choice lasts</h2>
          <p>
            When you pick Accept all or Necessary only, we store that decision in a first-party
            cookie and in your browser local storage (about six months for the cookie). We will not
            show the banner again on this browser until you clear site data or change preferences.
            Clearing cookies or site storage will bring the banner back so you can choose again.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions about privacy or cookies for Lokutara in Bengaluru: reach us through the
            discovery call form on the homepage.
          </p>
        </section>

        <p className="legal-back">
          <Link href="/">Back to Lokutara</Link>
        </p>
      </div>
    </main>
  );
}
