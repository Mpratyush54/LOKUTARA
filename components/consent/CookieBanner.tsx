"use client";

import Link from "next/link";
import type { ConsentState } from "@/lib/tracking/consent";
import { hasDecided } from "@/lib/tracking/consent";

type Props = {
  consent: ConsentState;
  onAcceptAll: () => void;
  onRejectOptional: () => void;
};

export function CookieBanner({ consent, onAcceptAll, onRejectOptional }: Props) {
  if (hasDecided(consent)) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-title" aria-modal="true">
      <div className="cookie-banner-inner">
        <div>
          <h2 id="cookie-title">Your cookie choices</h2>
          <p>
            Lokutara uses a few cookies so our Bengaluru L&D site works smoothly.{" "}
            <strong>Necessary</strong> cookies keep forms and security working.{" "}
            <strong>Analytics</strong> cookies help us understand which pages are useful — for
            example workshop and counselling interest — without reading your counselling form
            answers. <strong>Marketing</strong> cookies are optional and only for future ad
            measurement if we turn those on. Your choice is saved on this device so we will not
            ask again unless you clear site data.{" "}
            <Link href="/cookies">Cookie policy</Link>
          </p>
        </div>
        <div className="cookie-actions">
          <button type="button" className="btn btn-secondary" onClick={onRejectOptional}>
            Necessary only
          </button>
          <button type="button" className="btn btn-primary" onClick={onAcceptAll}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
