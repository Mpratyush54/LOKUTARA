import mongoose from "mongoose";
import type { StoredAnalyticsEvent } from "../../lib/tracking/events";
import type { AccountRecord, BillingSettings, ModuleFlags, Plan } from "../../lib/access/billing";
import { DEFAULT_BILLING_SETTINGS } from "../../lib/access/billing";
import type { LocalThread } from "../../lib/product/workspace";
import type {
  AccountStore,
  AppSession,
  AppSessionStore,
  AssessmentRun,
  AssessmentRunStore,
  BillingSettingsStore,
  EventStore,
  ExperimentConfigStore,
  LeadStore,
  SessionStore,
  StoredExperimentConfig,
  StoredLead,
  StoredSession,
  StoredVisitor,
  ThreadStore,
  VisitorStore,
} from "./memory";

const EventSchema = new mongoose.Schema(
  {
    name: { type: String, index: true },
    visitorId: { type: String, index: true },
    sessionId: { type: String, index: true },
    userId: String,
    path: String,
    title: String,
    referrer: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    utmContent: String,
    channel: { type: String, index: true },
    landingPage: String,
    device: String,
    browser: String,
    os: String,
    country: String,
    city: String,
    props: { type: Object, default: {} },
    at: { type: Date, index: true },
  },
  { collection: "events" },
);
EventSchema.index({ visitorId: 1, at: -1 });
EventSchema.index({ name: 1, at: -1 });

const LeadSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, index: true },
    type: { type: String, index: true },
    name: String,
    email: { type: String, index: true },
    phone: String,
    role: String,
    organisation: String,
    sizeBand: String,
    preferredTime: String,
    visitorId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "leads" },
);

const VisitorSchema = new mongoose.Schema(
  {
    visitorId: { type: String, unique: true },
    firstTouch: Object,
    lastTouch: Object,
    firstSeenAt: Date,
    lastSeenAt: { type: Date, index: true },
    userId: { type: String, index: true, sparse: true },
  },
  { collection: "visitors" },
);

const SessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, unique: true },
    visitorId: { type: String, index: true },
    startedAt: Date,
    lastSeenAt: { type: Date, index: true },
    landingPage: String,
    device: String,
    eventCount: { type: Number, default: 1 },
  },
  { collection: "sessions" },
);

const ExperimentConfigSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    weights: {
      control: { type: Number, default: 50 },
      variant: { type: Number, default: 50 },
    },
    forcedVariant: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "experiment_configs" },
);

const AccountSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, index: true },
    email: { type: String, unique: true, index: true },
    name: String,
    passwordHash: String,
    plan: { type: String, index: true },
    trialEndsAt: Date,
    modules: {
      assessments: { type: Boolean, default: false },
      community: { type: Boolean, default: false },
    },
    seats: { type: Number, default: 1 },
    communityRole: { type: String, enum: ["student", "specialist", "admin"], default: "student" },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "app_accounts" },
);

const AppSessionSchema = new mongoose.Schema(
  {
    token: { type: String, unique: true, index: true },
    accountId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "app_sessions" },
);

const BillingSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "default" },
    autoTrialOnSignup: { type: Boolean, default: true },
    defaultTrialDays: { type: Number, default: 14 },
    trialModules: {
      assessments: { type: Boolean, default: true },
      community: { type: Boolean, default: true },
    },
  },
  { collection: "billing_settings" },
);

const ThreadSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, index: true },
    authorId: String,
    authorName: String,
    title: String,
    body: String,
    tags: [String],
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
    answers: [
      {
        id: String,
        authorId: String,
        authorName: String,
        body: String,
        createdAt: Date,
        upvotes: { type: Number, default: 0 },
        upvotedBy: [String],
      },
    ],
  },
  { collection: "app_threads" },
);

const AssessmentRunSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, index: true },
    accountId: { type: String, index: true },
    assessmentId: { type: String, index: true },
    answers: { type: Object, default: {} },
    score: Number,
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "app_assessment_runs" },
);

