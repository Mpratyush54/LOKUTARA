import { describe, expect, it } from "vitest";
import {
  acceptAllConsent,
  DEFAULT_CONSENT,
  hasDecided,
  parseConsent,
  rejectOptionalConsent,
  shouldLoadVendor,
} from "@/lib/tracking/consent";

describe("consent", () => {
  it("defaults to necessary only", () => {
    expect(parseConsent(null)).toEqual(DEFAULT_CONSENT);
    expect(shouldLoadVendor(DEFAULT_CONSENT, "analytics")).toBe(false);
  });

  it("parses stored consent", () => {
    const raw = JSON.stringify({ analytics: true, marketing: false, decidedAt: "2026-08-26T00:00:00.000Z" });
    const consent = parseConsent(raw);
    expect(consent.analytics).toBe(true);
    expect(shouldLoadVendor(consent, "analytics")).toBe(true);
    expect(shouldLoadVendor(consent, "marketing")).toBe(false);
  });

  it("does not load vendors before a decision", () => {
    expect(shouldLoadVendor({ ...DEFAULT_CONSENT, analytics: true }, "analytics")).toBe(false);
  });

  it("accept all and reject optional", () => {
    const now = new Date("2026-08-26T10:00:00.000Z");
    expect(shouldLoadVendor(acceptAllConsent(now), "marketing")).toBe(true);
    expect(shouldLoadVendor(rejectOptionalConsent(now), "analytics")).toBe(false);
  });

  it("falls back when JSON is invalid", () => {
    expect(parseConsent("nope")).toEqual(DEFAULT_CONSENT);
  });

  it("hasDecided is true once decidedAt is set", () => {
    expect(hasDecided(DEFAULT_CONSENT)).toBe(false);
    expect(hasDecided(rejectOptionalConsent(new Date("2026-08-26T10:00:00.000Z")))).toBe(true);
  });
});
