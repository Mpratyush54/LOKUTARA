import Link from "next/link";
import { PRIVACY_EMAIL } from "@/lib/legal/compliance";

export function LegalNav() {
  return (
    <nav className="legal-nav" aria-label="Legal and safety">
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
      <Link href="/safeguards">Clinical &amp; assessment safeguards</Link>
      <Link href="/compliance">Compliance register</Link>
      <Link href="/cookies">Cookies</Link>
    </nav>
  );
}

export function LegalContact() {
  return (
    <p className="legal-contact">
      Privacy, rights, or grievance request:{" "}
      <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. Do not include
      counselling details in email.
    </p>
  );
}
