import { describe, expect, it } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import { createApiApp } from "../server/app";
import { createMemoryStores } from "../server/stores/memory";
import { CONSENT_COOKIE } from "../lib/tracking/consent";
import { presentLeadForAdmin } from "../server/routes/admin";

const ADMIN_SECRET = "test-admin-secret";
const ADMIN_EMAIL = "founder@lokutara.test";

function signupPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Pilot",
    email: "pilot@lokutara.test",
    password: "pass-word",
    phone: "9876543210",
    age: 34,
    city: "Bengaluru",
    acceptLegal: true,
    ...overrides,
  };
}

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
      invoices: stores.invoiceStore,
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
      consentedAt: new Date("2026-08-26T10:00:00.000Z"),
      adultConfirmedAt: new Date("2026-08-26T10:00:00.000Z"),
      privacyNoticeVersion: "account-2026-08-31",
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
      consentedAt: new Date(),
      adultConfirmedAt: new Date(),
      privacyNoticeVersion: "account-2026-08-31",
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

  it("returns people and activity on the admin overview", async () => {
    const { server } = app();
    await request(server).post("/api/auth/signup").send(signupPayload());
    const overview = await request(server).get("/api/admin/overview").set("x-admin-secret", ADMIN_SECRET);
    expect(overview.status).toBe(200);
    expect(overview.body.accounts.total).toBe(1);
    expect(overview.body.recent.people[0].email).toBe("pilot@lokutara.test");
    expect(overview.body.recent.people[0].phone).toBe("9876543210");
    expect(overview.body.recent.people[0].city).toBe("Bengaluru");
    expect(overview.body.workspace.runs).toBe(0);
    expect(overview.body.recent.threads).toEqual([]);
    expect(Array.isArray(overview.body.series)).toBe(true);
    expect(overview.body.recent.leads).toEqual([]);
    expect(overview.body.commerce.revenueThisMonth).toBe(0);
    expect(overview.body.commerce.peopleThisMonth).toBe(1);
    expect(overview.body.series[0]).toHaveProperty("revenue");
  });

  it("lets the founder grant and revoke a trial", async () => {
    const { server, stores } = app();
    const signup = await request(server).post("/api/auth/signup").send(signupPayload());
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

  it("gives complimentary access with a ₹0 Given by Admin record that stays out of revenue", async () => {
    const { server, stores } = app();
    const signup = await request(server).post("/api/auth/signup").send(
      signupPayload({ email: "grant@lokutara.test" }),
    );
    const id = signup.body.account.id as string;
    const before = await request(server).get("/api/admin/overview").set("x-admin-secret", ADMIN_SECRET);
    expect(before.body.commerce.revenueThisMonth).toBe(0);

    const granted = await request(server)
      .post(`/api/admin/accounts/${id}/access`)
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ action: "paid" });
    expect(granted.status).toBe(200);
    expect(granted.body.account.access.status).toBe("paid");
    expect(granted.body.invoice.kind).toBe("complimentary");
    expect(granted.body.invoice.totalPaise).toBe(0);
    expect(granted.body.invoice.totalLabel).toBe("₹0");
    expect(granted.body.invoice.sourceLabel).toBe("Given by Admin");
    expect(granted.body.invoice.paymentUrl).toBeNull();
    expect(granted.body.invoice.countsTowardRevenue).toBe(false);
    expect(granted.body.invoice.documentTitle).toBe("Complimentary record");

    const stored = (await stores.invoiceStore.list()).find((row) => row.accountId === id);
    expect(stored?.kind).toBe("complimentary");
    expect(stored?.razorpayPaymentId).toBe("admin_grant");
    expect(stored?.razorpayPaymentLinkId).toBeNull();

    const overview = await request(server).get("/api/admin/overview").set("x-admin-secret", ADMIN_SECRET);
    expect(overview.body.commerce.revenueThisMonth).toBe(0);
    expect(overview.body.commerce.paidThisMonth).toBe(0);
    expect(overview.body.commerce.outstandingPaise).toBe(0);
    expect(overview.body.accounts.paid).toBe(1);

    const again = await request(server)
      .post(`/api/admin/accounts/${id}/access`)
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ action: "paid" });
    expect(again.body.invoice.id).toBe(granted.body.invoice.id);
    expect((await stores.invoiceStore.list()).filter((row) => row.accountId === id)).toHaveLength(1);
  });

  it("lets the founder set a community reply role", async () => {
    const { server } = app();
    const signup = await request(server).post("/api/auth/signup").send(
      signupPayload({ email: "role@lokutara.test" }),
    );
    const id = signup.body.account.id as string;
    const granted = await request(server)
      .post(`/api/admin/accounts/${id}/access`)
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ action: "role", communityRole: "specialist" });
    expect(granted.status).toBe(200);
    expect(granted.body.account.communityRole).toBe("specialist");
  });
});

