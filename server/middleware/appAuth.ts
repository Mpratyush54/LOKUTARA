import type { NextFunction, Request, Response } from "express";
import { canUseModule, resolveAccess, type ProductModule } from "../../lib/access/billing";
import { HttpError } from "./errors";
import type { AccountStore, AppSessionStore } from "../stores/memory";

export const APP_COOKIE = "lokutara_app";

export function appCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30 * 1000,
  };
}

export type AppRequest = Request & {
  accountId?: string;
  account?: Awaited<ReturnType<AccountStore["getById"]>>;
};

export function readAppToken(req: Request): string | null {
  const cookie = req.cookies?.[APP_COOKIE];
  if (typeof cookie === "string" && cookie.length > 16) return cookie;
  const header = req.headers.authorization;
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || null;
  }
  return null;
}

export function requireAppSession(deps: { accounts: AccountStore; sessions: AppSessionStore }) {
  return async (req: AppRequest, _res: Response, next: NextFunction) => {
    try {
      const token = readAppToken(req);
      if (!token) throw new HttpError(401, "unauthorized", "Sign in to continue");
      const session = await deps.sessions.get(token);
      if (!session) throw new HttpError(401, "unauthorized", "Session expired");
      const account = await deps.accounts.getById(session.accountId);
      if (!account) throw new HttpError(401, "unauthorized", "Account missing");
      if (typeof account.age === "number" && account.age < 18) {
        throw new HttpError(403, "adult_required", "Lokutara accounts are for adults aged 18 or older");
      }
      req.accountId = account.id;
      req.account = account;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAppAccess(deps: { accounts: AccountStore; sessions: AppSessionStore }) {
  const session = requireAppSession(deps);
  return async (req: AppRequest, res: Response, next: NextFunction) => {
    await session(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      const account = req.account;
      if (!account) {
        next(new HttpError(401, "unauthorized", "Sign in to continue"));
        return;
      }
      const access = resolveAccess(account);
      if (!access.canEnterApp) {
        next(new HttpError(402, "paywall", "Start a trial or subscribe to open the product"));
        return;
      }
      next();
    });
  };
}

export function requireModule(module: ProductModule) {
  return (req: AppRequest, _res: Response, next: NextFunction) => {
    const account = req.account;
    if (!account) {
      next(new HttpError(401, "unauthorized", "Sign in to continue"));
      return;
    }
    const access = resolveAccess(account);
    if (!canUseModule(access, module)) {
      next(new HttpError(402, "paywall", `This ${module} module is not on your plan`));
      return;
    }
    next();
  };
}
