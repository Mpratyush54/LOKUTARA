import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApiApp } from "../server/app";
import { createMemoryStores } from "../server/stores/memory";
import { CONSENT_COOKIE } from "../lib/tracking/consent";

function signupPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Asha Rao",
    email: "asha@lokutara.test",
    password: "pass-word",
    phone: "9876543210",
    age: 29,
    city: "Bengaluru",
    organisation: "Lokutara",
    acceptLegal: true,
    ...overrides,
  };
}

function app() {
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
      adminSecret: "test-admin-secret",
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

describe("API", () => {
  it("health reports launch-honest mounts and store status", async () => {
    const { server } = app();
    const res = await request(server).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("lokutara");
    expect(res.body.stores.backend).toBe("memory");
    expect(res.body.mounts.chat).toBe("stub_501");
    expect(res.body.mounts.app).toBe("paywalled");
    expect(res.body.mounts.admin).toBe("gated");
    expect(res.body.launch.now).toContain("workshops");
    expect(res.body.launch.now).toContain("app");
    expect(res.body.launch.later).toContain("chat_product");
  });

  it("rejects invalid leads and stores valid ones", async () => {
    const { server, stores } = app();
    const bad = await request(server).post("/api/leads").send({ type: "discovery" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("invalid");

    const ok = await request(server).post("/api/leads").send({
      type: "discovery",
      name: "Joel",
      email: "joel@lokutara.test",
      phone: "9876543210",
      organisation: "Lokutara",
      sizeBand: "50-500",
      privacyAccepted: true,
      adultConfirmed: true,
    });
    expect(ok.status).toBe(201);
    expect(stores.leads).toHaveLength(1);
    expect(stores.leads[0].email).toBe("joel@lokutara.test");
  });

  it("rate limits lead posts", async () => {
    const { server } = app();
    for (let i = 0; i < 8; i += 1) {
      const res = await request(server).post("/api/leads").send({
        type: "popup",
        name: "Visitor",
        email: `v${i}@mail.test`,
        phone: "9876543210",
        privacyAccepted: true,
        adultConfirmed: true,
      });
      expect(res.status).toBe(201);
    }
    const blocked = await request(server).post("/api/leads").send({
      type: "popup",
      name: "Visitor",
      email: "last@mail.test",
      phone: "9876543210",
      privacyAccepted: true,
      adultConfirmed: true,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("rate_limited");
  });

  it("stores analytics events, sessions, and computes metrics", async () => {
    const { server, stores } = app();
    const consent = encodeURIComponent(
      JSON.stringify({ analytics: true, marketing: false, decidedAt: "2026-08-26T00:00:00.000Z" }),
    );
    const posted = await request(server)
      .post("/api/events")
      .set("Cookie", `${CONSENT_COOKIE}=${consent}`)
      .send({
        name: "page_view",
        visitorId: "v_abcdefghijklmnop",
        sessionId: "s_abcdefghijklmnop",
        channel: "email",
        path: "/",
      });
    expect(posted.status).toBe(201);
    expect(stores.sessions.size).toBe(1);
    const metrics = await request(server).get("/api/events/metrics");
    expect(metrics.body.dau).toBe(1);
    expect(metrics.body.mau).toBe(1);
    expect(metrics.body.funnel.pageViews).toBe(1);
    expect(metrics.body.bounceRate).toBe(1);
  });

  it("skips storing events without analytics consent", async () => {
    const { server, stores } = app();
    const res = await request(server).post("/api/events").send({
      name: "page_view",
      visitorId: "v_abcdefghijklmnop",
      sessionId: "s_abcdefghijklmnop",
    });
    expect(res.status).toBe(202);
    expect(stores.events).toHaveLength(0);
  });

  it("does not persist blocked clinical props", async () => {
    const { server, stores } = app();
    const consent = encodeURIComponent(
      JSON.stringify({ analytics: true, marketing: false, decidedAt: "2026-08-26T00:00:00.000Z" }),
    );
    await request(server).post("/api/events").set("Cookie", `${CONSENT_COOKIE}=${consent}`).send({
      name: "lead_submitted",
      visitorId: "v_abcdefghijklmnop",
      sessionId: "s_abcdefghijklmnop",
      props: { type: "counselling", clinicalNotes: "private" },
    });
    expect(stores.events[0].props).toEqual({ type: "counselling" });
  });

  it("keeps chat as a mount stub and catalog as a helper, not the product", async () => {
    const { server } = app();
    const chat = await request(server).get("/api/chat");
    const catalog = await request(server).get("/api/product/catalog");
    expect(chat.status).toBe(501);
    expect(catalog.status).toBe(200);
    expect(catalog.body.assessments.length).toBeGreaterThan(0);
    expect(catalog.body.community.title).toMatch(/forum/i);
  });

  it("signs up onto a trial and gates the workspace behind that session", async () => {
    const { server } = app();
    const denied = await request(server).get("/api/workspace/assessments");
    expect(denied.status).toBe(401);

    const signup = await request(server).post("/api/auth/signup").send(signupPayload());
    expect(signup.status).toBe(201);
    expect(signup.body.account.access.status).toBe("trial");
    expect(signup.body.account.access.canEnterApp).toBe(true);
    expect(signup.body.account.phone).toBe("9876543210");
    expect(signup.body.account.age).toBe(29);
    expect(signup.body.account.city).toBe("Bengaluru");
    expect(signup.body.account.organisation).toBe("Lokutara");
    const cookie = signup.headers["set-cookie"];
    expect(cookie).toBeTruthy();

    const list = await request(server).get("/api/workspace/assessments").set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.assessments.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining(["psychology", "ocean", "kolb", "placement"]),
    );
    expect(list.body.assessments.find((item: { id: string }) => item.id === "kolb").kind).toBe("rank");

    const submitted = await request(server)
      .post("/api/workspace/assessments/ocean/submit")
      .set("Cookie", cookie)
      .send({
        consent: true,
        answers: {
          o1: { kind: "mcq", value: 4 },
          c1: { kind: "mcq", value: 4 },
          e1: { kind: "mcq", value: 3 },
          a1: { kind: "mcq", value: 5 },
          n1: { kind: "mcq", value: 2 },
        },
      });
    expect(submitted.status).toBe(201);
    expect(submitted.body.run.score).toBeGreaterThan(0);

    const me = await request(server).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.account.email).toBe("asha@lokutara.test");
    expect(me.body.account.phone).toBe("9876543210");
    expect(me.body.account.city).toBe("Bengaluru");
  });

  it("lets a signed-in account update profile details", async () => {
    const { server } = app();
    const signup = await request(server).post("/api/auth/signup").send(signupPayload());
    const cookie = signup.headers["set-cookie"];
    const updated = await request(server).patch("/api/auth/me").set("Cookie", cookie).send({
      name: "Asha R",
      phone: "9988776655",
      age: 31,
      city: "Mysuru",
      organisation: "Lokutara Labs",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.account.name).toBe("Asha R");
    expect(updated.body.account.phone).toBe("9988776655");
    expect(updated.body.account.age).toBe(31);
    expect(updated.body.account.city).toBe("Mysuru");
    expect(updated.body.account.organisation).toBe("Lokutara Labs");
  });

  it("exports account data and deletes assessment records after password confirmation", async () => {
    const { server, stores } = app();
    const signup = await request(server)
      .post("/api/auth/signup")
      .send(signupPayload({ email: "rights@lokutara.test" }));
    const cookie = signup.headers["set-cookie"];
    const submitted = await request(server)
      .post("/api/workspace/assessments/ocean/submit")
      .set("Cookie", cookie)
      .send({
        consent: true,
        answers: {
          o1: { kind: "mcq", value: 4 },
          c1: { kind: "mcq", value: 4 },
          e1: { kind: "mcq", value: 3 },
          a1: { kind: "mcq", value: 5 },
          n1: { kind: "mcq", value: 2 },
        },
      });
    expect(submitted.status).toBe(201);

    const exported = await request(server).get("/api/auth/data-export").set("Cookie", cookie);
    expect(exported.status).toBe(200);
    expect(exported.headers["content-disposition"]).toMatch(/attachment/);
    expect(exported.body.account.email).toBe("rights@lokutara.test");
    expect(exported.body.assessments).toHaveLength(1);
    expect(exported.body.assessments[0].noticeVersion).toMatch(/assessment/);

    const wrong = await request(server)
      .delete("/api/auth/me")
      .set("Cookie", cookie)
      .send({ password: "wrong-password" });
    expect(wrong.status).toBe(401);

    const deleted = await request(server)
      .delete("/api/auth/me")
      .set("Cookie", cookie)
      .send({ password: "pass-word" });
    expect(deleted.status).toBe(200);
    expect(await stores.accountStore.getByEmail("rights@lokutara.test")).toBeNull();
    expect(await stores.assessmentRunStore.list()).toHaveLength(0);
    expect((await request(server).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  });

  it("rejects browser mutations from another origin", async () => {
    const { server } = app();
    const result = await request(server)
      .post("/api/auth/login")
      .set("Origin", "https://attacker.example")
      .set("Host", "lokutara.test")
      .send({ email: "a@lokutara.test", password: "pass-word" });
    expect(result.status).toBe(403);
  });

  it("rejects signup when profile details are missing", async () => {
    const { server } = app();
    const res = await request(server).post("/api/auth/signup").send({
      name: "Asha Rao",
      email: "incomplete@lokutara.test",
      password: "pass-word",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/phone/i);
  });

  it("returns 402 when the trial flag is off", async () => {
    const { server, stores } = app();
    await stores.billingSettingsStore.save({
      autoTrialOnSignup: false,
      defaultTrialDays: 14,
      trialModules: { assessments: true, community: true },
      legalName: "Lokutara",
      gstin: "",
      address: "",
      gstRate: 18,
    });
    const signup = await request(server).post("/api/auth/signup").send(
      signupPayload({ name: "No Trial", email: "locked@lokutara.test" }),
    );
    expect(signup.body.account.access.canEnterApp).toBe(false);
    const cookie = signup.headers["set-cookie"];
    const blocked = await request(server).get("/api/workspace/home").set("Cookie", cookie);
    expect(blocked.status).toBe(402);
    expect(blocked.body.error).toBe("paywall");
  });

  it("returns structured 404 for unknown API routes", async () => {
    const { server } = app();
    const res = await request(server).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("lets students ask but only specialists post answers, and returns reply rules", async () => {
    const { server, stores } = app();
    const signup = await request(server).post("/api/auth/signup").send(
      signupPayload({ email: "asha-forum@lokutara.test" }),
    );
    const cookie = signup.headers["set-cookie"];
    expect(signup.body.account.communityRole).toBe("student");

    const asked = await request(server)
      .post("/api/workspace/community")
      .set("Cookie", cookie)
      .send({
        title: "How do we brief managers after a workshop?",
        body: "We need a short ritual that does not dump a psychometric report on them.",
        tags: ["leadership"],
        communityNoticeAccepted: true,
      });
    expect(asked.status).toBe(201);
    const threadId = asked.body.thread.id as string;

    const explore = await request(server).get("/api/workspace/community").set("Cookie", cookie);
    expect(explore.status).toBe(200);
    expect(explore.body.replyPolicy.canReply).toBe(false);
    expect(explore.body.replyPolicy.rules.map((row: { who: string }) => row.who)).toEqual([
      "Students",
      "Specialists",
      "Admins",
    ]);

    const blocked = await request(server)
      .post(`/api/workspace/community/${threadId}/answers`)
      .set("Cookie", cookie)
      .send({ body: "Here is a specialist-grade answer that students must not post." });
    expect(blocked.status).toBe(403);

    const account = await stores.accountStore.getById(signup.body.account.id);
    await stores.accountStore.update({ ...account!, communityRole: "specialist" });

    const allowed = await request(server)
      .post(`/api/workspace/community/${threadId}/answers`)
      .set("Cookie", cookie)
      .send({ body: "Here is a specialist-grade answer that students must not post." });
    expect(allowed.status).toBe(201);
    expect(allowed.body.thread.answers).toHaveLength(1);
  });

  it("lets an expired trial start Razorpay checkout without opening the workspace", async () => {
    const stores = createMemoryStores();
    const links: Array<{ invoiceId: string; callbackUrl?: string | null }> = [];
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
      adminSecret: "test-admin-secret",
      razorpay: {
        configured: true,
        createPaymentLink: async (input) => {
          links.push({ invoiceId: input.invoiceId, callbackUrl: input.callbackUrl });
          return { id: "plink_c", shortUrl: "https://rzp.io/i/customer" };
        },
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
    const signup = await request(server).post("/api/auth/signup").send(
      signupPayload({ email: "pay@lokutara.test" }),
    );
    const cookie = signup.headers["set-cookie"];
    const account = await stores.accountStore.getById(signup.body.account.id);
    await stores.accountStore.update({ ...account!, trialEndsAt: new Date("2020-01-01T00:00:00.000Z") });

    const blocked = await request(server).get("/api/workspace/home").set("Cookie", cookie);
    expect(blocked.status).toBe(402);

    const me = await request(server).get("/api/billing/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.catalog[0].sku).toBe("app_access");
    expect(me.body.razorpayConfigured).toBe(true);

    const checkout = await request(server)
      .post("/api/billing/checkout")
      .set("Cookie", cookie)
      .send({ sku: "app_access" });
    expect(checkout.status).toBe(201);
    expect(checkout.body.paymentUrl).toBe("https://rzp.io/i/customer");
    expect(checkout.body.invoice.grantAccessOnPay).toBe(true);
    expect(checkout.body.invoice.totalPaise).toBe(589_882);
    expect(links[0]?.callbackUrl).toContain("/app/billing?paid=1");

    const again = await request(server)
      .post("/api/billing/checkout")
      .set("Cookie", cookie)
      .send({ sku: "app_access" });
    expect(again.status).toBe(200);
    expect(again.body.invoice.id).toBe(checkout.body.invoice.id);
  });

  it("lets a guest start Razorpay checkout for a workshop without a login", async () => {
    const stores = createMemoryStores();
    const links: Array<{ callbackUrl?: string | null }> = [];
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
      razorpay: {
        configured: true,
        createPaymentLink: async (input) => {
          links.push({ callbackUrl: input.callbackUrl });
          return { id: "plink_g", shortUrl: "https://rzp.io/i/guest" };
        },
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

    const catalog = await request(server).get("/api/billing/catalog");
    expect(catalog.status).toBe(200);
    expect(catalog.body.catalog.some((item: { sku: string }) => item.sku === "workshop")).toBe(true);

    const guest = await request(server).post("/api/billing/guest-checkout").send({
      sku: "workshop",
      name: "Priya Nair",
      email: "priya@company.test",
      phone: "9876543210",
      organisation: "Nair Labs",
      checkoutLegalAccepted: true,
      adultConfirmed: true,
    });
    expect(guest.status).toBe(201);
    expect(guest.body.paymentUrl).toBe("https://rzp.io/i/guest");
    expect(links[0]?.callbackUrl).toContain("offer=workshop");
    expect(links[0]?.callbackUrl).toContain("paid=1");

    const blocked = await request(server).post("/api/billing/guest-checkout").send({
      sku: "app_access",
      name: "Priya Nair",
      email: "nobody@company.test",
      phone: "9876543210",
      checkoutLegalAccepted: true,
      adultConfirmed: true,
    });
    expect(blocked.status).toBe(401);
  });

  it("returns a readable report after an assessment run", async () => {
    const { server } = app();
    const signup = await request(server).post("/api/auth/signup").send(
      signupPayload({ email: "report@lokutara.test" }),
    );
    const cookie = signup.headers["set-cookie"];
    const submitted = await request(server)
      .post("/api/workspace/assessments/ocean/submit")
      .set("Cookie", cookie)
      .send({
        consent: true,
        answers: {
          o1: { kind: "mcq", value: 5 },
          c1: { kind: "mcq", value: 4 },
          e1: { kind: "mcq", value: 3 },
          a1: { kind: "mcq", value: 4 },
          n1: { kind: "mcq", value: 2 },
        },
      });
    expect(submitted.status).toBe(201);
    expect(submitted.body.report.headline).toBeTruthy();
    expect(submitted.body.report.bands).toHaveLength(5);
    const runId = submitted.body.run.id as string;
    expect(submitted.body.run.title).toMatch(/ocean/i);

    const opened = await request(server)
      .get(`/api/workspace/assessments/runs/${runId}`)
      .set("Cookie", cookie);
    expect(opened.status).toBe(200);
    expect(opened.body.report.title).toBe("Trait profile (OCEAN)");
    expect(opened.body.report.bands[0].label).toBe("Openness");

    const pdf = await request(server).get(`/api/workspace/assessments/runs/${runId}/pdf`).set("Cookie", cookie);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/pdf/);
    const bytes = Buffer.isBuffer(pdf.body) ? pdf.body : Buffer.from(pdf.text || pdf.body);
    const text = bytes.toString("latin1");
    expect(text.slice(0, 5)).toBe("%PDF-");
    expect(text).toContain("Openness");
    expect(text).toContain("Overall score");
    expect(text).toContain("Strongly agree");
  });
});
