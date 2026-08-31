import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createEventsRouter } from "./routes/events";
import { createLeadsRouter } from "./routes/leads";
import { createStubRouter } from "./routes/stubs";
import { createProductRouter, createProductUpstream } from "./routes/product";
import type { ProductUpstream } from "../lib/product/upstream";
import { createAdminRouter } from "./routes/admin";
import { createRazorpayWebhookRouter } from "./routes/webhooks";
import { createExperimentsRouter } from "./routes/experiments";
import { createAuthRouter } from "./routes/auth";
import { createWorkspaceRouter } from "./routes/workspace";
import { apiNotFound, errorHandler } from "./middleware/errors";
import { createMemoryStores } from "./stores/memory";
import type {
  AccountStore,
  AppSessionStore,
  AssessmentRunStore,
  BillingSettingsStore,
  EventStore,
  ExperimentConfigStore,
  InvoiceStore,
  LeadStore,
  RateLimiter,
  SessionStore,
  StoreBackend,
  ThreadStore,
  VisitorStore,
} from "./stores/memory";
import type { RedisStatus } from "./stores/redis";
import type { RazorpayClient } from "./payments/razorpay";

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
  product?: ProductUpstream;
  accounts?: AccountStore;
  appSessions?: AppSessionStore;
  billing?: BillingSettingsStore;
  threads?: ThreadStore;
  assessmentRuns?: AssessmentRunStore;
  invoices?: InvoiceStore;
  razorpay?: RazorpayClient;
  razorpayWebhookSecret?: string | null;
};

export function createApiApp(deps: ApiDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  if (deps.trustProxy) app.set("trust proxy", 1);

  const fallback = createMemoryStores();
  const accounts = deps.accounts ?? fallback.accountStore;
  const appSessions = deps.appSessions ?? fallback.appSessionStore;
  const billing = deps.billing ?? fallback.billingSettingsStore;
  const threads = deps.threads ?? fallback.threadStore;
  const assessmentRuns = deps.assessmentRuns ?? fallback.assessmentRunStore;
  const invoices = deps.invoices ?? fallback.invoiceStore;

  app.use(cors({ origin: true, credentials: true }));
  app.use(
    "/api/webhooks/razorpay",
    express.raw({ type: "*/*" }),
    createRazorpayWebhookRouter({
      invoices,
      accounts,
      webhookSecret: deps.razorpayWebhookSecret ?? null,
    }),
  );
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
          now: [
            "workshops",
            "counselling",
            "discovery_leads",
            "first_party_analytics",
            "app",
            "billing",
          ],
          later: ["chat_product"],
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
          app: "paywalled",
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
  app.use("/api/auth", createAuthRouter({ accounts, sessions: appSessions, billing }));
  app.use(
    "/api/workspace",
    createWorkspaceRouter({ accounts, sessions: appSessions, threads, assessmentRuns }),
  );
  app.use(
    "/api/admin",
    createAdminRouter({
      events: deps.events,
      leads: deps.leads,
      experiments: deps.experiments,
      adminSecret: deps.adminSecret,
      adminEmail: deps.adminEmail,
      product: deps.product,
      accounts,
      billing,
      threads,
      assessmentRuns,
      invoices,
      razorpay: deps.razorpay,
    }),
  );
  app.use("/api/product", createProductRouter(deps.product ?? createProductUpstream({})));
  app.use("/api/chat", createStubRouter("chat"));
  app.use("/api", apiNotFound);
  app.use(errorHandler);

  return app;
}
