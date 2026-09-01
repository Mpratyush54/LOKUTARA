import type { StoredAnalyticsEvent } from "../../lib/tracking/events";
import type { ValidLead } from "../../lib/leads/validate";
import type { Attribution } from "../../lib/tracking/attribution";
import {
  DEFAULT_BILLING_SETTINGS,
  type AccountRecord,
  type BillingSettings,
} from "../../lib/access/billing";
import type { Invoice } from "../../lib/billing/invoices";
import { EMPTY_IDENTITY } from "../../lib/access/profile";
import type { LocalAnswer, LocalThread, TraitScore } from "../../lib/product/workspace";

export type StoredLead = ValidLead & {
  id: string;
  createdAt: Date;
  visitorId: string | null;
  consentedAt: Date;
  adultConfirmedAt: Date;
  privacyNoticeVersion: string;
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
  consentedAt: Date;
  noticeVersion: string;
  traits: TraitScore[];
  createdAt: Date;
};

export type AccountStore = {
  create(account: AccountRecord): Promise<AccountRecord>;
  getByEmail(email: string): Promise<AccountRecord | null>;
  getById(id: string): Promise<AccountRecord | null>;
  list(): Promise<AccountRecord[]>;
  update(account: AccountRecord): Promise<AccountRecord>;
  delete(id: string): Promise<void>;
};

export type AppSessionStore = {
  create(session: AppSession): Promise<void>;
  get(token: string): Promise<AppSession | null>;
  delete(token: string): Promise<void>;
  deleteByAccount(accountId: string): Promise<void>;
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
  anonymizeByAccount(accountId: string): Promise<void>;
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
  get(id: string): Promise<AssessmentRun | null>;
  listByAccount(accountId: string): Promise<AssessmentRun[]>;
  list(): Promise<AssessmentRun[]>;
  deleteByAccount(accountId: string): Promise<void>;
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
      const stored = { ...EMPTY_IDENTITY, ...account };
      accounts.set(stored.id, stored);
      accountsByEmail.set(stored.email.toLowerCase(), stored.id);
      return stored;
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
      const previous = accounts.get(account.id);
      if (previous && previous.email.toLowerCase() !== account.email.toLowerCase()) {
        accountsByEmail.delete(previous.email.toLowerCase());
      }
      accounts.set(account.id, { ...EMPTY_IDENTITY, ...account });
      accountsByEmail.set(account.email.toLowerCase(), account.id);
      return accounts.get(account.id)!;
    },
    async delete(id) {
      const account = accounts.get(id);
      if (account) accountsByEmail.delete(account.email.toLowerCase());
      accounts.delete(id);
    },
  };

  const appSessionStore: AppSessionStore = {
    async create(session) {
      appSessions.set(session.token, session);
    },
    async get(token) {
      const session = appSessions.get(token) ?? null;
      if (session && Date.now() - session.createdAt.getTime() > 30 * 24 * 60 * 60 * 1000) {
        appSessions.delete(token);
        return null;
      }
      return session;
    },
    async delete(token) {
      appSessions.delete(token);
    },
    async deleteByAccount(accountId) {
      for (const [token, session] of appSessions) {
        if (session.accountId === accountId) appSessions.delete(token);
      }
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
    async anonymizeByAccount(accountId) {
      for (const thread of threads) {
        if (thread.authorId === accountId) {
          thread.authorId = "deleted";
          thread.authorName = "Former member";
        }
        for (const answer of thread.answers) {
          if (answer.authorId === accountId) {
            answer.authorId = "deleted";
            answer.authorName = "Former member";
          }
          answer.upvotedBy = answer.upvotedBy.filter((id) => id !== accountId);
          answer.upvotes = answer.upvotedBy.length;
        }
      }
    },
  };

  const assessmentRunStore: AssessmentRunStore = {
    async insert(run) {
      assessmentRuns.push({ ...run, traits: run.traits ?? [] });
      return run;
    },
    async get(id) {
      return assessmentRuns.find((run) => run.id === id) ?? null;
    },
    async listByAccount(accountId) {
      return assessmentRuns.filter((run) => run.accountId === accountId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async list() {
      return [...assessmentRuns];
    },
    async deleteByAccount(accountId) {
      for (let index = assessmentRuns.length - 1; index >= 0; index -= 1) {
        if (assessmentRuns[index].accountId === accountId) assessmentRuns.splice(index, 1);
      }
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
