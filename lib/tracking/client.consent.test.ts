/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { CONSENT_COOKIE, CONSENT_STORAGE_KEY, acceptAllConsent, hasDecided } from "@/lib/tracking/consent";
import { readClientConsent, writeClientConsent } from "@/lib/tracking/client";

describe("client consent persistence", () => {
  afterEach(() => {
    document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  });

  it("writes cookie and localStorage, and stays decided after read", () => {
    const next = acceptAllConsent(new Date("2026-08-26T12:00:00.000Z"));
    writeClientConsent(next);
    expect(hasDecided(readClientConsent())).toBe(true);
    expect(readClientConsent().analytics).toBe(true);
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toContain("decidedAt");
  });

  it("rehydrates from localStorage when cookie is missing", () => {
    const next = acceptAllConsent(new Date("2026-08-26T12:00:00.000Z"));
    writeClientConsent(next);
    document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
    const restored = readClientConsent();
    expect(hasDecided(restored)).toBe(true);
    expect(restored.analytics).toBe(true);
  });
});