export const EventModel = mongoose.models.Event || mongoose.model("Event", EventSchema);
export const LeadModel = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
export const VisitorModel = mongoose.models.Visitor || mongoose.model("Visitor", VisitorSchema);
export const SessionModel = mongoose.models.Session || mongoose.model("Session", SessionSchema);
export const ExperimentConfigModel =
  mongoose.models.ExperimentConfig || mongoose.model("ExperimentConfig", ExperimentConfigSchema);
export const AccountModel = mongoose.models.AppAccount || mongoose.model("AppAccount", AccountSchema);
export const AppSessionModel =
  mongoose.models.AppSession || mongoose.model("AppSession", AppSessionSchema);
export const BillingSettingsModel =
  mongoose.models.BillingSettings || mongoose.model("BillingSettings", BillingSettingsSchema);
export const ThreadModel = mongoose.models.AppThread || mongoose.model("AppThread", ThreadSchema);
export const AssessmentRunModel =
  mongoose.models.AppAssessmentRun || mongoose.model("AppAssessmentRun", AssessmentRunSchema);

export async function connectMongo(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
}

export async function ensureMongoIndexes(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;
  await Promise.all([
    EventModel.syncIndexes(),
    LeadModel.syncIndexes(),
    VisitorModel.syncIndexes(),
    SessionModel.syncIndexes(),
    ExperimentConfigModel.syncIndexes(),
    AccountModel.syncIndexes(),
    AppSessionModel.syncIndexes(),
    BillingSettingsModel.syncIndexes(),
    ThreadModel.syncIndexes(),
    AssessmentRunModel.syncIndexes(),
  ]);
}

