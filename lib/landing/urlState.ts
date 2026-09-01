import type { SizeBand } from "@/lib/leads/validate";
import type { GuideLetter } from "./guide";

export type GuideStep = "size" | "who" | "noticing" | "affected" | "success" | "contact" | "result";

export const GUIDE_STEPS: GuideStep[] = ["size", "who", "noticing", "affected", "success", "contact", "result"];

const LETTERS = new Set(["a", "b", "c", "d", "e"]);
const SIZE_BANDS = new Set(["1-49", "50-500", "501-2000", "2000+"]);

export type LandingQuery = {
  audience: string | null;
  headcount: number | null;
  offer: string | null;
  pillar: string | null;
  phone: string | null;
  gstep: GuideStep | null;
  size: SizeBand | null;
  who: GuideLetter | null;
  noticing: GuideLetter | null;
  affected: GuideLetter | null;
  success: GuideLetter | null;
  buy: string | null;
  paid: boolean;
};

export const EMPTY_LANDING_QUERY: LandingQuery = {
  audience: null,
  headcount: null,
  offer: null,
  pillar: null,
  phone: null,
  gstep: null,
  size: null,
  who: null,
  noticing: null,
  affected: null,
  success: null,
  buy: null,
  paid: false,
};

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function asLetter(value: string | null): GuideLetter | null {
  if (value && LETTERS.has(value)) return value as GuideLetter;
  return null;
}

export function parseLandingQuery(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): LandingQuery {
  const get = (key: string) => {
    if (source instanceof URLSearchParams) return source.get(key);
    return first(source[key]);
  };
  const headcountRaw = Number(get("headcount"));
  const gstepRaw = get("gstep");
  const sizeRaw = get("size");
  return {
    audience: get("audience"),
    headcount: Number.isFinite(headcountRaw) && headcountRaw >= 20 ? Math.min(2000, Math.round(headcountRaw)) : null,
    offer: get("offer"),
    pillar: get("pillar"),
    phone: get("phone"),
    gstep: gstepRaw && GUIDE_STEPS.includes(gstepRaw as GuideStep) ? (gstepRaw as GuideStep) : null,
    size: sizeRaw && SIZE_BANDS.has(sizeRaw) ? (sizeRaw as SizeBand) : null,
    who: asLetter(get("who")),
    noticing: asLetter(get("noticing")),
    affected: asLetter(get("affected")),
    success: asLetter(get("success")),
    buy: get("buy"),
    paid: get("paid") === "1",
  };
}

export function landingHref(patch: Partial<LandingQuery>, base?: LandingQuery): string {
  const merged = { ...(base ?? EMPTY_LANDING_QUERY), ...patch };
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | boolean | null | undefined) => {
    if (value == null || value === "" || value === false) return;
    params.set(key, String(value === true ? "1" : value));
  };
  set("audience", merged.audience);
  set("headcount", merged.headcount);
  set("offer", merged.offer);
  set("pillar", merged.pillar);
  set("phone", merged.phone);
  set("gstep", merged.gstep);
  set("size", merged.size);
  set("who", merged.who);
  set("noticing", merged.noticing);
  set("affected", merged.affected);
  set("success", merged.success);
  set("buy", merged.buy);
  set("paid", merged.paid);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function writeLandingUrl(patch: Partial<LandingQuery>, mode: "replace" | "push" = "replace") {
  if (typeof window === "undefined") return;
  const current = parseLandingQuery(new URLSearchParams(window.location.search));
  const href = landingHref(patch, current);
  if (mode === "push") window.history.pushState(null, "", href);
  else window.history.replaceState(null, "", href);
  window.dispatchEvent(new Event("lokutara:url"));
}

export function sizeBandForHeadcount(headcount: number): SizeBand {
  if (headcount <= 49) return "1-49";
  if (headcount <= 500) return "50-500";
  if (headcount <= 2000) return "501-2000";
  return "2000+";
}

export function headcountForSizeBand(band: SizeBand): number {
  if (band === "1-49") return 40;
  if (band === "50-500") return 120;
  if (band === "501-2000") return 900;
  return 2000;
}

export function landingUrlLabel(query: LandingQuery): string {
  const href = landingHref(query);
  return href === "/" ? "lokutara.in/" : `lokutara.in${href}`;
}
