import type { StoredAnalyticsEvent } from "../../lib/tracking/events";
import type { ValidLead } from "../../lib/leads/validate";
import type { Attribution } from "../../lib/tracking/attribution";
import {
  DEFAULT_BILLING_SETTINGS,
  type AccountRecord,
  type BillingSettings,
} from "../../lib/access/billing";
import type { Invoice } from "../../lib/billing/invoices";
import type { LocalAnswer, LocalThread } from "../../lib/product/workspace";

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

export type AppSession = {
  token: string;
  accountId: string;
  createdAt: Date;
};

export type AssessmentRun = {
  id: string;
  accountId: string;
  assessmentId: string;
  answers: Record<string, unknown>;
  score: number;
  createdAt: Date;
};

export type AccountStore = {
  create(account: AccountRecord): Promise<AccountRecord>;
  getByEmail(email: string): Promise<AccountRecord | null>;
  getById(id: string): Promise<AccountRecord | null>;
  list(): Promise<AccountRecord[]>;
  update(account: AccountRecord): Promise<AccountRecord>;
};

export type AppSessionStore = {
  create(session: AppSession): Promise<void>;
  get(token: string): Promise<AppSession | null>;
  delete(token: string): Promise<void>;
};

export type BillingSettingsStore = {
  get(): Promise<BillingSettings>;
  save(settings: BillingSettings): Promise<BillingSettings>;
};

export type ThreadStore = {
  list(): Promise<LocalThread[]>;
  get(id: string): Promise<LocalThread | null>;
  create(thread: LocalThread): Promise<LocalThread>;
  addAnswer(id: string, answer: LocalAnswer): Promise<LocalThread | null>;
  incrementViews(id: string): Promise<LocalThread | null>;
  toggleUpvote(threadId: string, answerId: string, accountId: string): Promise<LocalThread | null>;
};

export type InvoiceStore = {
  list(): Promise<Invoice[]>;
  get(id: string): Promise<Invoice | null>;
  getByPaymentLinkId(linkId: string): Promise<Invoice | null>;
  insert(invoice: Invoice): Promise<Invoice>;
  update(invoice: Invoice): Promise<Invoice>;
};

export type AssessmentRunStore = {
  insert(run: AssessmentRun): Promise<AssessmentRun>;
  listByAccount(accountId: string): Promise<AssessmentRun[]>;
  list(): Promise<AssessmentRun[]>;
};

export type StoreBackend = "memory" | "mongo";

export function createMemoryStores() {
  const events: StoredAnalyticsEvent[] = [];
  const leads: StoredLead[] = [];
  const visitors = new Map<string, StoredVisitor>();
  const sessions = new Map<string, StoredSession>();
  const experimentConfigs = new Map<string, StoredExperimentConfig>();
  const buckets = new Map<string, number[]>();
  const accounts = new Map<string, AccountRecord>();
  const accountsByEmail = new Map<string, string>();
  const appSessions = new Map<string, AppSession>();
  const threads: LocalThread[] = [];
  const assessmentRuns: AssessmentRun[] = [];
  const invoices: Invoice[] = [];
  let billingSettings: BillingSettings = { ...DEFAULT_BILLING_SETTINGS, trialModules: { ...DEFAULT_BILLING_SETTINGS.trialModules } };

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

  const accountStore: AccountStore = {
    async create(account) {
      accounts.set(account.id, account);
      accountsByEmail.set(account.email.toLowerCase(), account.id);
      return account;
    },
    async getByEmail(email) {
      const id = accountsByEmail.get(email.trim().toLowerCase());
      return id ? accounts.get(id) ?? null : null;
    },
    async getById(id) {
      return accounts.get(id) ?? null;
    },
    async list() {
      return [...accounts.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async update(account) {
      accounts.set(account.id, account);
      accountsByEmail.set(account.email.toLowerCase(), account.id);
      return account;
    },
  };

  const appSessionStore: AppSessionStore = {
    async create(session) {
      appSessions.set(session.token, session);
    },
    async get(token) {
      return appSessions.get(token) ?? null;
    },
    async delete(token) {
      appSessions.delete(token);
    },
  };

  const billingSettingsStore: BillingSettingsStore = {
    async get() {
      return billingSettings;
    },
    async save(settings) {
      billingSettings = settings;
      return settings;
    },
  };

  const threadStore: ThreadStore = {
    async list() {
      return [...threads].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async get(id) {
      return threads.find((thread) => thread.id === id) ?? null;
    },
    async create(thread) {
      threads.unshift(thread);
      return thread;
    },
    async addAnswer(id, answer) {
      const thread = threads.find((item) => item.id === id);
      if (!thread) return null;
      thread.answers.push(answer);
      return thread;
    },
    async incrementViews(id) {
      const thread = threads.find((item) => item.id === id);
      if (!thread) return null;
      thread.views += 1;
      return thread;
    },
    async toggleUpvote(threadId, answerId, accountId) {
      const thread = threads.find((item) => item.id === threadId);
      if (!thread) return null;
      const answer = thread.answers.find((item) => item.id === answerId);
      if (!answer) return null;
      const already = answer.upvotedBy.includes(accountId);
      answer.upvotedBy = already
        ? answer.upvotedBy.filter((id) => id !== accountId)
        : [...answer.upvotedBy, accountId];
      answer.upvotes = answer.upvotedBy.length;
      return thread;
    },
  };

  const assessmentRunStore: AssessmentRunStore = {
    async insert(run) {
      assessmentRuns.push(run);
      return run;
    },
    async listByAccount(accountId) {
      return assessmentRuns.filter((run) => run.accountId === accountId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async list() {
      return [...assessmentRuns];
    },
  };

  const invoiceStore: InvoiceStore = {
    async list() {
      return [...invoices].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async get(id) {
      return invoices.find((invoice) => invoice.id === id) ?? null;
    },
    async getByPaymentLinkId(linkId) {
      return invoices.find((invoice) => invoice.razorpayPaymentLinkId === linkId) ?? null;
    },
    async insert(invoice) {
      invoices.push(invoice);
      return invoice;
    },
    async update(invoice) {
      const i = invoices.findIndex((row) => row.id === invoice.id);
      if (i >= 0) invoices[i] = invoice;
      else invoices.push(invoice);
      return invoice;
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
    accountStore,
    appSessionStore,
    billingSettingsStore,
    threadStore,
    assessmentRunStore,
    invoiceStore,
    invoices,
  };
}
