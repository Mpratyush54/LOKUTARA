import { randomBytes } from "node:crypto";
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
  adminSessionToken,
  emailsEqual,
  isAdminAuthorized,
  readAdminCredentials,
  requireAdmin,
  secretsEqual,
} from "../middleware/adminAuth";
import type {
  AccountStore,
  AppSessionStore,
  AssessmentRunStore,
  BillingSettingsStore,
  EventStore,
  ExperimentConfigStore,
  InvoiceStore,
  LeadStore,
  PromoStore,
  RateLimiter,
  StoredExperimentConfig,
  StoredLead,
  ThreadStore,
} from "../stores/memory";
import { loadProductSnapshot } from "../../lib/product/snapshot";
import { createProductUpstream, type ProductUpstream } from "../../lib/product/upstream";
import { INVOICE_SKUS, isInvoiceSku } from "../../lib/billing/catalog";
import { computeCommerce } from "../../lib/billing/commerce";
import {
  DEFAULT_GST_RATE,
  invoiceGrantsAccess,
  lineFromSku,
  nextInvoiceNumber,
  normalizeGstin,
  presentInvoice,
  rupeesToPaise,
  settleInvoiceLines,
  type Invoice,
  type InvoiceLine,
} from "../../lib/billing/invoices";
import { grantComplimentaryInvoice, requireAccountForComplimentary } from "../billing/complimentary";
import { issueInvoice } from "../billing/issue";
import { markInvoicePaid } from "../billing/settle";
import { buildInvoicePdf } from "../../lib/billing/invoicePdf";
import { invoicesToGstCsv } from "../../lib/billing/gstCsv";
import { normalizePromoCode, presentPromo, type Promo } from "../../lib/billing/promos";
import type { RazorpayClient } from "../payments/razorpay";
import {
  ALL_MODULES_OFF,
  DEFAULT_BILLING_SETTINGS,
  addDays,
  normalizeBlockedWord,
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
  sessions?: AppSessionStore;
  billing?: BillingSettingsStore;
  threads?: ThreadStore;
  assessmentRuns?: AssessmentRunStore;
  invoices?: InvoiceStore;
  promos?: PromoStore;
  razorpay?: RazorpayClient;
  rateLimiter: RateLimiter;
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
      razorpayConfigured: Boolean(deps.razorpay?.configured),
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
      const allowed = await deps.rateLimiter.allow(
        `admin-login:${req.ip}`,
        8,
        15 * 60_000,
      );
      if (!allowed) throw new HttpError(429, "rate_limited", "Too many admin login attempts");
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
      res.cookie(ADMIN_COOKIE, adminSessionToken(password), {
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
      const limitRaw = Number(req.query.limit || 25);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 100)) : 25;
      const pageRaw = Number(req.query.page || 1);
      const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const type = typeof req.query.type === "string" ? req.query.type : "";
      const { rows, total } = await deps.leads.query({ q, type, limit, offset: (page - 1) * limit });
      res.json({
        leads: rows.map(presentLeadForAdmin),
        count: rows.length,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
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
      const invoices = deps.invoices ? await deps.invoices.list() : [];
      const leadRows = await deps.leads.list(500);
      const counts = { none: 0, trial: 0, paid: 0, expired: 0 };
      for (const account of accounts) {
        counts[resolveAccess(account).status] += 1;
      }
      const commerce = computeCommerce({
        invoices,
        accounts,
        events,
        leads: leadRows,
      });
      res.json({
        metrics: computeMetrics(events),
        series: commerce.series,
        commerce,
        razorpayConfigured: Boolean(deps.razorpay?.configured),
        accounts: { ...counts, total: accounts.length },
        workspace: {
          runs: runs.length,
          threads: threads.length,
          replies: threads.reduce((sum, thread) => sum + thread.answers.length, 0),
        },
        recent: {
          leads: leadRows.slice(0, 6).map(presentLeadForAdmin),
          people: accounts.slice(0, 6).map((account) => presentAccount(account)),
          runs: runs
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 6)
            .map((run) => ({
              id: run.id,
              assessmentId: run.assessmentId,
              createdAt: run.createdAt.toISOString(),
            })),
          threads: threads.slice(0, 6).map((thread) => ({
            id: thread.id,
            title: thread.title,
            authorName: thread.authorName,
            answerCount: thread.answers.length,
            views: thread.views,
            createdAt: thread.createdAt.toISOString(),
          })),
          invoices: invoices.slice(0, 6).map((invoice) => presentInvoice(invoice)),
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
      res.json({
        runs: runs
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 50)
          .map((run) => ({
            id: run.id,
            assessmentId: run.assessmentId,
            createdAt: run.createdAt.toISOString(),
          })),
        threads: threads.slice(0, 50).map((thread) => ({
          id: thread.id,
          title: thread.title,
          body: thread.body,
          authorName: thread.authorName,
          authorId: thread.authorId,
          tags: thread.tags,
          views: thread.views,
          answerCount: thread.answers.length,
          createdAt: thread.createdAt.toISOString(),
        })),
      });
    }),
  );

  function presentThreadForAdmin(thread: {
    id: string;
    title: string;
    body: string;
    authorId: string;
    authorName: string;
    tags: string[];
    views: number;
    createdAt: Date;
    answers: Array<{
      id: string;
      authorId: string;
      authorName: string;
      body: string;
      createdAt: Date;
      upvotes: number;
    }>;
  }) {
    return {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      authorId: thread.authorId,
      authorName: thread.authorName,
      tags: thread.tags,
      views: thread.views,
      answerCount: thread.answers.length,
      createdAt: thread.createdAt.toISOString(),
      answers: thread.answers.map((answer) => ({
        id: answer.id,
        authorId: answer.authorId,
        authorName: answer.authorName,
        body: answer.body,
        upvotes: answer.upvotes,
        createdAt: answer.createdAt.toISOString(),
      })),
    };
  }

  router.get(
    "/threads/:id",
    gate,
    asyncHandler(async (req, res) => {
      if (!deps.threads) throw new HttpError(503, "unavailable", "Thread store is not configured");
      const thread = await deps.threads.get(req.params.id);
      if (!thread) throw new HttpError(404, "not_found", "Thread not found");
      res.json({ thread: presentThreadForAdmin(thread) });
    }),
  );

  router.delete(
    "/threads/:id",
    gate,
    asyncHandler(async (req, res) => {
      if (!deps.threads) throw new HttpError(503, "unavailable", "Thread store is not configured");
      const removed = await deps.threads.deleteThread(req.params.id);
      if (!removed) throw new HttpError(404, "not_found", "Thread not found");
      res.json({ ok: true, id: req.params.id });
    }),
  );

  router.delete(
    "/threads/:id/answers/:answerId",
    gate,
    asyncHandler(async (req, res) => {
      if (!deps.threads) throw new HttpError(503, "unavailable", "Thread store is not configured");
      const thread = await deps.threads.get(req.params.id);
      if (!thread) throw new HttpError(404, "not_found", "Thread not found");
      const exists = thread.answers.some((answer) => answer.id === req.params.answerId);
      if (!exists) throw new HttpError(404, "not_found", "Answer not found");
      const updated = await deps.threads.deleteAnswer(req.params.id, req.params.answerId);
      res.json({ ok: true, thread: updated ? presentThreadForAdmin(updated) : null });
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
      const gstRate =
        body.gstRate !== undefined ? Number(body.gstRate) : existing.gstRate ?? DEFAULT_GST_RATE;
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 40) {
        throw new HttpError(400, "invalid", "GST rate must be 0–40");
      }
      let blockedWords = existing.blockedWords ?? [];
      if (body.blockedWords !== undefined) {
        if (!Array.isArray(body.blockedWords)) throw new HttpError(400, "invalid", "blockedWords must be a list");
        const cleaned = body.blockedWords
          .map((word: unknown) => normalizeBlockedWord(word))
          .filter((word: string) => word.length > 0);
        blockedWords = [...new Set(cleaned)].slice(0, 200);
      }
      const settings: BillingSettings = {
        ...existing,
        autoTrialOnSignup:
          typeof body.autoTrialOnSignup === "boolean" ? body.autoTrialOnSignup : existing.autoTrialOnSignup,
        defaultTrialDays: days,
        trialModules,
        legalName: typeof body.legalName === "string" ? body.legalName.trim() : existing.legalName,
        gstin: typeof body.gstin === "string" ? body.gstin.trim() : existing.gstin,
        address: typeof body.address === "string" ? body.address.trim() : existing.address,
        gstRate,
        blockedWords,
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
      let account = await deps.accounts.getById(req.params.id);
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
      } else if (action === "ban") {
        const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
        account.plan = "none";
        account.trialEndsAt = new Date();
        account.modules = { ...ALL_MODULES_OFF };
        account.communityRole = "student";
        account.bannedAt = new Date();
        account.banReason = reason || null;
        if (deps.sessions) await deps.sessions.deleteByAccount(account.id);
      } else if (action === "unban") {
        account.bannedAt = null;
        account.banReason = null;
      } else if (action === "role") {
        /* community role only */
      } else {
        throw new HttpError(400, "invalid", "action must be trial, paid, revoke, ban, unban, or role");
      }
      if (body.communityRole !== undefined) {
        const role = body.communityRole;
        if (role !== "student" && role !== "specialist" && role !== "admin") {
          throw new HttpError(400, "invalid", "communityRole must be student, specialist, or admin");
        }
        account.communityRole = role;
      } else if (action === "role") {
        throw new HttpError(400, "invalid", "communityRole is required");
      }
      if (body.seats !== undefined) {
        const seats = Number(body.seats);
        if (!Number.isFinite(seats) || seats < 1 || seats > 500) {
          throw new HttpError(400, "invalid", "Seats must be 1–500");
        }
        account.seats = seats;
      }
      await deps.accounts.update(account);
      let complimentaryInvoice = null;
      if (action === "paid" && deps.invoices) {
        complimentaryInvoice = await grantComplimentaryInvoice({
          account,
          sku: "app_access",
          invoices: deps.invoices,
          accounts: deps.accounts,
        });
        const latest = await deps.accounts.getById(account.id);
        if (latest) {
          latest.plan = "paid";
          latest.modules = account.modules;
          latest.seats = account.seats;
          latest.communityRole = account.communityRole;
          await deps.accounts.update(latest);
          account = latest;
        }
      }
      res.json({
        account: presentAccount(account),
        invoice: complimentaryInvoice ? presentInvoice(complimentaryInvoice) : null,
      });
    }),
  );

  router.get(
    "/invoices",
    gate,
    asyncHandler(async (_req, res) => {
      const rows = deps.invoices ? await deps.invoices.list() : [];
      const settings = deps.billing ? await deps.billing.get() : DEFAULT_BILLING_SETTINGS;
      res.json({
        invoices: rows.map((invoice) => presentInvoice(invoice)),
        catalog: INVOICE_SKUS,
        razorpayConfigured: Boolean(deps.razorpay?.configured),
        settings: {
          legalName: settings.legalName,
          gstin: settings.gstin,
          address: settings.address,
          gstRate: settings.gstRate,
        },
      });
    }),
  );

  router.post(
    "/invoices",
    gate,
    asyncHandler(async (req, res) => {
      if (!deps.invoices) throw new HttpError(503, "unavailable", "Invoice store is not configured");
      const settings = deps.billing ? await deps.billing.get() : DEFAULT_BILLING_SETTINGS;
      const body = (req.body || {}) as Record<string, unknown>;
      if (body.complimentary) {
        const skuRaw = typeof body.sku === "string" ? body.sku : "app_access";
        if (!isInvoiceSku(skuRaw)) throw new HttpError(400, "invalid", "Choose a catalogue item");
        if (!deps.accounts) throw new HttpError(503, "unavailable", "Account store is not configured");
        const accountId = typeof body.accountId === "string" ? body.accountId : "";
        const account = requireAccountForComplimentary(await deps.accounts.getById(accountId));
        const invoice = await grantComplimentaryInvoice({
          account,
          sku: skuRaw,
          invoices: deps.invoices,
          accounts: deps.accounts,
          label: typeof body.label === "string" ? body.label : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
        });
        res.status(201).json({ invoice: presentInvoice(invoice) });
        return;
      }
      const invoice = await buildInvoiceFromBody(body, {
        invoices: deps.invoices,
        accounts: deps.accounts,
        gstRate: settings.gstRate ?? DEFAULT_GST_RATE,
      });
      await deps.invoices.insert(invoice);
      let stored = invoice;
      if (body.issue) {
        stored = await issueInvoice(stored, deps);
      }
      res.status(201).json({ invoice: presentInvoice(stored) });
    }),
  );

  router.get(
    "/invoices/export.csv",
    gate,
    asyncHandler(async (_req, res) => {
      if (!deps.invoices) throw new HttpError(503, "unavailable", "Invoice store is not configured");
      const rows = await deps.invoices.list();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="lokutara-invoices.csv"`);
      res.send(invoicesToGstCsv(rows));
    }),
  );

  router.get(
    "/invoices/:id/pdf",
    gate,
    asyncHandler(async (req, res) => {
      const invoice = await requireInvoice(deps, req.params.id);
      const settings = deps.billing ? await deps.billing.get() : DEFAULT_BILLING_SETTINGS;
      const pdf = buildInvoicePdf({
        invoice,
        seller: { legalName: settings.legalName, gstin: settings.gstin, address: settings.address },
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="lokutara-${invoice.number}.pdf"`);
      res.send(Buffer.from(pdf));
    }),
  );

  router.get(
    "/promos",
    gate,
    asyncHandler(async (_req, res) => {
      if (!deps.promos) throw new HttpError(503, "unavailable", "Promo store is not configured");
      const promos = await deps.promos.list();
      res.json({ promos: promos.map(presentPromo) });
    }),
  );

  router.post(
    "/promos",
    gate,
    asyncHandler(async (req, res) => {
      if (!deps.promos) throw new HttpError(503, "unavailable", "Promo store is not configured");
      const body = req.body || {};
      const code = normalizePromoCode(body.code);
      if (!code || code.length < 3) throw new HttpError(400, "invalid", "Code needs at least 3 characters");
      const kind = body.kind === "flat" ? "flat" : "percent";
      const value = Number(body.value);
      if (!Number.isFinite(value) || value <= 0 || (kind === "percent" && value > 100)) {
        throw new HttpError(400, "invalid", kind === "percent" ? "Percent must be 1–100" : "Amount must be more than 0");
      }
      const maxDiscountRupees =
        body.maxDiscountRupees === null || body.maxDiscountRupees === undefined || body.maxDiscountRupees === ""
          ? null
          : Number(body.maxDiscountRupees);
      if (maxDiscountRupees !== null && (!Number.isFinite(maxDiscountRupees) || maxDiscountRupees <= 0)) {
        throw new HttpError(400, "invalid", "Max discount must be more than 0");
      }
      const maxUses = body.maxUses === null || body.maxUses === undefined || body.maxUses === ""
        ? null
        : Number(body.maxUses);
      if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
        throw new HttpError(400, "invalid", "Usage limit must be 1 or more");
      }
      let expiresAt: Date | null = null;
      if (typeof body.expiresAt === "string" && body.expiresAt) {
        expiresAt = new Date(body.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) throw new HttpError(400, "invalid", "Expiry date is invalid");
      }
      if (await deps.promos.getByCode(code)) {
        throw new HttpError(409, "conflict", "That code already exists");
      }
      const promo: Promo = {
        id: `promo_${randomBytes(8).toString("hex")}`,
        code,
        kind,
        value,
        maxDiscountRupees,
        maxUses,
        usedCount: 0,
        firstTimeOnly: Boolean(body.firstTimeOnly),
        active: true,
        expiresAt,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
        createdAt: new Date(),
      };
      await deps.promos.upsert(promo);
      res.status(201).json({ promo: presentPromo(promo) });
    }),
  );

  router.post(
    "/promos/:code/toggle",
    gate,
    asyncHandler(async (req, res) => {
      if (!deps.promos) throw new HttpError(503, "unavailable", "Promo store is not configured");
      const promo = await deps.promos.getByCode(req.params.code);
      if (!promo) throw new HttpError(404, "not_found", "Promo not found");
      const next = { ...promo, active: !promo.active };
      await deps.promos.upsert(next);
      res.json({ promo: presentPromo(next) });
    }),
  );

  router.delete(
    "/promos/:code",
    gate,
    asyncHandler(async (req, res) => {
      if (!deps.promos) throw new HttpError(503, "unavailable", "Promo store is not configured");
      const removed = await deps.promos.remove(req.params.code);
      if (!removed) throw new HttpError(404, "not_found", "Promo not found");
      res.json({ ok: true });
    }),
  );

  router.post(
    "/invoices/:id/issue",
    gate,
    asyncHandler(async (req, res) => {
      const invoice = await requireInvoice(deps, req.params.id);
      const issued = await issueInvoice(invoice, deps);
      res.json({ invoice: presentInvoice(issued) });
    }),
  );

  router.post(
    "/invoices/:id/record-payment",
    gate,
    asyncHandler(async (req, res) => {
      const invoice = await requireInvoice(deps, req.params.id);
      const paid = await markInvoicePaid(invoice, {
        invoices: deps.invoices!,
        accounts: deps.accounts,
        promos: deps.promos,
        paymentId: typeof req.body?.paymentId === "string" ? req.body.paymentId : "offline",
      });
      res.json({ invoice: presentInvoice(paid) });
    }),
  );

  router.post(
    "/invoices/:id/cancel",
    gate,
    asyncHandler(async (req, res) => {
      const invoice = await requireInvoice(deps, req.params.id);
      if (invoice.status === "paid") {
        throw new HttpError(409, "conflict", "Paid invoices cannot be cancelled");
      }
      if (invoice.status === "cancelled") {
        res.json({ invoice: presentInvoice(invoice) });
        return;
      }
      const next = { ...invoice, status: "cancelled" as const };
      await deps.invoices!.update(next);
      res.json({ invoice: presentInvoice(next) });
    }),
  );

  return router;
}

