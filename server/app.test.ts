import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApiApp } from "../server/app";
import { createMemoryStores } from "../server/stores/memory";
import { CONSENT_COOKIE } from "../lib/tracking/consent";

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
      });
      expect(res.status).toBe(201);
    }
    const blocked = await request(server).post("/api/leads").send({
      type: "popup",
      name: "Visitor",
      email: "last@mail.test",
      phone: "9876543210",
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

    const signup = await request(server).post("/api/auth/signup").send({
      name: "Asha Rao",
      email: "asha@lokutara.test",
      password: "pass-word",
    });
    expect(signup.status).toBe(201);
    expect(signup.body.account.access.status).toBe("trial");
    expect(signup.body.account.access.canEnterApp).toBe(true);
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
    expect(submitted.body.run.traits.length).toBeGreaterThan(0);
    expect(submitted.body.run.disclaimer).toMatch(/not a licensed psychometric/i);
    expect(submitted.body.run.resultsPath).toBe(
      `/app/assessments/ocean/results?run=${submitted.body.run.id}`,
    );

    const results = await request(server)
      .get("/api/workspace/assessments/ocean/results")
      .set("Cookie", cookie);
    expect(results.status).toBe(200);
    expect(results.body.latest.id).toBe(submitted.body.run.id);
    expect(results.body.runs[0].traits.map((row: { label: string }) => row.label)).toContain("Openness");

    const one = await request(server)
      .get(`/api/workspace/runs/${submitted.body.run.id}`)
      .set("Cookie", cookie);
    expect(one.status).toBe(200);
    expect(one.body.run.score).toBe(submitted.body.run.score);

    const profile = await request(server)
      .patch("/api/auth/me")
      .set("Cookie", cookie)
      .send({
        name: "Asha Rao",
        email: "asha@lokutara.test",
        phone: "+91 98765 43210",
        gender: "woman",
        age: 29,
        city: "Bengaluru",
      });
    expect(profile.status).toBe(200);
    expect(profile.body.account.phone).toBe("+919876543210");
    expect(profile.body.account.gender).toBe("woman");
    expect(profile.body.account.age).toBe(29);
    expect(profile.body.account.city).toBe("Bengaluru");
    expect(profile.body.account.email).toBe("asha@lokutara.test");

    const badPhone = await request(server)
      .patch("/api/auth/me")
      .set("Cookie", cookie)
      .send({ phone: "12" });
    expect(badPhone.status).toBe(400);

    const me = await request(server).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.account.email).toBe("asha@lokutara.test");
  });

  it("returns 402 when the trial flag is off", async () => {
    const { server, stores } = app();
    await stores.billingSettingsStore.save({
      autoTrialOnSignup: false,
      defaultTrialDays: 14,
      trialModules: { assessments: true, community: true },
    });
    const signup = await request(server).post("/api/auth/signup").send({
      name: "No Trial",
      email: "locked@lokutara.test",
      password: "pass-word",
    });
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
    const signup = await request(server).post("/api/auth/signup").send({
      name: "Asha Rao",
      email: "asha-forum@lokutara.test",
      password: "pass-word",
    });
    const cookie = signup.headers["set-cookie"];
    expect(signup.body.account.communityRole).toBe("student");

    const asked = await request(server)
      .post("/api/workspace/community")
      .set("Cookie", cookie)
      .send({
        title: "How do we brief managers after a workshop?",
        body: "We need a short ritual that does not dump a psychometric report on them.",
        tags: ["leadership"],
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
});
