import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApiApp } from "../server/app";
import { createMemoryStores } from "../server/stores/memory";
import { CONSENT_COOKIE } from "../lib/tracking/consent";
import { presentLeadForAdmin } from "../server/routes/admin";

const ADMIN_SECRET = "test-admin-secret";
const ADMIN_EMAIL = "founder@lokutara.test";

function app(opts: { adminSecret?: string | null; adminEmail?: string | null } = {}) {
  const adminSecret = "adminSecret" in opts ? opts.adminSecret! : ADMIN_SECRET;
  const adminEmail = "adminEmail" in opts ? opts.adminEmail! : null;
  const stores = createMemoryStores();
  return {
    server: createApiApp({
      events: stores.eventStore,
      leads: stores.leadStore,
      visitors: stores.visitorStore,
      sessions: stores.sessionStore,
      experiments: stores.experimentConfigStore,
      rateLimiter: stores.rateLimiter,
      accounts: stores.accountStore,
      appSessions: stores.appSessionStore,
      billing: stores.billingSettingsStore,
      threads: stores.threadStore,
      assessmentRuns: stores.assessmentRunStore,
      adminSecret,
      adminEmail,
      health: {
        storeBackend: "memory",
        mongoConfigured: false,
        mongoOk: () => false,
        redisConfigured: false,
        redisStatus: () => "disabled",
        redisOk: () => true,
      },
    }),
    stores,
  };
}

describe("admin API", () => {
  it("rejects metrics without auth and allows with secret header", async () => {
    const { server, stores } = app();
    const denied = await request(server).get("/api/admin/metrics");
    expect(denied.status).toBe(401);
    expect(denied.body.error).toBe("unauthorized");

    const consent = encodeURIComponent(
      JSON.stringify({ analytics: true, marketing: false, decidedAt: "2026-08-26T00:00:00.000Z" }),
    );
    await request(server)
      .post("/api/events")
      .set("Cookie", `${CONSENT_COOKIE}=${consent}`)
      .send({
        name: "page_view",
        visitorId: "v_abcdefghijklmnop",
        sessionId: "s_abcdefghijklmnop",
        path: "/",
        props: { experiment: "hero_cta", variant: "control" },
      });
    expect(stores.events).toHaveLength(1);

    const ok = await request(server).get("/api/admin/metrics").set("x-admin-secret", ADMIN_SECRET);
    expect(ok.status).toBe(200);
    expect(ok.body.pageViews).toBe(1);
    expect(ok.body.dau).toBe(1);
    expect(ok.body.funnel.pageViews).toBe(1);
  });

  it("logs in via cookie and lists redacted counselling leads", async () => {
    const { server, stores } = app();
    await stores.leadStore.insert({
      id: "lead_1",
      type: "counselling",
      name: "Asha",
      email: "asha@example.com",
      phone: "9876543210",
      role: null,
      organisation: null,
      sizeBand: null,
      preferredTime: "weekday evenings",
      visitorId: null,
      createdAt: new Date("2026-08-26T10:00:00.000Z"),
    });

    const login = await request(server).post("/api/admin/login").send({ password: ADMIN_SECRET });
    expect(login.status).toBe(200);
    const setCookie = login.headers["set-cookie"];
    const cookie = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    expect(cookie).toBeTruthy();

    const leads = await request(server).get("/api/admin/leads").set("Cookie", cookie);
    expect(leads.status).toBe(200);
    expect(leads.body.leads).toHaveLength(1);
    expect(leads.body.leads[0].email).toBe("as***@example.com");
    expect(leads.body.leads[0].phone).toMatch(/\*+3210$/);
    expect(leads.body.leads[0].preferredTime).toBeNull();
    expect(leads.body.leads[0].redacted).toBe(true);
  });

  it("requires email + password when adminEmail is configured", async () => {
    const { server } = app({ adminEmail: ADMIN_EMAIL, adminSecret: ADMIN_SECRET });

    const session = await request(server).get("/api/admin/session");
    expect(session.status).toBe(200);
    expect(session.body.emailRequired).toBe(true);

    const missingEmail = await request(server).post("/api/admin/login").send({ password: ADMIN_SECRET });
    expect(missingEmail.status).toBe(401);

    const wrongEmail = await request(server)
      .post("/api/admin/login")
      .send({ email: "other@lokutara.test", password: ADMIN_SECRET });
    expect(wrongEmail.status).toBe(401);

    const ok = await request(server)
      .post("/api/admin/login")
      .send({ email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_SECRET });
    expect(ok.status).toBe(200);
    expect(ok.body.authenticated).toBe(true);

    const setCookie = ok.headers["set-cookie"];
    const cookie = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    const metrics = await request(server).get("/api/admin/metrics").set("Cookie", cookie);
    expect(metrics.status).toBe(200);
  });

  it("updates experiment config and exposes public assignment config", async () => {
    const { server } = app();
    const put = await request(server)
      .put("/api/admin/experiments/hero_cta")
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ enabled: true, weights: { control: 0, variant: 100 }, forcedVariant: null });
    expect(put.status).toBe(200);
    expect(put.body.experiment.weights.variant).toBe(100);

    const pub = await request(server).get("/api/experiments/hero_cta");
    expect(pub.status).toBe(200);
    expect(pub.body.experiment.weights.control).toBe(0);
    expect(pub.body.experiment.weights.variant).toBe(100);
  });

  it("disables admin when secret is unset", async () => {
    const { server } = app({ adminSecret: null });
    const session = await request(server).get("/api/admin/session");
    expect(session.status).toBe(503);
    expect(session.body.configured).toBe(false);
    const metrics = await request(server).get("/api/admin/metrics");
    expect(metrics.status).toBe(503);
  });
});

