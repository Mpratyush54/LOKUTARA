import { loadEnvConfig } from "@next/env";
import next from "next";
import { createServer } from "node:http";
import { createApiApp } from "./app";
import { loadEnv } from "./env";
import { createMemoryStores } from "./stores/memory";
import {
  connectMongo,
  ensureMongoIndexes,
  mongoAccountStore,
  mongoAppSessionStore,
  mongoAssessmentRunStore,
  mongoBillingSettingsStore,
  mongoEventStore,
  mongoExperimentConfigStore,
  mongoLeadStore,
  mongoPing,
  mongoReady,
  mongoSessionStore,
  mongoThreadStore,
  mongoVisitorStore,
} from "./stores/mongo";
import { createRedisBundle } from "./stores/redis";

// Load .env* before Mongo/Redis so custom-server boot sees local config.
loadEnvConfig(process.cwd());

async function main() {
  const env = loadEnv();
  for (const warning of env.warnings) {
    console.warn(`[env] ${warning}`);
  }

  const memory = createMemoryStores();
  let storeBackend: "memory" | "mongo" = "memory";

  if (env.mongodbUri) {
    try {
      await connectMongo(env.mongodbUri);
      await ensureMongoIndexes();
      storeBackend = "mongo";
      console.log("Mongo connected; indexes synced");
    } catch (error) {
      console.warn("Mongo unavailable, using memory stores", error);
      storeBackend = "memory";
    }
  }

  const redis = env.redisUrl ? createRedisBundle(env.redisUrl) : null;
  const useMongo = storeBackend === "mongo" && mongoReady();

  const deps = {
    events: useMongo ? mongoEventStore : memory.eventStore,
    leads: useMongo ? mongoLeadStore : memory.leadStore,
    visitors: useMongo ? mongoVisitorStore : memory.visitorStore,
    sessions: useMongo ? mongoSessionStore : memory.sessionStore,
    experiments: useMongo ? mongoExperimentConfigStore : memory.experimentConfigStore,
    accounts: useMongo ? mongoAccountStore : memory.accountStore,
    appSessions: useMongo ? mongoAppSessionStore : memory.appSessionStore,
    billing: useMongo ? mongoBillingSettingsStore : memory.billingSettingsStore,
    threads: useMongo ? mongoThreadStore : memory.threadStore,
    assessmentRuns: useMongo ? mongoAssessmentRunStore : memory.assessmentRunStore,
    rateLimiter: redis ? redis.rateLimiter : memory.rateLimiter,
    trustProxy: env.trustProxy,
    adminSecret: env.adminDashboardSecret,
    adminEmail: env.adminEmail,
    product: {
      testsApiUrl: env.testsApiUrl,
      forumApiUrl: env.forumApiUrl,
    },
    health: {
      storeBackend: useMongo ? ("mongo" as const) : ("memory" as const),
      mongoConfigured: Boolean(env.mongodbUri),
      mongoOk: () => (env.mongodbUri ? mongoPing() : false),
      redisConfigured: Boolean(env.redisUrl),
      // Unset REDIS_URL → skipped (in-memory rate limits); never block boot.
      redisStatus: () => (redis ? redis.status() : ("disabled" as const)),
      redisOk: () => (redis ? redis.ping() : true),
    },
  };

  const expressApp = createApiApp(deps);
  const nextApp = next({ dev: env.nodeEnv !== "production" });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  expressApp.all("*", (req, res) => {
    return handle(req, res);
  });

  const server = createServer(expressApp);
  server.listen(env.port, () => {
    console.log(`Lokutara listening on http://localhost:${env.port} (stores=${deps.health.storeBackend})`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
