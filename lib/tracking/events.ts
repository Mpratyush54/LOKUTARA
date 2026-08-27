const BLOCKED_KEYS = new Set([
  "clinicalNotes",
  "sessionNotes",
  "diagnosis",
  "symptoms",
  "healthDetails",
  "messageBody",
  "counsellingNotes",
]);

export const ALLOWED_EVENTS = [
  "page_view",
  "session_start",
  "cta_click",
  "form_start",
  "lead_submitted",
  "popup_shown",
  "popup_dismissed",
  "popup_submitted",
  "chat_widget_opened",
  "chat_widget_message",
  "slider_change",
  "offering_open",
  "scroll_depth",
] as const;

export type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

export function isAllowedEvent(name: string): name is AllowedEvent {
  return (ALLOWED_EVENTS as readonly string[]).includes(name);
}

export function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (BLOCKED_KEYS.has(key)) continue;
    if (typeof value === "string" && value.length > 500) {
      out[key] = value.slice(0, 500);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export type AnalyticsEventInput = {
  name: string;
  visitorId: string;
  sessionId: string;
  userId?: string | null;
  path?: string;
  title?: string;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  channel?: string | null;
  landingPage?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  country?: string | null;
  city?: string | null;
  props?: Record<string, unknown>;
  at?: string | Date;
};

export type StoredAnalyticsEvent = {
  name: AllowedEvent;
  visitorId: string;
  sessionId: string;
  userId: string | null;
  path: string;
  title: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  channel: string | null;
  landingPage: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  props: Record<string, unknown>;
  at: Date;
};

export function normalizeEvent(input: AnalyticsEventInput, now = new Date()): StoredAnalyticsEvent | { error: string } {
  if (!isAllowedEvent(input.name)) return { error: `unknown event: ${input.name}` };
  if (!input.visitorId) return { error: "visitorId required" };
  if (!input.sessionId) return { error: "sessionId required" };
  const at = input.at ? new Date(input.at) : now;
  if (Number.isNaN(at.getTime())) return { error: "invalid at" };
  return {
    name: input.name,
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    userId: input.userId ?? null,
    path: input.path || "/",
    title: input.title || "",
    referrer: input.referrer ?? null,
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    utmContent: input.utmContent ?? null,
    channel: input.channel ?? null,
    landingPage: input.landingPage ?? null,
    device: input.device ?? null,
    browser: input.browser ?? null,
    os: input.os ?? null,
    country: input.country ?? null,
    city: input.city ?? null,
    props: sanitizeProps(input.props),
    at,
  };
}
