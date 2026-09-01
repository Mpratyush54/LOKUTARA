import { randomBytes } from "node:crypto";
import { Router } from "express";
import {
  ALL_MODULES_OFF,
  addDays,
  applyProfilePatch,
  presentAccount,
  type AccountRecord,
} from "../../lib/access/billing";
import { EMPTY_IDENTITY, isEmail, parseProfilePatch } from "../../lib/access/profile";
import { hashPassword, verifyPassword } from "../../lib/access/password";
import { ACCOUNT_NOTICE_VERSION } from "../../lib/legal/compliance";
import { applyProfilePatch } from "../../lib/access/billing";
import { EMPTY_IDENTITY, parseProfilePatch } from "../../lib/access/profile";
import { asyncHandler, HttpError } from "../middleware/errors";
import { APP_COOKIE, appCookieOptions, readAppToken, type AppRequest } from "../middleware/appAuth";
import type {
  AccountStore,
  AppSessionStore,
  AssessmentRunStore,
  BillingSettingsStore,
  InvoiceStore,
  RateLimiter,
  ThreadStore,
} from "../stores/memory";

function mintToken(): string {
  return randomBytes(32).toString("hex");
}

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePhone(value: unknown): string {
  const phone = asTrimmed(value);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new HttpError(400, "invalid", "Enter a valid phone number");
  }
  return phone;
}

function parseAge(value: unknown): number {
  const n = typeof value === "number" ? value : Number(asTrimmed(value));
  if (!Number.isInteger(n) || n < 18 || n > 120) {
    throw new HttpError(400, "invalid", "Lokutara accounts are for adults aged 18 or older");
  }
  return n;
}

function parseCity(value: unknown): string {
  const city = asTrimmed(value);
  if (city.length < 2 || city.length > 80) throw new HttpError(400, "invalid", "Enter your city");
  return city;
}

function parseOrganisation(value: unknown): string | null {
  const organisation = asTrimmed(value);
  if (!organisation) return null;
  if (organisation.length > 120) throw new HttpError(400, "invalid", "Organisation is too long");
  return organisation;
}