describe("presentLeadForAdmin", () => {
  it("keeps discovery contact fields intact", () => {
    const presented = presentLeadForAdmin({
      id: "x",
      type: "discovery",
      name: "Joel",
      email: "joel@lokutara.test",
      phone: "9876543210",
      role: "Founder",
      organisation: "Lokutara",
      sizeBand: "50-500",
      preferredTime: "Tue",
      visitorId: null,
      createdAt: new Date(),
    });
    expect(presented.email).toBe("joel@lokutara.test");
    expect(presented.redacted).toBe(false);
  });
});

describe("admin product snapshot", () => {
  it("returns assessments and community inside the same admin API", async () => {
    const { server } = app();
    const res = await request(server)
      .get("/api/admin/product")
      .set("x-admin-secret", ADMIN_SECRET);
    expect(res.status).toBe(200);
    expect(res.body.assessments.items.length).toBeGreaterThan(0);
    expect(res.body.community.threads).toEqual([]);
    expect(res.body.assessments.status).toBe("unset");
  });

  it("lets the founder grant and revoke a trial", async () => {
    const { server, stores } = app();
    const signup = await request(server).post("/api/auth/signup").send({
      name: "Pilot",
      email: "pilot@lokutara.test",
      password: "pass-word",
    });
    const id = signup.body.account.id as string;
    await stores.accountStore.update({
      ...(await stores.accountStore.getById(id))!,
      plan: "none",
      trialEndsAt: null,
      modules: { assessments: false, community: false },
    });

    const granted = await request(server)
      .post(`/api/admin/accounts/${id}/access`)
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ action: "trial", days: 7 });
    expect(granted.status).toBe(200);
    expect(granted.body.account.access.status).toBe("trial");

    const revoked = await request(server)
      .post(`/api/admin/accounts/${id}/access`)
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ action: "revoke" });
    expect(revoked.body.account.access.canEnterApp).toBe(false);
  });

  it("lets the founder set a community reply role", async () => {
    const { server } = app();
    const signup = await request(server).post("/api/auth/signup").send({
      name: "Pilot",
      email: "role@lokutara.test",
      password: "pass-word",
    });
    const id = signup.body.account.id as string;
    const granted = await request(server)
      .post(`/api/admin/accounts/${id}/access`)
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ action: "role", communityRole: "specialist" });
    expect(granted.status).toBe(200);
    expect(granted.body.account.communityRole).toBe("specialist");
  });
});
