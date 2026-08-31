import { randomBytes } from "node:crypto";
import { Router } from "express";
import {
  ALL_MODULES_OFF,
  addDays,
  presentAccount,
  type AccountRecord,
} from "../../lib/access/billing";
import { hashPassword, verifyPassword } from "../../lib/access/password";
import { asyncHandler, HttpError } from "../middleware/errors";
import { APP_COOKIE, appCookieOptions, readAppToken, type AppRequest } from "../middleware/appAuth";
import type { AccountStore, AppSessionStore, BillingSettingsStore } from "../stores/memory";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
  if (!Number.isInteger(n) || n < 13 || n > 120) {
    throw new HttpError(400, "invalid", "Enter a valid age");
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

      const body = req.body || {};
      const name = asTrimmed(body.name);
      if (name.length < 2 || name.length > 80) throw new HttpError(400, "invalid", "Enter your name");
      account.name = name;
      account.phone = parsePhone(body.phone);
      account.age = parseAge(body.age);
      account.city = parseCity(body.city);
      account.organisation = parseOrganisation(body.organisation);
      await deps.accounts.update(account);
      res.json({ ok: true, account: presentAccount(account) });
    }),
  );

  router.post(
    "/signup",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const email = asTrimmed(body.email).toLowerCase();
      const name = asTrimmed(body.name);
      const password = typeof body.password === "string" ? body.password : "";
      const phone = parsePhone(body.phone);
      const age = parseAge(body.age);
      const city = parseCity(body.city);
      const organisation = parseOrganisation(body.organisation);
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
        phone,
        age,
        city,
        organisation,
        passwordHash: await hashPassword(password),
        plan: settings.autoTrialOnSignup ? "trial" : "none",
        trialEndsAt: settings.autoTrialOnSignup ? addDays(now, settings.defaultTrialDays) : null,
        modules: settings.autoTrialOnSignup ? { ...settings.trialModules } : { ...ALL_MODULES_OFF },
        seats: 1,
        createdAt: now,
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
      const password = typeof body.password === "string" ? body.password : "";
      const account = await deps.accounts.getByEmail(email);
      if (!account || !(await verifyPassword(password, account.passwordHash))) {
        throw new HttpError(401, "unauthorized", "Invalid email or password");
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