async function requireInvoice(
  deps: { invoices?: InvoiceStore },
  id: string,
): Promise<Invoice> {
  if (!deps.invoices) throw new HttpError(503, "unavailable", "Invoice store is not configured");
  const invoice = await deps.invoices.get(id);
  if (!invoice) throw new HttpError(404, "not_found", "Invoice not found");
  return invoice;
}

function parseInvoiceLines(
  body: Record<string, unknown>,
  defaultGstRate: number,
): InvoiceLine[] {
  const rawLines = Array.isArray(body.lines) ? body.lines : null;
  if (rawLines && rawLines.length) {
    if (rawLines.length > 20) throw new HttpError(400, "invalid", "A bill can have at most 20 lines");
    return rawLines.map((raw, index) => {
      const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const skuRaw = typeof row.sku === "string" ? row.sku : "";
      if (!isInvoiceSku(skuRaw)) {
        throw new HttpError(400, "invalid", `Line ${index + 1}: choose a catalogue item`);
      }
      const qty = row.qty !== undefined ? Number(row.qty) : 1;
      if (!Number.isFinite(qty) || qty < 1 || qty > 50) {
        throw new HttpError(400, "invalid", `Line ${index + 1}: quantity must be 1–50`);
      }
      const gstRate = row.gstRate !== undefined ? Number(row.gstRate) : defaultGstRate;
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 40) {
        throw new HttpError(400, "invalid", `Line ${index + 1}: GST must be 0–40%`);
      }
      const rupees = row.unitAmountRupees !== undefined ? Number(row.unitAmountRupees) : undefined;
      const unitAmountPaise =
        rupees !== undefined && Number.isFinite(rupees) ? rupeesToPaise(rupees) : undefined;
      if (unitAmountPaise !== undefined && unitAmountPaise < 0) {
        throw new HttpError(400, "invalid", `Line ${index + 1}: price cannot be negative`);
      }
      const label = typeof row.label === "string" ? row.label : undefined;
      return lineFromSku(skuRaw, qty, unitAmountPaise, gstRate, label);
    });
  }

  // Single-line payload from customer-style callers and older admin forms.
  const skuRaw = typeof body.sku === "string" ? body.sku : "";
  if (!isInvoiceSku(skuRaw)) throw new HttpError(400, "invalid", "Add at least one service line");
  const qty = body.qty !== undefined ? Number(body.qty) : 1;
  const gstRate = body.gstRate !== undefined ? Number(body.gstRate) : defaultGstRate;
  const rupees = body.unitAmountRupees !== undefined ? Number(body.unitAmountRupees) : undefined;
  const unitAmountPaise = rupees !== undefined && Number.isFinite(rupees) ? rupeesToPaise(rupees) : undefined;
  const label = typeof body.label === "string" ? body.label : undefined;
  return [lineFromSku(skuRaw, qty, unitAmountPaise, gstRate, label)];
}

