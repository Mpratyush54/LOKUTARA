import type { StoredAnalyticsEvent } from "../../lib/tracking/events";
import type { ValidLead } from "../../lib/leads/validate";
import type { Attribution } from "../../lib/tracking/attribution";

export type StoredLead = ValidLead & {
  id: string;
  createdAt: Date;
  visitorId: string | null;
};

export type StoredVisitor = {
  visitorId: string;
  firstTouch: Attribution;
  lastTouch: Attribution;
  firstSeenAt: Date;
  lastSeenAt: Date;
  userId: string | null;
};

export type StoredSession = {
  sessionId: string;
  visitorId: string;
  startedAt: Date;
  lastSeenAt: Date;
  landingPage: string | null;
  device: string | null;
  eventCount: number;
};

export type EventStore = {
  insert(event: StoredAnalyticsEvent): Promise<void>;
  list(): Promise<StoredAnalyticsEvent[]>;
};

export type LeadStore = {
  insert(lead: StoredLead): Promise<StoredLead>;
  list(limit?: number): Promise<StoredLead[]>;
};

export type StoredExperimentConfig = {
  key: string;
  enabled: boolean;
  weights: { control: number; variant: number };
  forcedVariant: "control" | "variant" | null;
  updatedAt: Date;
};

export type ExperimentConfigStore = {
  list(): Promise<StoredExperimentConfig[]>;
  get(key: string): Promise<StoredExperimentConfig | null>;
  upsert(config: StoredExperimentConfig): Promise<StoredExperimentConfig>;
};

export type VisitorStore = {
  upsert(visitor: StoredVisitor): Promise<void>;
  get(visitorId: string): Promise<StoredVisitor | null>;
};

export type SessionStore = {
  touch(session: Omit<StoredSession, "eventCount"> & { eventCount?: number }): Promise<void>;
  get(sessionId: string): Promise<StoredSession | null>;
};

export type RateLimiter = {
  allow(key: string, limit: number, windowMs: number): Promise<boolean>;
};

export type StoreBackend = "memory" | "mongo";

export function createMemoryStores() {
  const events: StoredAnalyticsEvent[] = [];
  const leads: StoredLead[] = [];
  const visitors = new Map<string, StoredVisitor>();
  const sessions = new Map<string, StoredSession>();
  const experimentConfigs = new Map<string, StoredExperimentConfig>();
  const buckets = new Map<string, number[]>();

  const eventStore: EventStore = {
    async insert(event) {
      events.push(event);
    },
    async list() {
      return [...events];
    },
  };

  const leadStore: LeadStore = {
    async insert(lead) {
      leads.push(lead);
      return lead;
    },
    async list(limit = 100) {
      const sorted = [...leads].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return sorted.slice(0, Math.max(1, Math.min(limit, 500)));
    },
  };

  const experimentConfigStore: ExperimentConfigStore = {
    async list() {
      return [...experimentConfigs.values()].sort((a, b) => a.key.localeCompare(b.key));
    },
    async get(key) {
      return experimentConfigs.get(key) ?? null;
    },
    async upsert(config) {
      experimentConfigs.set(config.key, config);
      return config;
    },
  };

  const visitorStore: VisitorStore = {
    async upsert(visitor) {
      visitors.set(visitor.visitorId, visitor);
    },
    async get(visitorId) {
      return visitors.get(visitorId) ?? null;
    },
  };

  const sessionStore: SessionStore = {
    async touch(input) {
      const existing = sessions.get(input.sessionId);
      if (!existing) {
        sessions.set(input.sessionId, {
          sessionId: input.sessionId,
          visitorId: input.visitorId,
          startedAt: input.startedAt,
          lastSeenAt: input.lastSeenAt,
          landingPage: input.landingPage,
          device: input.device,
          eventCount: input.eventCount ?? 1,
        });
        return;
      }
      sessions.set(input.sessionId, {
        ...existing,
        visitorId: input.visitorId || existing.visitorId,
        lastSeenAt: input.lastSeenAt,
        landingPage: existing.landingPage ?? input.landingPage,
        device: existing.device ?? input.device,
        eventCount: existing.eventCount + (input.eventCount ?? 1),
      });
    },
    async get(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
  };

  const rateLimiter: RateLimiter = {
    async allow(key, limit, windowMs) {
      const now = Date.now();
      const current = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
      if (current.length >= limit) {
        buckets.set(key, current);
        return false;
      }
      current.push(now);
      buckets.set(key, current);
      return true;
    },
  };

  return {
    events,
    leads,
    visitors,
    sessions,
    experimentConfigs,
    eventStore,
    leadStore,
    visitorStore,
    sessionStore,
    experimentConfigStore,
    rateLimiter,
  };
}
