export type TrafficChannel = "direct" | "organic" | "referral" | "social" | "paid" | "email";

export type Attribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrer: string | null;
  landingPage: string | null;
  channel: TrafficChannel;
};

const SOCIAL_HOSTS = ["linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com", "youtube.com"];
const SEARCH_HOSTS = ["google.", "bing.com", "yahoo.com", "duckduckgo.com"];

export function parseUtm(search: string): Pick<Attribution, "utmSource" | "utmMedium" | "utmCampaign" | "utmContent"> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const read = (key: string) => params.get(key) || params.get(key.toLowerCase());
  return {
    utmSource: emptyToNull(read("utm_source")),
    utmMedium: emptyToNull(read("utm_medium")),
    utmCampaign: emptyToNull(read("utm_campaign")),
    utmContent: emptyToNull(read("utm_content")),
  };
}

export function classifyChannel(input: {
  utmMedium?: string | null;
  utmSource?: string | null;
  referrer?: string | null;
}): TrafficChannel {
  const medium = (input.utmMedium || "").toLowerCase();
  const source = (input.utmSource || "").toLowerCase();
  if (medium.includes("email") || source.includes("email") || source === "newsletter") return "email";
  if (medium.includes("cpc") || medium.includes("ppc") || medium.includes("paid") || medium === "ads") return "paid";
  if (medium.includes("social") || SOCIAL_HOSTS.some((h) => source.includes(h.replace(".com", "")))) return "social";
  if (medium.includes("organic")) return "organic";
  if (medium.includes("referral")) return "referral";

  const refHost = referrerHost(input.referrer);
  if (!refHost) return "direct";
  if (SOCIAL_HOSTS.some((h) => refHost.includes(h))) return "social";
  if (SEARCH_HOSTS.some((h) => refHost.includes(h))) return "organic";
  return "referral";
}

export function buildAttribution(input: {
  search: string;
  referrer?: string | null;
  landingPage?: string | null;
}): Attribution {
  const utm = parseUtm(input.search);
  return {
    ...utm,
    referrer: emptyToNull(input.referrer || null),
    landingPage: emptyToNull(input.landingPage || null),
    channel: classifyChannel({
      utmMedium: utm.utmMedium,
      utmSource: utm.utmSource,
      referrer: input.referrer,
    }),
  };
}

export function mergeAttribution(first: Attribution | null, latest: Attribution): {
  firstTouch: Attribution;
  lastTouch: Attribution;
} {
  return {
    firstTouch: first ?? latest,
    lastTouch: latest,
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}