async function buildInvoiceFromBody(
  body: Record<string, unknown>,
  deps: { invoices: InvoiceStore; accounts?: AccountStore; gstRate: number },
): Promise<Invoice> {
  let accountId = typeof body.accountId === "string" && body.accountId ? body.accountId : null;
  let name = typeof body.name === "string" ? body.name.trim() : "";
  let email = typeof body.email === "string" ? body.email.trim() : "";
  let phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  let organisation =
    typeof body.organisation === "string" && body.organisation.trim() ? body.organisation.trim() : null;
  if (accountId && deps.accounts) {
    const account = await deps.accounts.getById(accountId);
    if (!account) throw new HttpError(404, "not_found", "Account not found");
    name = name || account.name;
    email = email || account.email;
    phone = phone || account.phone || null;
    organisation = organisation || account.organisation || null;
  }
  if (!name || !email) {
    throw new HttpError(400, "invalid", "Customer name and email are required");
  }
  const gstinRaw = typeof body.customerGstin === "string" ? body.customerGstin : "";
  let customerGstin: string | null = null;
  if (gstinRaw.trim()) {
    customerGstin = normalizeGstin(gstinRaw);
    if (!customerGstin) throw new HttpError(400, "invalid", "Customer GSTIN looks invalid (15 characters)");
  }
  const supplyState =
    typeof body.supplyState === "string" && body.supplyState.trim() ? body.supplyState.trim().slice(0, 60) : null;
  const pricedLines = parseInvoiceLines(body, deps.gstRate);
  const discountRupees = body.discountRupees !== undefined ? Number(body.discountRupees) : 0;
  if (!Number.isFinite(discountRupees) || discountRupees < 0) {
    throw new HttpError(400, "invalid", "Discount must be 0 or more");
  }
  const settled = settleInvoiceLines(pricedLines, rupeesToPaise(discountRupees));
  if (settled.totalPaise < 100) {
    throw new HttpError(400, "invalid", "Bill total must be at least ₹1");
  }
  const existing = await deps.invoices.list();
  const dueAt =
    typeof body.dueAt === "string" && body.dueAt ? new Date(body.dueAt) : addDays(new Date(), 14);
  return {
    id: `inv_${randomBytes(8).toString("hex")}`,
    number: nextInvoiceNumber(existing.map((row) => row.number)),
    accountId,
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    organisation,
    customerGstin,
    supplyState,
    lines: settled.lines,
    discountPaise: settled.discountPaise,
    promoCode: null,
    gstRate: settled.gstRate,
    subtotalPaise: settled.subtotalPaise,
    gstPaise: settled.gstPaise,
    totalPaise: settled.totalPaise,
    currency: "INR",
    status: "draft",
    issuedAt: null,
    dueAt,
    paidAt: null,
    grantAccessOnPay:
      body.grantAccessOnPay !== undefined ? Boolean(body.grantAccessOnPay) : invoiceGrantsAccess(settled.lines),
    kind: "sale",
    razorpayPaymentLinkId: null,
    paymentUrl: null,
    razorpayPaymentId: null,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdAt: new Date(),
  };
}
