import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./errors";

export const ADMIN_COOKIE = "lokutara_admin";
export const ADMIN_SECRET_HEADER = "x-admin-secret";

export type AdminCredentials = {
  /** When set, login requires this email (case-insensitive) plus the password. */
  email: string | null;
  /**
   * Shared password for login, Bearer, or x-admin-secret. The cookie stores a
   * derived session token rather than the password.
   * Resolved as ADMIN_PASSWORD, else ADMIN_DASHBOARD_SECRET (legacy).
   */
  password: string | null;
};

function nonempty(value: string | undefined | null): string | null {
  const trimmed = (value || "").trim();
  return trimmed.length ? trimmed : null;
}

export function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function adminSessionToken(password: string): string {
  return createHmac("sha256", password)
    .update("lokutara-admin-session-v1")
    .digest("hex");
}

export function emailsEqual(provided: string, expected: string): boolean {
  return provided.trim().toLowerCase() === expected.trim().toLowerCase();
}

/**
 * Prefer ADMIN_EMAIL + ADMIN_PASSWORD.
 * If ADMIN_EMAIL is unset, password-only login still works (legacy).
 * Password falls back to ADMIN_DASHBOARD_SECRET when ADMIN_PASSWORD is unset.
 */
export function readAdminCredentials(source: NodeJS.ProcessEnv = process.env): AdminCredentials {
  const email = nonempty(source.ADMIN_EMAIL);
  const password = nonempty(source.ADMIN_PASSWORD) || nonempty(source.ADMIN_DASHBOARD_SECRET);
  return { email, password };
}

/** Prefer readAdminCredentials().password — kept for call sites that only need the password. */
export function readAdminSecret(source: NodeJS.ProcessEnv = process.env): string | null {
  return readAdminCredentials(source).password;
}

export function extractAdminCredential(req: Request): string | null {
  const header = req.header(ADMIN_SECRET_HEADER);
  if (header && header.trim()) return header.trim();

  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  const cookie = req.cookies?.[ADMIN_COOKIE];
  if (typeof cookie === "string" && cookie.trim()) return cookie.trim();
  return null;
}

export function isAdminAuthorized(
  req: Request,
  password = readAdminCredentials().password,
): boolean {
  if (!password) return false;
  const provided = extractAdminCredential(req);
  if (!provided) return false;
  return (
    secretsEqual(provided, password) ||
    secretsEqual(provided, adminSessionToken(password))
  );
}

export function requireAdmin(password = readAdminCredentials().password): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!password) {
      next(
        new HttpError(
          503,
          "admin_disabled",
          "Admin credentials are not configured (set ADMIN_EMAIL + ADMIN_PASSWORD, or ADMIN_DASHBOARD_SECRET)",
        ),
      );
      return;
    }
    if (!isAdminAuthorized(req, password)) {
      next(new HttpError(401, "unauthorized", "Admin authentication required"));
      return;
    }
    next();
  };
}
