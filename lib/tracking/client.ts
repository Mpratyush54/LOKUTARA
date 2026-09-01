import {
  CONSENT_COOKIE,
  CONSENT_STORAGE_KEY,
  SESSION_COOKIE,
  VISITOR_COOKIE,
  hasDecided,
  parseConsent,
  shouldLoadVendor,
  type ConsentState,
} from "./consent";
import { resolveSessionId, resolveVisitorId } from "./identity";
import { buildAttribution } from "./attribution";
import { parseUserAgent } from "./device";
import type { AllowedEvent } from "./events";
import {
  assignVariant,
  normalizeExperimentConfig,
  resolveVariant,
  type ExperimentConfig,
  type ExperimentKey,
} from "./experiment";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function writeCookie(name: string, value: string, maxAgeSec: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
}

let sessionActivity = Date.now();
const experimentConfigCache = new Map<ExperimentKey, ExperimentConfig>();
let experimentConfigLoadedAt = 0;

function readLocalConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseConsent(raw);
    return hasDecided(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalConsent(consent: ConsentState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Private mode / quota — cookie still carries the decision.
  }
}

/**
 * Read consent from cookie, falling back to localStorage.
 * Safe to call during client render (sync) so the banner can stay dismissed
 * without waiting for an effect.
 */
export function readClientConsent(): ConsentState {
  const fromCookie = parseConsent(readCookie(CONSENT_COOKIE));
  if (hasDecided(fromCookie)) return fromCookie;
  const fromLocal = readLocalConsent();
  if (fromLocal) {
    // Rehydrate cookie if storage still has a decision (e.g. cookie cleared).
    writeCookie(CONSENT_COOKIE, JSON.stringify(fromLocal), 60 * 60 * 24 * 180);
    return fromLocal;
  }
  return fromCookie;
}

/** Persist consent to cookie + localStorage before UI dismisses. */
export function writeClientConsent(consent: ConsentState) {
  const payload = JSON.stringify(consent);
  writeCookie(CONSENT_COOKIE, payload, 60 * 60 * 24 * 180);
  writeLocalConsent(consent);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lokutara:consent", { detail: consent }));
  }
}

export function ensureIdentity(now = Date.now()) {
  const visitor = resolveVisitorId(readCookie(VISITOR_COOKIE));
  writeCookie(VISITOR_COOKIE, visitor.id, 60 * 60 * 24 * 365);
  const session = resolveSessionId(readCookie(SESSION_COOKIE), sessionActivity, now);
  sessionActivity = now;
  writeCookie(SESSION_COOKIE, session.id, 60 * 30);
  return { visitorId: visitor.id, sessionId: session.id, isNewVisitor: visitor.isNew, isNewSession: session.isNew };
}

export async function loadExperimentConfigs(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  const stale = Date.now() - experimentConfigLoadedAt > 60_000;
  if (!force && experimentConfigLoadedAt && !stale) return;
  try {
    const res = await fetch("/api/experiments", {
      credentials: "include",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { experiments?: ExperimentConfig[] };
    for (const row of body.experiments || []) {
      if (!row?.key) continue;
      experimentConfigCache.set(row.key, normalizeExperimentConfig(row.key, row));
    }
    experimentConfigLoadedAt = Date.now();
  } catch {
    // Keep last cache / local hash fallback.
  }
}

/** Test helper — reset in-memory experiment config cache. */
export function __resetExperimentConfigCacheForTests() {
  experimentConfigCache.clear();
  experimentConfigLoadedAt = 0;
}

export async function track(name: AllowedEvent, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const consent = readClientConsent();
  if (!shouldLoadVendor(consent, "analytics")) return;
  const ids = ensureIdentity();
  const attribution = buildAttribution({
    search: window.location.search,
    referrer: document.referrer || null,
    landingPage: window.location.pathname,
  });
  const ua = parseUserAgent(navigator.userAgent);
  await fetch("/api/events", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      visitorId: ids.visitorId,
      sessionId: ids.sessionId,
      path: window.location.pathname,
      title: document.title,
      ...attribution,
      ...ua,
      props,
    }),
  });
}

export async function submitLead(payload: Record<string, unknown>) {
  const ids = ensureIdentity();
  const response = await fetch("/api/leads", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, visitorId: ids.visitorId }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.errors?.join(", ") || body.error || "Could not send");
  return body;
}

/**
 * Assign experiment variant. Uses cached admin config when available;
 * otherwise falls back to the existing stable hash split.
 */
export function experimentFor(key: ExperimentKey) {
  const { visitorId } = ensureIdentity();
  const config = experimentConfigCache.get(key);
  if (!config) return assignVariant(visitorId, key);
  return resolveVariant(visitorId, key, config);
}
