"use client";

import { useEffect, useState } from "react";
import {
  acceptAllConsent,
  acceptAnalyticsConsent,
  rejectOptionalConsent,
  type ConsentState,
} from "@/lib/tracking/consent";
import {
  readClientConsent,
  writeClientConsent,
} from "@/lib/tracking/client";

export function CookieSettings() {
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    setConsent(readClientConsent());
  }, []);

  function current() {
    const value = readClientConsent();
    setConsent(value);
    return value;
  }

  function save(next: ConsentState) {
    writeClientConsent(next);
    setConsent(next);
  }

  return (
    <div className="cookie-settings">
      <p>
        Current optional setting:{" "}
        <strong>
          {consent
            ? consent.marketing
              ? "analytics and marketing allowed"
              : consent.analytics
                ? "analytics only"
                : "necessary only"
            : "select Check setting"}
        </strong>
      </p>
      <div className="paywall-actions">
        <button type="button" className="btn btn-secondary" onClick={() => current()}>
          Check setting
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => save(rejectOptionalConsent())}
        >
          Withdraw optional consent
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => save(acceptAnalyticsConsent())}
        >
          Analytics only
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => save(acceptAllConsent())}
        >
          Allow optional cookies
        </button>
      </div>
      <p className="meta">
        Withdrawal stops future optional tracking from this site. Vendors may retain
        records already collected under their stated retention periods.
      </p>
    </div>
  );
}