export function createAuthRouter(deps: {
  accounts: AccountStore;
  sessions: AppSessionStore;
  billing: BillingSettingsStore;
  assessmentRuns: AssessmentRunStore;
  threads: ThreadStore;
  invoices: InvoiceStore;
  rateLimiter: RateLimiter;
}): Router {
  const router = Router();

  router.get(
    "/me",
    asyncHandler(async (req, res) => {
      const token = readAppToken(req);
      if (!token) {
        res.status(401).json({ ok: false, authenticated: false });
        return;
      }
      const session = await deps.sessions.get(token);
      if (!session) {
        res.status(401).json({ ok: false, authenticated: false });
        return;
      }
      const account = await deps.accounts.getById(session.accountId);
      if (!account) {
        res.status(401).json({ ok: false, authenticated: false });
        return;
      }
      res.json({ ok: true, authenticated: true, account: presentAccount(account) });
    }),
  );

  router.patch(
    "/me",
    asyncHandler(async (req, res) => {
      const token = readAppToken(req);
      if (!token) throw new HttpError(401, "unauthorized", "Sign in to update your profile");
      const session = await deps.sessions.get(token);
      if (!session) throw new HttpError(401, "unauthorized", "Sign in to update your profile");
      const account = await deps.accounts.getById(session.accountId);
      if (!account) throw new HttpError(401, "unauthorized", "Sign in to update your profile");

      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const parsed = parseProfilePatch(body);
      if (!parsed.ok) throw new HttpError(400, "invalid", parsed.message);
      if (parsed.value.email && parsed.value.email !== account.email.toLowerCase()) {
        const taken = await deps.accounts.getByEmail(parsed.value.email);
        if (taken && taken.id !== account.id) {
          throw new HttpError(409, "exists", "An account with that email already exists");
        }
      }
      let next = applyProfilePatch(account, parsed.value);
      if ("organisation" in body) next = { ...next, organisation: parseOrganisation(body.organisation) };
      await deps.accounts.update(next);
      res.json({ ok: true, account: presentAccount(next) });
    }),
  );

  router.get(
    "/data-export",
    asyncHandler(async (req, res) => {
      const token = readAppToken(req);
      if (!token) throw new HttpError(401, "unauthorized", "Sign in to export your data");
      const session = await deps.sessions.get(token);
      if (!session) throw new HttpError(401, "unauthorized", "Sign in to export your data");
      const account = await deps.accounts.getById(session.accountId);
      if (!account) throw new HttpError(401, "unauthorized", "Account missing");
      const [runs, allThreads, allInvoices] = await Promise.all([
        deps.assessmentRuns.listByAccount(account.id),
        deps.threads.list(),
        deps.invoices.list(),
      ]);
      const community = allThreads.flatMap((thread) => {
        const records: Array<Record<string, unknown>> = [];
        if (thread.authorId === account.id) {
          records.push({
            kind: "question",
            id: thread.id,
            title: thread.title,
            body: thread.body,
            tags: thread.tags,
            createdAt: thread.createdAt,
          });
        }
        for (const answer of thread.answers) {
          if (answer.authorId === account.id) {
            records.push({
              kind: "answer",
              id: answer.id,
              threadId: thread.id,
              body: answer.body,
              createdAt: answer.createdAt,
            });
          }
        }
        return records;
      });
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="lokutara-data-${account.id}.json"`,
      );
      res.json({
        exportedAt: new Date().toISOString(),
        account: presentAccount(account),
        assessments: runs,
        community,
        invoices: allInvoices.filter((invoice) => invoice.accountId === account.id),
      });
    }),
  );

  router.delete(
    "/me",
    asyncHandler(async (req, res) => {
      const token = readAppToken(req);
      if (!token) throw new HttpError(401, "unauthorized", "Sign in to delete your account");
      const session = await deps.sessions.get(token);
      if (!session) throw new HttpError(401, "unauthorized", "Sign in to delete your account");
      const account = await deps.accounts.getById(session.accountId);
      if (!account) throw new HttpError(401, "unauthorized", "Account missing");
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!(await verifyPassword(password, account.passwordHash))) {
        throw new HttpError(401, "unauthorized", "Password is incorrect");
      }
      await deps.assessmentRuns.deleteByAccount(account.id);
      await deps.threads.anonymizeByAccount(account.id);
      await deps.sessions.deleteByAccount(account.id);
      await deps.accounts.delete(account.id);
      res.clearCookie(APP_COOKIE, { path: "/" });
      res.json({
        ok: true,
        retained:
          "Invoices and records required for tax, security, dispute, or other legal duties are retained with restricted access.",
      });
    }),
  );

  router.post(
    "/signup",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const email = asTrimmed(body.email).toLowerCase();
      const allowed = await deps.rateLimiter.allow(
        `signup:${req.ip}:${email}`,
        5,
        15 * 60_000,
      );
      if (!allowed) throw new HttpError(429, "rate_limited", "Too many signup attempts");
      const name = asTrimmed(body.name);
      const password = typeof body.password === "string" ? body.password : "";
      const phone = parsePhone(body.phone);
      const age = parseAge(body.age);
      const city = parseCity(body.city);
      const organisation = parseOrganisation(body.organisation);
      if (body.acceptLegal !== true) {
        throw new HttpError(
          400,
          "consent_required",
          "Accept the Terms and acknowledge the Privacy Notice to create an account",
        );
      }
      if (!isEmail(email)) throw new HttpError(400, "invalid", "Enter a valid email");
      if (name.length < 2 || name.length > 80) throw new HttpError(400, "invalid", "Enter your name");
      if (password.length < 8) throw new HttpError(400, "invalid", "Password must be at least 8 characters");
      if (await deps.accounts.getByEmail(email)) {
        throw new HttpError(409, "exists", "An account with that email already exists");
      }

      const settings = await deps.billing.get();
      const now = new Date();
      const account: AccountRecord = {
        id: `acc_${randomBytes(8).toString("hex")}`,
        email,
        name,
        passwordHash: await hashPassword(password),
        plan: settings.autoTrialOnSignup ? "trial" : "none",
        trialEndsAt: settings.autoTrialOnSignup ? addDays(now, settings.defaultTrialDays) : null,
        modules: settings.autoTrialOnSignup ? { ...settings.trialModules } : { ...ALL_MODULES_OFF },
        seats: 1,
        createdAt: now,
        ...EMPTY_IDENTITY,
        phone,
        age,
        city,
        organisation,
        gender: null,
        termsAcceptedAt: now,
        privacyNoticeVersion: ACCOUNT_NOTICE_VERSION,
      };
      await deps.accounts.create(account);
      const token = mintToken();
      await deps.sessions.create({ token, accountId: account.id, createdAt: now });
      res.cookie(APP_COOKIE, token, appCookieOptions());
      res.status(201).json({ ok: true, account: presentAccount(account) });
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const allowed = await deps.rateLimiter.allow(
        `login:${req.ip}:${email}`,
        10,
        15 * 60_000,
      );
      if (!allowed) throw new HttpError(429, "rate_limited", "Too many login attempts");
      const password = typeof body.password === "string" ? body.password : "";
      const account = await deps.accounts.getByEmail(email);
      if (!account || !(await verifyPassword(password, account.passwordHash))) {
        throw new HttpError(401, "unauthorized", "Invalid email or password");
      }
      if (typeof account.age === "number" && account.age < 18) {
        throw new HttpError(403, "adult_required", "Lokutara accounts are for adults aged 18 or older");
      }
      const token = mintToken();
      await deps.sessions.create({ token, accountId: account.id, createdAt: new Date() });
      res.cookie(APP_COOKIE, token, appCookieOptions());
      res.json({ ok: true, account: presentAccount(account) });
    }),
  );

  router.post("/logout", async (req: AppRequest, res) => {
    const token = readAppToken(req);
    if (token) await deps.sessions.delete(token);
    res.clearCookie(APP_COOKIE, { path: "/" });
    res.json({ ok: true, authenticated: false });
  });

  return router;
}
