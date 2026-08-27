import { Router } from "express";
import { randomUUID } from "node:crypto";
import { validateLead } from "../../lib/leads/validate";
import { asyncHandler, HttpError } from "../middleware/errors";
import type { LeadStore, RateLimiter } from "../stores/memory";

export function createLeadsRouter(deps: { leads: LeadStore; rateLimiter: RateLimiter }): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const allowed = await deps.rateLimiter.allow(`leads:${req.ip}`, 8, 10 * 60_000);
      if (!allowed) throw new HttpError(429, "rate_limited", "Too many lead submissions");

      const parsed = validateLead(req.body || {});
      if (!parsed.ok) throw new HttpError(400, "invalid", "Lead validation failed", parsed.errors);

      const saved = await deps.leads.insert({
        ...parsed.value,
        id: randomUUID(),
        createdAt: new Date(),
        visitorId: typeof req.body?.visitorId === "string" ? req.body.visitorId : null,
      });

      res.status(201).json({
        ok: true,
        id: saved.id,
        type: saved.type,
      });
    }),
  );

  return router;
}