export function mongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function mongoPing(): Promise<boolean> {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db?.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export const mongoEventStore: EventStore = {
  async insert(event: StoredAnalyticsEvent) {
    await EventModel.create(event);
  },
  async list() {
    const rows = await EventModel.find().lean();
    return rows.map((row) => ({
      ...row,
      at: new Date(row.at as Date),
    })) as StoredAnalyticsEvent[];
  },
};

export const mongoLeadStore: LeadStore = {
  async insert(lead: StoredLead) {
    await LeadModel.create(lead);
    return lead;
  },
  async list(limit = 100) {
    const take = Math.max(1, Math.min(limit, 500));
    const rows = await LeadModel.find().sort({ createdAt: -1 }).limit(take).lean();
    return rows.map((row) => ({
      id: row.id as string,
      type: row.type as StoredLead["type"],
      name: row.name as string,
      email: row.email as string,
      phone: row.phone as string,
      role: (row.role as string | null) ?? null,
      organisation: (row.organisation as string | null) ?? null,
      sizeBand: (row.sizeBand as StoredLead["sizeBand"]) ?? null,
      preferredTime: (row.preferredTime as string | null) ?? null,
      visitorId: (row.visitorId as string | null) ?? null,
      createdAt: new Date(row.createdAt as Date),
    }));
  },
};

export const mongoVisitorStore: VisitorStore = {
  async upsert(visitor: StoredVisitor) {
    await VisitorModel.findOneAndUpdate({ visitorId: visitor.visitorId }, visitor, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  },
  async get(visitorId: string) {
    const row = await VisitorModel.findOne({ visitorId }).lean();
    if (!row) return null;
    return {
      visitorId: row.visitorId as string,
      firstTouch: row.firstTouch as StoredVisitor["firstTouch"],
      lastTouch: row.lastTouch as StoredVisitor["lastTouch"],
      firstSeenAt: new Date(row.firstSeenAt as Date),
      lastSeenAt: new Date(row.lastSeenAt as Date),
      userId: (row.userId as string | null) ?? null,
    };
  },
};

export const mongoSessionStore: SessionStore = {
  async touch(input) {
    const existing = await SessionModel.findOne({ sessionId: input.sessionId }).lean();
    if (!existing) {
      await SessionModel.create({
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
    await SessionModel.updateOne(
      { sessionId: input.sessionId },
      {
        $set: {
          visitorId: input.visitorId || existing.visitorId,
          lastSeenAt: input.lastSeenAt,
          landingPage: existing.landingPage ?? input.landingPage,
          device: existing.device ?? input.device,
        },
        $inc: { eventCount: input.eventCount ?? 1 },
      },
    );
  },
  async get(sessionId: string) {
    const row = await SessionModel.findOne({ sessionId }).lean();
    if (!row) return null;
    return {
      sessionId: row.sessionId as string,
      visitorId: row.visitorId as string,
      startedAt: new Date(row.startedAt as Date),
      lastSeenAt: new Date(row.lastSeenAt as Date),
      landingPage: (row.landingPage as string | null) ?? null,
      device: (row.device as string | null) ?? null,
      eventCount: Number(row.eventCount || 0),
    } satisfies StoredSession;
  },
};

function mapExperimentConfig(row: Record<string, unknown>): StoredExperimentConfig {
  const forced = row.forcedVariant;
  return {
    key: row.key as string,
    enabled: Boolean(row.enabled ?? true),
    weights: {
      control: Number((row.weights as { control?: number } | undefined)?.control ?? 50),
      variant: Number((row.weights as { variant?: number } | undefined)?.variant ?? 50),
    },
    forcedVariant: forced === "control" || forced === "variant" ? forced : null,
    updatedAt: new Date((row.updatedAt as Date) || Date.now()),
  };
}

export const mongoExperimentConfigStore: ExperimentConfigStore = {
  async list() {
    const rows = await ExperimentConfigModel.find().sort({ key: 1 }).lean();
    return rows.map((row) => mapExperimentConfig(row as Record<string, unknown>));
  },
  async get(key: string) {
    const row = await ExperimentConfigModel.findOne({ key }).lean();
    if (!row) return null;
    return mapExperimentConfig(row as Record<string, unknown>);
  },
  async upsert(config: StoredExperimentConfig) {
    await ExperimentConfigModel.findOneAndUpdate(
      { key: config.key },
      {
        key: config.key,
        enabled: config.enabled,
        weights: config.weights,
        forcedVariant: config.forcedVariant,
        updatedAt: config.updatedAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return config;
  },
};

function mapAccount(row: Record<string, unknown>): AccountRecord {
  const modules = (row.modules as ModuleFlags | undefined) ?? { assessments: false, community: false };
  return {
    id: row.id as string,
    email: row.email as string,
    name: (row.name as string) || "",
    passwordHash: (row.passwordHash as string) || "",
    plan: (row.plan as Plan) || "none",
    trialEndsAt: row.trialEndsAt ? new Date(row.trialEndsAt as Date) : null,
    modules: {
      assessments: Boolean(modules.assessments),
      community: Boolean(modules.community),
    },
    seats: Number(row.seats || 1),
    communityRole:
      row.communityRole === "specialist" || row.communityRole === "admin" ? row.communityRole : "student",
    createdAt: new Date((row.createdAt as Date) || Date.now()),
  };
}

export const mongoAccountStore: AccountStore = {
  async create(account) {
    await AccountModel.create(account);
    return account;
  },
  async getByEmail(email) {
    const row = await AccountModel.findOne({ email: email.trim().toLowerCase() }).lean();
    return row ? mapAccount(row as Record<string, unknown>) : null;
  },
  async getById(id) {
    const row = await AccountModel.findOne({ id }).lean();
    return row ? mapAccount(row as Record<string, unknown>) : null;
  },
  async list() {
    const rows = await AccountModel.find().sort({ createdAt: -1 }).lean();
    return rows.map((row) => mapAccount(row as Record<string, unknown>));
  },
  async update(account) {
    await AccountModel.findOneAndUpdate({ id: account.id }, account, { upsert: true, new: true });
    return account;
  },
};

export const mongoAppSessionStore: AppSessionStore = {
  async create(session: AppSession) {
    await AppSessionModel.create(session);
  },
  async get(token: string) {
    const row = await AppSessionModel.findOne({ token }).lean();
    if (!row) return null;
    return {
      token: row.token as string,
      accountId: row.accountId as string,
      createdAt: new Date(row.createdAt as Date),
    };
  },
  async delete(token: string) {
    await AppSessionModel.deleteOne({ token });
  },
};

export const mongoBillingSettingsStore: BillingSettingsStore = {
  async get() {
    const row = await BillingSettingsModel.findOne({ key: "default" }).lean();
    if (!row) return { ...DEFAULT_BILLING_SETTINGS, trialModules: { ...DEFAULT_BILLING_SETTINGS.trialModules } };
    return {
      autoTrialOnSignup: Boolean(row.autoTrialOnSignup ?? true),
      defaultTrialDays: Number(row.defaultTrialDays || 14),
      trialModules: {
        assessments: Boolean((row.trialModules as ModuleFlags | undefined)?.assessments ?? true),
        community: Boolean((row.trialModules as ModuleFlags | undefined)?.community ?? true),
      },
    };
  },
  async save(settings: BillingSettings) {
    await BillingSettingsModel.findOneAndUpdate(
      { key: "default" },
      { key: "default", ...settings },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return settings;
  },
};

function mapThread(row: Record<string, unknown>): LocalThread {
  const answers = Array.isArray(row.answers) ? row.answers : [];
  return {
    id: row.id as string,
    authorId: (row.authorId as string) || "",
    authorName: (row.authorName as string) || "",
    title: (row.title as string) || "",
    body: (row.body as string) || "",
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    views: Number(row.views || 0),
    createdAt: new Date((row.createdAt as Date) || Date.now()),
    answers: answers.map((answer) => {
      const item = answer as LocalThread["answers"][number];
      return {
        id: item.id,
        authorId: item.authorId,
        authorName: item.authorName,
        body: item.body,
        createdAt: new Date(item.createdAt),
        upvotes: Number(item.upvotes || 0),
        upvotedBy: Array.isArray(item.upvotedBy) ? item.upvotedBy : [],
      };
    }),
  };
}

export const mongoThreadStore: ThreadStore = {
  async list() {
    const rows = await ThreadModel.find().sort({ createdAt: -1 }).lean();
    return rows.map((row) => mapThread(row as Record<string, unknown>));
  },
  async get(id) {
    const row = await ThreadModel.findOne({ id }).lean();
    return row ? mapThread(row as Record<string, unknown>) : null;
  },
  async create(thread) {
    await ThreadModel.create(thread);
    return thread;
  },
  async addAnswer(id, answer) {
    const row = await ThreadModel.findOneAndUpdate({ id }, { $push: { answers: answer } }, { new: true }).lean();
    return row ? mapThread(row as Record<string, unknown>) : null;
  },
  async incrementViews(id) {
    const row = await ThreadModel.findOneAndUpdate({ id }, { $inc: { views: 1 } }, { new: true }).lean();
    return row ? mapThread(row as Record<string, unknown>) : null;
  },
  async toggleUpvote(threadId, answerId, accountId) {
    const thread = await ThreadModel.findOne({ id: threadId });
    if (!thread) return null;
    const answers = (thread.answers || []) as Array<{
      id: string;
      upvotes?: number;
      upvotedBy?: string[];
    }>;
    const answer = answers.find((item) => item.id === answerId);
    if (!answer) return null;
    const current = Array.isArray(answer.upvotedBy) ? answer.upvotedBy : [];
    const already = current.includes(accountId);
    answer.upvotedBy = already ? current.filter((id) => id !== accountId) : [...current, accountId];
    answer.upvotes = answer.upvotedBy.length;
    await thread.save();
    return mapThread(thread.toObject() as Record<string, unknown>);
  },
};

function mapRun(row: Record<string, unknown>): AssessmentRun {
  return {
    id: row.id as string,
    accountId: row.accountId as string,
    assessmentId: row.assessmentId as string,
    answers: (row.answers as Record<string, unknown>) || {},
    score: Number(row.score || 0),
    createdAt: new Date((row.createdAt as Date) || Date.now()),
  };
}

export const mongoAssessmentRunStore: AssessmentRunStore = {
  async insert(run) {
    await AssessmentRunModel.create(run);
    return run;
  },
  async listByAccount(accountId) {
    const rows = await AssessmentRunModel.find({ accountId }).sort({ createdAt: -1 }).lean();
    return rows.map((row) => mapRun(row as Record<string, unknown>));
  },
  async list() {
    const rows = await AssessmentRunModel.find().sort({ createdAt: -1 }).lean();
    return rows.map((row) => mapRun(row as Record<string, unknown>));
  },
};
