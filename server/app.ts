import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createEventsRouter } from "./routes/events";
import { createLeadsRouter } from "./routes/leads";
import { createStubRouter } from "./routes/stubs";
import { createAdminRouter } from "./routes/admin";
import { createExperimentsRouter } from "./routes/experiments";
import { apiNotFound, errorHandler } from "./middleware/errors";
import type {
  EventStore,
  ExperimentConfigStore,
  LeadStore,
  RateLimiter,
  SessionStore,
  StoreBackend,
  VisitorStore,
} from "./stores/memory";
import type { RedisStatus } from "./stores/redis";

export type HealthDeps = {
  storeBackend: StoreBackend;
  mongoConfigured: boolean;
  mongoOk: () => Promise<boolean> | boolean;
  redisConfigured: boolean;
  redisStatus: () => RedisStatus | "memory";
  redisOk: () => Promise<boolean> | boolean;
};

export type ApiDeps = {
  events: EventStore;
  leads: LeadStore;
  visitors: VisitorStore;
  sessions: SessionStore;
  experiments: ExperimentConfigStore;
  rateLimiter: RateLimiter;
  health?: HealthDeps;
  trustProxy?: boolean;
  adminSecret?: string | null;
  adminEmail?: string | null;
};

export function createApiApp(deps: ApiDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  if (deps.trustProxy) app.set("trust proxy", 1);

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());

  app.get("/api/health", async (_req, res, next) => {
    try {
      const health = deps.health;
      const mongoOk = health ? await Promise.resolve(health.mongoOk()) : false;
      const redisOk = health ? await Promise.resolve(health.redisOk()) : true;
      const redisStatus = health ? health.redisStatus() : "disabled";
      const body = {
        ok: true,
        service: "lokutara",
        launch: {
          now: ["workshops", "counselling", "discovery_leads", "first_party_analytics"],
          later: ["connect", "measure", "app", "chat_product", "tests_product"],
        },
        stores: {
          backend: health?.storeBackend ?? "memory",
          mongo: {
            configured: health?.mongoConfigured ?? false,
            ok: mongoOk,
          },
          redis: {
            configured: health?.redisConfigured ?? false,
            status: redisStatus,
            ok: redisOk,
          },
        },
        mounts: {
          chat: "stub_501",
          tests: "stub_501",
          admin: deps.adminSecret ? "gated" : "disabled",
        },
      };
      res.json(body);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/events", createEventsRouter(deps));
  app.use("/api/leads", createLeadsRouter(deps));
  app.use("/api/experiments", createExperimentsRouter({ experiments: deps.experiments }));
  app.use(
    "/api/admin",
    createAdminRouter({
      events: deps.events,
      leads: deps.leads,
      experiments: deps.experiments,
      adminSecret: deps.adminSecret,
      adminEmail: deps.adminEmail,
    }),
  );
  app.use("/api/chat", createStubRouter("chat"));
  app.use("/api/tests", createStubRouter("tests"));
  app.use("/api", apiNotFound);
  app.use(errorHandler);

  return app;
}