describe("admin promos and invoice PDFs", () => {
  it("creates a promo, applies it at checkout, and exports invoice PDFs", async () => {
    const stores = createMemoryStores();
    const server = createApiApp({
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
      invoices: stores.invoiceStore,
      promos: stores.promoStore,
      adminSecret: ADMIN_SECRET,
      razorpay: {
        configured: true,
        createPaymentLink: async () => ({ id: "plink_promo", shortUrl: "https://rzp.io/i/promo" }),
      },
      health: {
        storeBackend: "memory",
        mongoConfigured: false,
        mongoOk: () => false,
        redisConfigured: false,
        redisStatus: () => "disabled",
        redisOk: () => true,
      },
    });
    const created = await request(server)
      .post("/api/admin/promos")
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ code: "welcome10", kind: "percent", value: 10, firstTimeOnly: true });
    expect(created.status).toBe(201);
    expect(created.body.promo.code).toBe("WELCOME10");

    const signup = await request(server).post("/api/auth/signup").send(signupPayload({ email: "promo@lokutara.test" }));
    const rawCookie = signup.headers["set-cookie"];
    const cookie = Array.isArray(rawCookie) ? rawCookie.join("; ") : rawCookie;
    const checkout = await request(server)
      .post("/api/billing/checkout")
      .set("Cookie", cookie)
      .send({ sku: "workshop", promoCode: "welcome10" });
    expect(checkout.status).toBe(201);
    // 10% off 25,000 = 2,500 off; GST on 22,500 = 4,050; total 26,550.
    expect(checkout.body.invoice.discountPaise).toBe(250_000);
    expect(checkout.body.invoice.promoCode).toBe("WELCOME10");
    expect(checkout.body.invoice.totalPaise).toBe(2_655_000);

    const listed = await request(server).get("/api/admin/promos").set("x-admin-secret", ADMIN_SECRET);
    expect(listed.body.promos[0].usedCount).toBe(1);

    const userPdf = await request(server)
      .get(`/api/billing/invoices/${checkout.body.invoice.id}/pdf`)
      .set("Cookie", cookie);
    expect(userPdf.status).toBe(200);
    expect(userPdf.headers["content-type"]).toMatch(/application\/pdf/);

    const adminPdf = await request(server)
      .get(`/api/admin/invoices/${checkout.body.invoice.id}/pdf`)
      .set("x-admin-secret", ADMIN_SECRET);
    expect(adminPdf.status).toBe(200);

    const toggled = await request(server)
      .post("/api/admin/promos/WELCOME10/toggle")
      .set("x-admin-secret", ADMIN_SECRET);
    expect(toggled.body.promo.active).toBe(false);
  });

  it("rejects unknown and paused codes at checkout", async () => {
    const stores = createMemoryStores();
    const server = createApiApp({
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
      invoices: stores.invoiceStore,
      promos: stores.promoStore,
      adminSecret: ADMIN_SECRET,
      razorpay: {
        configured: true,
        createPaymentLink: async () => ({ id: "plink_x", shortUrl: "https://rzp.io/i/x" }),
      },
      health: {
        storeBackend: "memory",
        mongoConfigured: false,
        mongoOk: () => false,
        redisConfigured: false,
        redisStatus: () => "disabled",
        redisOk: () => true,
      },
    });
    const signup = await request(server).post("/api/auth/signup").send(signupPayload({ email: "nopromo@lokutara.test" }));
    const rawCookie = signup.headers["set-cookie"];
    const cookie = Array.isArray(rawCookie) ? rawCookie.join("; ") : rawCookie;
    const denied = await request(server)
      .post("/api/billing/checkout")
      .set("Cookie", cookie)
      .send({ sku: "workshop", promoCode: "NOPE" });
    expect(denied.status).toBe(400);
  });
});

