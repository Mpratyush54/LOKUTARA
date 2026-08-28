import { Router } from "express";
import { computeMetrics } from "../../lib/tracking/metrics";
import {
  DEFAULT_EXPERIMENT_CONFIGS,
  KNOWN_EXPERIMENTS,
  isExperimentKey,
  normalizeExperimentConfig,
  type ExperimentKey,
  type ExperimentVariant,
} from "../../lib/tracking/experiment";
import { computeExperimentStats } from "../../lib/tracking/experimentStats";
import { asyncHandler, HttpError } from "../middleware/errors";
import {
  ADMIN_COOKIE,
  emailsEqual,
  isAdminAuthorized,
  readAdminCredentials,
  requireAdmin,
  secretsEqual,
} from "../middleware/adminAuth";
import type {
  AccountStore,
  AssessmentRunStore,
  BillingSettingsStore,
  EventStore,
  ExperimentConfigStore,
  LeadStore,
  StoredExperimentConfig,
  StoredLead,
  ThreadStore,
} from "../stores/memory";
import { loadProductSnapshot } from "../../lib/product/snapshot";
import { createProductUpstream, type ProductUpstream } from "../../lib/product/upstream";
import { dailySeries } from "../../lib/charts/series";
import {
  ALL_MODULES_OFF,
  DEFAULT_BILLING_SETTINGS,
  addDays,
  presentAccount,
  resolveAccess,
  type BillingSettings,
  type ModuleFlags,
} from "../../lib/access/billing";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/** Counselling leads: redact contact surfaces; discovery/popup keep full contact for founders. */
export function presentLeadForAdmin(lead: StoredLead) {
  const isCounselling = lead.type === "counselling";
  return {
    id: lead.id,
    type: lead.type,
    name: lead.name,
    email: isCounselling ? maskEmail(lead.email) : lead.email,
    phone: isCounselling ? maskPhone(lead.phone) : lead.phone,
    role: lead.role,
    organisation: lead.organisation,
    sizeBand: lead.sizeBand,
    // Scheduling preference only — forms never collect clinical detail.
    preferredTime: isCounselling ? null : lead.preferredTime,
    visitorId: lead.visitorId,
    createdAt: lead.createdAt.toISOString(),
    redacted: isCounselling,
  };
}

export function presentEventForAdmin(event: Awaited<ReturnType<EventStore["list"]>>[number]) {
  const experiment =
    typeof event.props?.experiment === "string" ? event.props.experiment : null;
  const variantRaw = event.props?.variant;
  const variant =
    variantRaw === "control" || variantRaw === "variant" ? (variantRaw as ExperimentVariant) : null;
  return {
    name: event.name,
    at: event.at.toISOString(),
    path: event.path,
    visitorId: event.visitorId,
    sessionId: event.sessionId,
    channel: event.channel,
    experiment,
    variant,
    props: event.props,
  };
}

