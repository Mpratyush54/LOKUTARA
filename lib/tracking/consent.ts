export const CONSENT_COOKIE = "lokutara_consent";
export const CONSENT_STORAGE_KEY = "lokutara_consent";
export const VISITOR_COOKIE = "lokutara_vid";
export const SESSION_COOKIE = "lokutara_sid";

export type ConsentBucket = "necessary" | "analytics" | "marketing";

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string | null;
};

export const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  decidedAt: null,
};

export function parseConsent(raw: string | undefined | null): ConsentState {
  if (!raw) return { ...DEFAULT_CONSENT };
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : null,
    };
  } catch {
    return { ...DEFAULT_CONSENT };
  }
}

export function acceptAllConsent(now = new Date()): ConsentState {
  return {
    necessary: true,
    analytics: true,
    marketing: true,
    decidedAt: now.toISOString(),
  };
}

export function rejectOptionalConsent(now = new Date()): ConsentState {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    decidedAt: now.toISOString(),
  };
}

export function hasDecided(consent: ConsentState): boolean {
  return Boolean(consent.decidedAt);
}

export type VendorKind = "analytics" | "marketing";

export function shouldLoadVendor(consent: ConsentState, vendor: VendorKind): boolean {
  if (!hasDecided(consent)) return false;
  return vendor === "analytics" ? consent.analytics : consent.marketing;
}