describe("admin invoices", () => {
  it("creates, issues via Razorpay, and marks paid from a signed webhook", async () => {
    const stores = createMemoryStores();
    const webhookSecret = "whsec-test";
    const server = createApiApp({
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
      invoices: stores.invoiceStore,
      adminSecret: ADMIN_SECRET,
      razorpay: {
        configured: true,
        createPaymentLink: async () => ({ id: "plink_1", shortUrl: "https://rzp.io/i/test" }),
      },
      razorpayWebhookSecret: webhookSecret,
    });
    const signup = await request(server).post("/api/auth/signup").send(signupPayload({ email: "bill@lokutara.test" }));
    const accountId = signup.body.account.id as string;

    const created = await request(server)
      .post("/api/admin/invoices")
      .set("x-admin-secret", ADMIN_SECRET)
      .send({
        accountId,
        sku: "workshop",
        grantAccessOnPay: true,
      });
    expect(created.status).toBe(201);
    expect(created.body.invoice.number).toMatch(/^LKT-26-/);
    expect(created.body.invoice.totalPaise).toBe(2_950_000);
    expect(created.body.invoice.status).toBe("draft");
    expect(created.body.invoice.kind).toBe("sale");

    const issued = await request(server)
      .post(`/api/admin/invoices/${created.body.invoice.id}/issue`)
      .set("x-admin-secret", ADMIN_SECRET);
    expect(issued.status).toBe(200);
    expect(issued.body.invoice.status).toBe("issued");
    expect(issued.body.invoice.paymentUrl).toBe("https://rzp.io/i/test");

    const payload = JSON.stringify({
      event: "payment_link.paid",
      payload: {
        payment_link: {
          entity: { id: "plink_1", notes: { invoiceId: created.body.invoice.id } },
        },
        payment: { entity: { id: "pay_1" } },
      },
    });
    const denied = await request(server)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", "nope")
      .send(payload);
    expect(denied.status).toBe(401);

    const signature = createHmac("sha256", webhookSecret).update(payload).digest("hex");
    const paid = await request(server)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(payload);
    expect(paid.status).toBe(200);

    const listed = await request(server).get("/api/admin/invoices").set("x-admin-secret", ADMIN_SECRET);
    expect(listed.body.invoices[0].status).toBe("paid");
    const account = await stores.accountStore.getById(accountId);
    expect(account?.plan).toBe("paid");

    const overview = await request(server).get("/api/admin/overview").set("x-admin-secret", ADMIN_SECRET);
    expect(overview.body.commerce.revenueThisMonth).toBe(2_950_000);
    expect(overview.body.commerce.paidThisMonth).toBe(1);
  });

  it("records an offline payment when Razorpay is not configured", async () => {
    const { server } = app();
    const created = await request(server)
      .post("/api/admin/invoices")
      .set("x-admin-secret", ADMIN_SECRET)
      .send({
        name: "Nandi Labs",
        email: "ops@nandi.test",
        sku: "counselling",
        qty: 2,
      });
    expect(created.status).toBe(201);
    const issued = await request(server)
      .post(`/api/admin/invoices/${created.body.invoice.id}/issue`)
      .set("x-admin-secret", ADMIN_SECRET);
    expect(issued.body.invoice.status).toBe("issued");
    expect(issued.body.invoice.paymentUrl).toBeNull();
    const paid = await request(server)
      .post(`/api/admin/invoices/${created.body.invoice.id}/record-payment`)
      .set("x-admin-secret", ADMIN_SECRET);
    expect(paid.body.invoice.status).toBe("paid");
  });

  it("creates a complimentary invoice without calling Razorpay", async () => {
    const stores = createMemoryStores();
    let razorpayCalls = 0;
    const server = createApiApp({
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
      invoices: stores.invoiceStore,
      adminSecret: ADMIN_SECRET,
      razorpay: {
        configured: true,
        createPaymentLink: async () => {
          razorpayCalls += 1;
          return { id: "plink_should_not", shortUrl: "https://rzp.io/i/nope" };
        },
      },
    });
    const signup = await request(server).post("/api/auth/signup").send(
      signupPayload({ email: "comp@lokutara.test" }),
    );
    const accountId = signup.body.account.id as string;
    const created = await request(server)
      .post("/api/admin/invoices")
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ accountId, sku: "app_access", complimentary: true });
    expect(created.status).toBe(201);
    expect(created.body.invoice.kind).toBe("complimentary");
    expect(created.body.invoice.totalPaise).toBe(0);
    expect(created.body.invoice.sourceLabel).toBe("Given by Admin");
    expect(created.body.invoice.paymentUrl).toBeNull();
    expect(created.body.invoice.status).toBe("paid");
    expect(razorpayCalls).toBe(0);
    const account = await stores.accountStore.getById(accountId);
    expect(account?.plan).toBe("paid");
    const overview = await request(server).get("/api/admin/overview").set("x-admin-secret", ADMIN_SECRET);
    expect(overview.body.commerce.revenueThisMonth).toBe(0);
  });
});