async function resolveConfigs(store: ExperimentConfigStore) {
  const stored = await store.list();
  const byKey = new Map(stored.map((row) => [row.key, row]));
  return KNOWN_EXPERIMENTS.map((meta) => {
    const row = byKey.get(meta.key);
    const config = normalizeExperimentConfig(meta.key, row ?? undefined);
    return {
      ...meta,
      ...config,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  });
}

export function createAdminRouter(deps: {
  events: EventStore;
  leads: LeadStore;
  experiments: ExperimentConfigStore;
  /** Password override for tests (ADMIN_PASSWORD / ADMIN_DASHBOARD_SECRET). */
  adminSecret?: string | null;
  /** Email override for tests (ADMIN_EMAIL). */
  adminEmail?: string | null;
  product?: ProductUpstream;
  accounts?: AccountStore;
  billing?: BillingSettingsStore;
  threads?: ThreadStore;
  assessmentRuns?: AssessmentRunStore;
}): Router {
  const router = Router();
  const envCreds = readAdminCredentials();
  const password =
    deps.adminSecret !== undefined ? deps.adminSecret : envCreds.password;
  const email = deps.adminEmail !== undefined ? deps.adminEmail : envCreds.email;
  const gate = requireAdmin(password);

  router.get("/session", (req, res) => {
    if (!password) {
      res.status(503).json({ ok: false, authenticated: false, configured: false });
      return;
    }
    res.json({
      ok: true,
      authenticated: isAdminAuthorized(req, password),
      configured: true,
      emailRequired: Boolean(email),
    });
  });

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      if (!password) {
        throw new HttpError(
          503,
          "admin_disabled",
          "Admin credentials are not configured (set ADMIN_EMAIL + ADMIN_PASSWORD, or ADMIN_DASHBOARD_SECRET)",
        );
      }
      const body = req.body || {};
      const providedPassword =
        typeof body.password === "string"
          ? body.password.trim()
          : typeof body.secret === "string"
            ? body.secret.trim()
            : "";
      if (email) {
        const providedEmail = typeof body.email === "string" ? body.email.trim() : "";
        if (
          !providedEmail ||
          !emailsEqual(providedEmail, email) ||
          !providedPassword ||
          !secretsEqual(providedPassword, password)
        ) {
          throw new HttpError(401, "unauthorized", "Invalid email or password");
        }
      } else if (!providedPassword || !secretsEqual(providedPassword, password)) {
        throw new HttpError(401, "unauthorized", "Invalid admin password");
      }
      res.cookie(ADMIN_COOKIE, password, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7 * 1000,
      });
      res.json({ ok: true, authenticated: true });
    }),
  );

  router.post("/logout", (_req, res) => {
    res.clearCookie(ADMIN_COOKIE, { path: "/" });
    res.json({ ok: true, authenticated: false });
  });

  router.get(
    "/metrics",
    gate,
    asyncHandler(async (_req, res) => {
      const events = await deps.events.list();
      res.json(computeMetrics(events));
    }),
  );

  router.get(
    "/leads",
    gate,
    asyncHandler(async (req, res) => {
      const limit = Number(req.query.limit || 50);
      const leads = await deps.leads.list(Number.isFinite(limit) ? limit : 50);
      res.json({
        leads: leads.map(presentLeadForAdmin),
        count: leads.length,
      });
    }),
  );

  router.get(
    "/events",
    gate,
    asyncHandler(async (req, res) => {
      const limitRaw = Number(req.query.limit || 100);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 100;
      const nameFilter = typeof req.query.name === "string" ? req.query.name : null;
      const events = await deps.events.list();
      const filtered = events
        .filter((event) => (nameFilter ? event.name === nameFilter : true))
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, limit)
        .map(presentEventForAdmin);
      res.json({ events: filtered, count: filtered.length });
    }),
  );

  router.get(
    "/experiments",
    gate,
    asyncHandler(async (_req, res) => {
      const events = await deps.events.list();
      const configs = await resolveConfigs(deps.experiments);
      res.json({
        experiments: configs.map((config) => ({
          ...config,
          stats: computeExperimentStats(events, config.key),
        })),
      });
    }),
  );

  router.put(
    "/experiments/:key",
    gate,
    asyncHandler(async (req, res) => {
      const keyParam = req.params.key;
      if (!isExperimentKey(keyParam)) throw new HttpError(404, "not_found", "Unknown experiment");
      const key = keyParam as ExperimentKey;
      const existing = await deps.experiments.get(key);
      const body = req.body || {};

      let forcedVariant: ExperimentVariant | null | undefined = undefined;
      if (body.forcedVariant === null || body.forcedVariant === "") forcedVariant = null;
      else if (body.forcedVariant === "control" || body.forcedVariant === "variant") {
        forcedVariant = body.forcedVariant;
      } else if (body.forcedVariant !== undefined) {
        throw new HttpError(400, "invalid", "forcedVariant must be control, variant, or null");
      }

      const patch = normalizeExperimentConfig(key, {
        enabled: typeof body.enabled === "boolean" ? body.enabled : existing?.enabled,
        weights: {
          control:
            body.weights?.control !== undefined
              ? Number(body.weights.control)
              : (existing?.weights.control ?? DEFAULT_EXPERIMENT_CONFIGS[key].weights.control),
          variant:
            body.weights?.variant !== undefined
              ? Number(body.weights.variant)
              : (existing?.weights.variant ?? DEFAULT_EXPERIMENT_CONFIGS[key].weights.variant),
        },
        forcedVariant:
          forcedVariant !== undefined
            ? forcedVariant
            : ((existing?.forcedVariant as ExperimentVariant | null | undefined) ?? null),
      });

      if (patch.weights.control + patch.weights.variant <= 0) {
        throw new HttpError(400, "invalid", "weights must sum to a positive number");
      }

      const saved: StoredExperimentConfig = {
        key: patch.key,
        enabled: patch.enabled,
        weights: patch.weights,
        forcedVariant: patch.forcedVariant,
        updatedAt: new Date(),
      };
      await deps.experiments.upsert(saved);
      const events = await deps.events.list();
      const meta = KNOWN_EXPERIMENTS.find((item) => item.key === key)!;
      res.json({
        experiment: {
          ...meta,
          ...patch,
          updatedAt: saved.updatedAt.toISOString(),
          stats: computeExperimentStats(events, key),
        },
      });
    }),
  );

  router.get(
    "/product",
    gate,
    asyncHandler(async (_req, res) => {
      const snapshot = await loadProductSnapshot(deps.product ?? createProductUpstream({}));
      res.json(snapshot);
    }),
  );

  router.get(
    "/overview",
    gate,
    asyncHandler(async (_req, res) => {
      const events = await deps.events.list();
      const accounts = deps.accounts ? await deps.accounts.list() : [];
      const runs = deps.assessmentRuns ? await deps.assessmentRuns.list() : [];
      const threads = deps.threads ? await deps.threads.list() : [];
      const counts = { none: 0, trial: 0, paid: 0, expired: 0 };
      for (const account of accounts) {
        counts[resolveAccess(account).status] += 1;
      }
      res.json({
        metrics: computeMetrics(events),
        series: dailySeries(events, 14),
        accounts: { ...counts, total: accounts.length },
        workspace: {
          runs: runs.length,
          threads: threads.length,
          replies: threads.reduce((sum, thread) => sum + thread.answers.length, 0),
        },
      });
    }),
  );

  router.get(
    "/workspace",
    gate,
    asyncHandler(async (_req, res) => {
      const runs = deps.assessmentRuns ? await deps.assessmentRuns.list() : [];
      const threads = deps.threads ? await deps.threads.list() : [];
      const accounts = deps.accounts ? await deps.accounts.list() : [];
      const names = new Map(accounts.map((account) => [account.id, account.name || account.email]));
      res.json({
        runs: runs
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 50)
          .map((run) => ({
            id: run.id,
            accountId: run.accountId,
            accountName: names.get(run.accountId) || run.accountId,
            assessmentId: run.assessmentId,
            score: run.score,
            createdAt: run.createdAt.toISOString(),
          })),
        threads: threads.slice(0, 50).map((thread) => ({
          id: thread.id,
          title: thread.title,
          authorName: thread.authorName,
          tags: thread.tags,
          views: thread.views,
          answerCount: thread.answers.length,
          createdAt: thread.createdAt.toISOString(),
        })),
      });
    }),
  );

  router.get(
    "/billing",
    gate,
    asyncHandler(async (_req, res) => {
      const settings = deps.billing ? await deps.billing.get() : DEFAULT_BILLING_SETTINGS;
      res.json({ settings });
    }),
  );

  router.put(
    "/billing",
    gate,
    asyncHandler(async (req, res) => {
      if (!deps.billing) throw new HttpError(503, "unavailable", "Billing store is not configured");
      const existing = await deps.billing.get();
      const body = req.body || {};
      const trialModules: ModuleFlags = {
        assessments:
          typeof body.trialModules?.assessments === "boolean"
            ? body.trialModules.assessments
            : existing.trialModules.assessments,
        community:
          typeof body.trialModules?.community === "boolean"
            ? body.trialModules.community
            : existing.trialModules.community,
      };
      const days = body.defaultTrialDays !== undefined ? Number(body.defaultTrialDays) : existing.defaultTrialDays;
      if (!Number.isFinite(days) || days < 1 || days > 90) {
        throw new HttpError(400, "invalid", "Trial length must be 1–90 days");
      }
      const settings: BillingSettings = {
        autoTrialOnSignup:
          typeof body.autoTrialOnSignup === "boolean" ? body.autoTrialOnSignup : existing.autoTrialOnSignup,
        defaultTrialDays: days,
        trialModules,
      };
      await deps.billing.save(settings);
      res.json({ settings });
    }),
  );

  router.get(
    "/accounts",
    gate,
    asyncHandler(async (_req, res) => {
      const accounts = deps.accounts ? await deps.accounts.list() : [];
      res.json({
        accounts: accounts.map((account) => presentAccount(account)),
      });
    }),
  );

  router.post(
    "/accounts/:id/access",
    gate,
    asyncHandler(async (req, res) => {
      if (!deps.accounts) throw new HttpError(503, "unavailable", "Account store is not configured");
      const account = await deps.accounts.getById(req.params.id);
      if (!account) throw new HttpError(404, "not_found", "Account not found");
      const body = req.body || {};
      const action = typeof body.action === "string" ? body.action : "";
      const settings = deps.billing ? await deps.billing.get() : DEFAULT_BILLING_SETTINGS;
      if (action === "trial") {
        const days = Number(body.days || settings.defaultTrialDays);
        if (!Number.isFinite(days) || days < 1 || days > 90) {
          throw new HttpError(400, "invalid", "Trial length must be 1–90 days");
        }
        account.plan = "trial";
        account.trialEndsAt = addDays(new Date(), days);
        account.modules = {
          assessments:
            typeof body.modules?.assessments === "boolean"
              ? body.modules.assessments
              : settings.trialModules.assessments,
          community:
            typeof body.modules?.community === "boolean" ? body.modules.community : settings.trialModules.community,
        };
      } else if (action === "paid") {
        account.plan = "paid";
        account.modules = {
          assessments: typeof body.modules?.assessments === "boolean" ? body.modules.assessments : true,
          community: typeof body.modules?.community === "boolean" ? body.modules.community : true,
        };
      } else if (action === "revoke") {
        account.plan = "none";
        account.trialEndsAt = new Date();
        account.modules = { ...ALL_MODULES_OFF };
      } else {
        throw new HttpError(400, "invalid", "action must be trial, paid, or revoke");
      }
      if (body.seats !== undefined) {
        const seats = Number(body.seats);
        if (!Number.isFinite(seats) || seats < 1 || seats > 500) {
          throw new HttpError(400, "invalid", "Seats must be 1–500");
        }
        account.seats = seats;
      }
      await deps.accounts.update(account);
      res.json({ account: presentAccount(account) });
    }),
  );

  return router;
}
