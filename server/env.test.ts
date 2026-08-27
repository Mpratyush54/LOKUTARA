import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

describe("loadEnv", () => {
  it("applies defaults and parses URLs", () => {
    const env = loadEnv({
      PORT: "4000",
      MONGODB_URI: " mongodb://127.0.0.1:27017/lokutara ",
      REDIS_URL: "redis://127.0.0.1:6379",
      TRUST_PROXY: "true",
      ADMIN_EMAIL: "admin@lokutara.local",
      ADMIN_PASSWORD: "local-secret",
    });
    expect(env.port).toBe(4000);
    expect(env.mongodbUri).toBe("mongodb://127.0.0.1:27017/lokutara");
    expect(env.redisUrl).toBe("redis://127.0.0.1:6379");
    expect(env.trustProxy).toBe(true);
    expect(env.adminEmail).toBe("admin@lokutara.local");
    expect(env.adminDashboardSecret).toBe("local-secret");
    expect(env.warnings).toEqual([]);
  });

  it("warns in production when stores are missing", () => {
    const env = loadEnv({ NODE_ENV: "production" });
    expect(env.mongodbUri).toBeNull();
    expect(env.redisUrl).toBeNull();
    expect(env.adminDashboardSecret).toBeNull();
    expect(env.adminEmail).toBeNull();
    expect(env.trustProxy).toBe(true);
    expect(env.warnings.length).toBe(3);
  });

  it("falls back password to ADMIN_DASHBOARD_SECRET and warns when email unset", () => {
    const env = loadEnv({ ADMIN_DASHBOARD_SECRET: "  local-secret  " });
    expect(env.adminDashboardSecret).toBe("local-secret");
    expect(env.adminEmail).toBeNull();
    expect(env.warnings.some((w) => w.includes("ADMIN_EMAIL"))).toBe(true);
  });

  it("prefers ADMIN_PASSWORD over ADMIN_DASHBOARD_SECRET", () => {
    const env = loadEnv({
      ADMIN_EMAIL: "a@b.c",
      ADMIN_PASSWORD: "new-pass",
      ADMIN_DASHBOARD_SECRET: "legacy",
    });
    expect(env.adminDashboardSecret).toBe("new-pass");
    expect(env.warnings).toEqual([]);
  });

  it("falls back on invalid PORT", () => {
    expect(loadEnv({ PORT: "nope" }).port).toBe(3000);
  });
});