describe("admin moderation, leads paging, quote, and csv", () => {
  function authedApp() {
    const stores = createMemoryStores();
    const server = createApiApp({
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
      invoices: stores.invoiceStore,
      promos: stores.promoStore,
      adminSecret: ADMIN_SECRET,
      razorpay: {
        configured: true,
        createPaymentLink: async () => ({ id: "plink_q", shortUrl: "https://rzp.io/i/q" }),
      },
      health: {
        storeBackend: "memory",
        mongoConfigured: false,
        mongoOk: () => false,
        redisConfigured: false,
        redisStatus: () => "disabled",
        redisOk: () => true,
      },
    });
    return { server, stores };
  }

  async function signupCookie(server: ReturnType<typeof createApiApp>, email: string) {
    const signup = await request(server).post("/api/auth/signup").send(signupPayload({ email }));
    const raw = signup.headers["set-cookie"];
    return Array.isArray(raw) ? raw.join("; ") : raw;
  }

  it("bans an account out of login and sessions, then unbans", async () => {
    const { server, stores } = authedApp();
    const signup = await request(server).post("/api/auth/signup").send(signupPayload({ email: "ban@lokutara.test" }));
    const id = signup.body.account.id as string;
    const raw = signup.headers["set-cookie"];
    const cookie = Array.isArray(raw) ? raw.join("; ") : raw;

    const banned = await request(server)
      .post(`/api/admin/accounts/${id}/access`)
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ action: "ban", reason: "spam" });
    expect(banned.status).toBe(200);
    expect(banned.body.account.banned).toBe(true);

    const relogin = await request(server).post("/api/auth/login").send({ email: "ban@lokutara.test", password: "pass-word" });
    expect(relogin.status).toBe(403);

    const stale = await request(server).get("/api/workspace/home").set("Cookie", cookie);
    expect([401, 403]).toContain(stale.status);

    const unbanned = await request(server)
      .post(`/api/admin/accounts/${id}/access`)
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ action: "unban" });
    expect(unbanned.body.account.banned).toBe(false);
    const login = await request(server).post("/api/auth/login").send({ email: "ban@lokutara.test", password: "pass-word" });
    expect(login.status).toBe(200);
  });

  it("rejects community posts containing blocked words", async () => {
    const { server } = authedApp();
    const saved = await request(server)
      .put("/api/admin/billing")
      .set("x-admin-secret", ADMIN_SECRET)
      .send({ blockedWords: ["spamword"] });
    expect(saved.body.settings.blockedWords).toContain("spamword");

    const cookie = await signupCookie(server, "words@lokutara.test");
    const bad = await request(server)
      .post("/api/workspace/community")
      .set("Cookie", cookie)
      .send({
        title: "A clear question about spamword here",
        body: "This body is long enough to pass validation rules easily.",
        tags: ["interview"],
        communityNoticeAccepted: true,
      });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("blocked_word");

    const good = await request(server)
      .post("/api/workspace/community")
      .set("Cookie", cookie)
      .send({
        title: "A clear question about interviews here",
        body: "This body is long enough to pass validation rules easily.",
        tags: ["interview"],
        communityNoticeAccepted: true,
      });
    expect(good.status).toBe(201);
  });

  it("paginates and filters leads server-side", async () => {
    const { server, stores } = authedApp();
    for (const [name, type, email] of [["Asha", "counselling", "a@t.test"], ["Ravi", "discovery", "r@t.test"], ["Asha Rao", "discovery", "ar@t.test"]] as const) {
      await stores.leadStore.insert({
        id: `lead_${email}`,
        type,
        name,
        email,
        phone: "9999999999",
        role: null,
        organisation: null,
        sizeBand: null,
        preferredTime: null,
        visitorId: null,
        consentedAt: new Date(),
        adultConfirmedAt: new Date(),
        privacyNoticeVersion: "v1",
        createdAt: new Date(),
      });
    }
    const page1 = await request(server).get("/api/admin/leads?limit=2&page=1").set("x-admin-secret", ADMIN_SECRET);
    expect(page1.body.total).toBe(3);
    expect(page1.body.pages).toBe(2);
    expect(page1.body.leads).toHaveLength(2);
    const page2 = await request(server).get("/api/admin/leads?limit=2&page=2").set("x-admin-secret", ADMIN_SECRET);
    expect(page2.body.leads).toHaveLength(1);
    const filtered = await request(server).get("/api/admin/leads?q=asha&type=discovery").set("x-admin-secret", ADMIN_SECRET);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.leads[0].email).toBe("ar@t.test");
  });

  it("quotes a checkout with and without a promo", async () => {
    const { server } = authedApp();
    await request(server).post("/api/admin/promos").set("x-admin-secret", ADMIN_SECRET).send({ code: "Q10", kind: "percent", value: 10 });
    const cookie = await signupCookie(server, "quote@lokutara.test");
    const plain = await request(server).post("/api/billing/quote").set("Cookie", cookie).send({ sku: "workshop" });
    expect(plain.status).toBe(200);
    expect(plain.body.totalPaise).toBe(2_950_000);
    expect(plain.body.discountPaise).toBe(0);
    const promo = await request(server).post("/api/billing/quote").set("Cookie", cookie).send({ sku: "workshop", promoCode: "q10" });
    expect(promo.body.discountPaise).toBe(250_000);
    expect(promo.body.totalPaise).toBe(2_655_000);
    expect(promo.body.promoCode).toBe("Q10");
    const bad = await request(server).post("/api/billing/quote").set("Cookie", cookie).send({ sku: "workshop", promoCode: "NOPE" });
    expect(bad.status).toBe(400);
  });

  it("exports invoices as GST csv", async () => {
    const { server } = authedApp();
    const res = await request(server).get("/api/admin/invoices/export.csv").set("x-admin-secret", ADMIN_SECRET);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("CGST");
  });
});
