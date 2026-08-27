import { Router } from "express";
import { normalizeEvent } from "../../lib/tracking/events";
import { computeMetrics } from "../../lib/tracking/metrics";
import { buildAttribution, mergeAttribution } from "../../lib/tracking/attribution";
import { shouldLoadVendor, parseConsent } from "../../lib/tracking/consent";
import { asyncHandler, HttpError } from "../middleware/errors";
import type { EventStore, RateLimiter, SessionStore, VisitorStore } from "../stores/memory";

export function createEventsRouter(deps: {
  events: EventStore;
  visitors: VisitorStore;
  sessions: SessionStore;
  rateLimiter: RateLimiter;
  geoForIp?: (ip: string) => { country: string | null; city: string | null };
}): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const allowed = await deps.rateLimiter.allow(`events:${req.ip}`, 120, 60_000);
      if (!allowed) throw new HttpError(429, "rate_limited", "Too many events");

      const consent = parseConsent(req.cookies?.lokutara_consent);
      if (!shouldLoadVendor(consent, "analytics")) {
        res.status(202).json({ ok: true, skipped: true, reason: "consent" });
        return;
      }
      const body = req.body || {};
      const normalized = normalizeEvent({
        ...body,
        country: consent.analytics ? deps.geoForIp?.(req.ip || "")?.country ?? body.country ?? null : null,
        city: consent.analytics ? deps.geoForIp?.(req.ip || "")?.city ?? body.city ?? null : null,
      });
      if ("error" in normalized) throw new HttpError(400, "invalid", normalized.error);

      await deps.events.insert(normalized);

      const attribution = buildAttribution({
        search: `utm_source=${normalized.utmSource || ""}&utm_medium=${normalized.utmMedium || ""}&utm_campaign=${normalized.utmCampaign || ""}&utm_content=${normalized.utmContent || ""}`,
        referrer: normalized.referrer,
        landingPage: normalized.landingPage,
      });
      const existing = await deps.visitors.get(normalized.visitorId);
      const merged = mergeAttribution(existing?.firstTouch ?? null, {
        ...attribution,
        channel: (normalized.channel as typeof attribution.channel) || attribution.channel,
      });
      await deps.visitors.upsert({
        visitorId: normalized.visitorId,
        firstTouch: merged.firstTouch,
        lastTouch: merged.lastTouch,
        firstSeenAt: existing?.firstSeenAt ?? normalized.at,
        lastSeenAt: normalized.at,
        userId: normalized.userId,
      });

      await deps.sessions.touch({
        sessionId: normalized.sessionId,
        visitorId: normalized.visitorId,
        startedAt: normalized.at,
        lastSeenAt: normalized.at,
        landingPage: normalized.landingPage,
        device: normalized.device,
      });

      res.status(201).json({ ok: true });
    }),
  );

  router.get(
    "/metrics",
    asyncHandler(async (_req, res) => {
      const events = await deps.events.list();
      res.json(computeMetrics(events));
    }),
  );

  router.get("/vendors", (req, res) => {
    const consent = parseConsent(req.cookies?.lokutara_consent);
    res.json({
      analytics: shouldLoadVendor(consent, "analytics"),
      marketing: shouldLoadVendor(consent, "marketing"),
      posthog:
        Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_KEY) &&
        shouldLoadVendor(consent, "analytics"),
      ga:
        Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID) &&
        shouldLoadVendor(consent, "analytics"),
      clarity:
        Boolean(process.env.NEXT_PUBLIC_CLARITY_ID || process.env.CLARITY_ID) &&
        shouldLoadVendor(consent, "analytics"),
      meta:
        Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.META_PIXEL_ID) &&
        shouldLoadVendor(consent, "marketing"),
      linkedin: Boolean(process.env.LINKEDIN_PARTNER_ID) && shouldLoadVendor(consent, "marketing"),
    });
  });

  return router;
}
