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

  router.post(
    "/signup",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
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
