export type AppEnv = {
  port: number;
  nodeEnv: "development" | "test" | "production" | string;
  mongodbUri: string | null;
  redisUrl: string | null;
  trustProxy: boolean;
  /** Admin login email (optional). When set, /admin requires email + password. */
  adminEmail: string | null;
  /**
   * Resolved admin password: ADMIN_PASSWORD, else ADMIN_DASHBOARD_SECRET (legacy).
   * Used for session cookie, x-admin-secret, and Bearer auth.
   */
  adminDashboardSecret: string | null;
  /** Soft warnings for operators; never secrets. */
  warnings: string[];
};

function nonempty(value: string | undefined): string | null {
  const trimmed = (value || "").trim();
  return trimmed.length ? trimmed : null;
}

function parsePort(raw: string | undefined, fallback: number): number {
  const n = Number(raw || fallback);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return fallback;
  return Math.floor(n);
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

/**
 * Load and lightly validate process env for the Express + Next custom server.
 * Missing Mongo/Redis is allowed (memory fallback) but warned in production.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = source.NODE_ENV || "development";
  const mongodbUri = nonempty(source.MONGODB_URI);
  const redisUrl = nonempty(source.REDIS_URL);
  const adminEmail = nonempty(source.ADMIN_EMAIL);
  const adminDashboardSecret =
    nonempty(source.ADMIN_PASSWORD) || nonempty(source.ADMIN_DASHBOARD_SECRET);
  const warnings: string[] = [];

  if (nodeEnv === "production" && !mongodbUri) {
    warnings.push("MONGODB_URI is unset; leads and events will use in-memory stores (data lost on restart).");
  }
  if (nodeEnv === "production" && !redisUrl) {
    warnings.push("REDIS_URL is unset; rate limits will use in-memory buckets (not shared across instances).");
  }
  if (!adminDashboardSecret) {
    warnings.push(
      "Admin password unset (ADMIN_PASSWORD or ADMIN_DASHBOARD_SECRET); /admin and /api/admin/* stay locked.",
    );
  } else if (!adminEmail) {
    warnings.push(
      "ADMIN_EMAIL unset; admin login accepts password only (set ADMIN_EMAIL for email + password).",
    );
  }

  return {
    port: parsePort(source.PORT, 3000),
    nodeEnv,
    mongodbUri,
    redisUrl,
    trustProxy: parseBool(source.TRUST_PROXY, nodeEnv === "production"),
    adminEmail,
    adminDashboardSecret,
    warnings,
  };
}
