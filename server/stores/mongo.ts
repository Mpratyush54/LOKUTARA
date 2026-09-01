import mongoose from "mongoose";
import type { StoredAnalyticsEvent } from "../../lib/tracking/events";
import type { AccountRecord, BillingSettings, ModuleFlags, Plan } from "../../lib/access/billing";
import { DEFAULT_BILLING_SETTINGS } from "../../lib/access/billing";
import type { Invoice } from "../../lib/billing/invoices";
import { EMPTY_IDENTITY, identityFrom, isGenderIdentity } from "../../lib/access/profile";
import type { LocalThread, TraitScore } from "../../lib/product/workspace";
import type {
  AccountStore,
  AppSession,
  AppSessionStore,
  AssessmentRun,
  AssessmentRunStore,
  BillingSettingsStore,
  EventStore,
  ExperimentConfigStore,
  InvoiceStore,
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
    at: Date,
  },
  { collection: "events" },
);
EventSchema.index({ visitorId: 1, at: -1 });
EventSchema.index({ name: 1, at: -1 });
EventSchema.index({ at: 1 }, { expireAfterSeconds: 395 * 24 * 60 * 60 });

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
    consentedAt: Date,
    adultConfirmedAt: Date,
    privacyNoticeVersion: String,
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "leads" },
);
LeadSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const VisitorSchema = new mongoose.Schema(
  {
    visitorId: { type: String, unique: true },
    firstTouch: Object,
    lastTouch: Object,
    firstSeenAt: Date,
    lastSeenAt: Date,
    userId: { type: String, index: true, sparse: true },
  },
  { collection: "visitors" },
);
VisitorSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 395 * 24 * 60 * 60 });

const SessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, unique: true },
    visitorId: { type: String, index: true },
    startedAt: Date,
    lastSeenAt: Date,
    landingPage: String,
    device: String,
    eventCount: { type: Number, default: 1 },
  },
  { collection: "sessions" },
);
SessionSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 395 * 24 * 60 * 60 });

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
    phone: String,
    age: Number,
    city: String,
    organisation: String,
    passwordHash: String,
    plan: { type: String, index: true },
    trialEndsAt: Date,
    modules: {
      assessments: { type: Boolean, default: false },
      community: { type: Boolean, default: false },
    },
    seats: { type: Number, default: 1 },
    communityRole: { type: String, enum: ["student", "specialist", "admin"], default: "student" },
    gender: { type: String, default: null },
    termsAcceptedAt: Date,
    privacyNoticeVersion: String,
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
AppSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const BillingSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "default" },
    autoTrialOnSignup: { type: Boolean, default: true },
    defaultTrialDays: { type: Number, default: 14 },
    trialModules: {
      assessments: { type: Boolean, default: true },
      community: { type: Boolean, default: true },
    },
    legalName: { type: String, default: "Lokutara" },
    gstin: { type: String, default: "" },
    address: { type: String, default: "" },
    gstRate: { type: Number, default: 18 },
  },
  { collection: "billing_settings" },
);

const InvoiceSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, index: true },
    number: { type: String, unique: true, index: true },
    accountId: { type: String, index: true, sparse: true },
    customerName: String,
    customerEmail: { type: String, index: true },
    customerPhone: String,
    organisation: String,
    sku: String,
    label: String,
    qty: { type: Number, default: 1 },
    unitAmountPaise: Number,
    gstRate: { type: Number, default: 18 },
    subtotalPaise: Number,
    gstPaise: Number,
    totalPaise: Number,
    currency: { type: String, default: "INR" },
    status: { type: String, index: true },
    issuedAt: Date,
    dueAt: Date,
    paidAt: { type: Date, index: true },
    grantAccessOnPay: { type: Boolean, default: false },
    kind: { type: String, enum: ["sale", "complimentary"], default: "sale", index: true },
    razorpayPaymentLinkId: { type: String, index: true, sparse: true },
    paymentUrl: String,
    razorpayPaymentId: String,
    notes: String,
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "invoices" },
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
    consentedAt: Date,
    noticeVersion: String,
    traits: [
      {
        id: String,
        label: String,
        score: Number,
        max: Number,
        note: String,
      },
    ],
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "app_assessment_runs" },
);

type LooseMongoModel = mongoose.Model<Record<string, unknown>>;

export const EventModel = (mongoose.models.Event || mongoose.model("Event", EventSchema)) as LooseMongoModel;
export const LeadModel = (mongoose.models.Lead || mongoose.model("Lead", LeadSchema)) as LooseMongoModel;
export const VisitorModel = (mongoose.models.Visitor || mongoose.model("Visitor", VisitorSchema)) as LooseMongoModel;
export const SessionModel = (mongoose.models.Session || mongoose.model("Session", SessionSchema)) as LooseMongoModel;
export const ExperimentConfigModel = (
  mongoose.models.ExperimentConfig || mongoose.model("ExperimentConfig", ExperimentConfigSchema)
) as LooseMongoModel;
export const AccountModel = (mongoose.models.AppAccount || mongoose.model("AppAccount", AccountSchema)) as LooseMongoModel;
export const AppSessionModel = (
  mongoose.models.AppSession || mongoose.model("AppSession", AppSessionSchema)
) as LooseMongoModel;
export const BillingSettingsModel = (
  mongoose.models.BillingSettings || mongoose.model("BillingSettings", BillingSettingsSchema)
) as LooseMongoModel;
export const ThreadModel = (mongoose.models.AppThread || mongoose.model("AppThread", ThreadSchema)) as LooseMongoModel;
export const AssessmentRunModel = (
  mongoose.models.AppAssessmentRun || mongoose.model("AppAssessmentRun", AssessmentRunSchema)
) as LooseMongoModel;
export const InvoiceModel = (mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema)) as LooseMongoModel;

export async function connectMongo(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
}

export async function ensureMongoIndexes(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;
  await migrateTtlIndex(EventModel, "at", 395 * 24 * 60 * 60);
  await migrateTtlIndex(LeadModel, "createdAt", 365 * 24 * 60 * 60);
  await migrateTtlIndex(VisitorModel, "lastSeenAt", 395 * 24 * 60 * 60);
  await migrateTtlIndex(SessionModel, "lastSeenAt", 395 * 24 * 60 * 60);
  await migrateTtlIndex(AppSessionModel, "createdAt", 30 * 24 * 60 * 60);
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
    InvoiceModel.syncIndexes(),
  ]);
}

async function migrateTtlIndex(
  model: LooseMongoModel,
  field: string,
  expireAfterSeconds: number,
): Promise<void> {
  let indexes: Awaited<ReturnType<typeof model.collection.indexes>>;
  try {
    indexes = await model.collection.indexes();
  } catch (error) {
    if (mongoErrorCode(error) === 26) return;
    throw error;
  }

  const existing = indexes.find((index) => {
    const key = index.key as Record<string, unknown> | undefined;
    return key && Object.keys(key).length === 1 && key[field] === 1;
  });
  if (!existing || Number(existing.expireAfterSeconds) === expireAfterSeconds) return;
  if (!existing.name || existing.name === "_id_") return;

  try {
    await model.collection.dropIndex(existing.name);
  } catch (error) {
    if (mongoErrorCode(error) !== 27) throw error;
  }
}

function mongoErrorCode(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = Number((error as { code?: unknown }).code);
  return Number.isFinite(code) ? code : null;
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
    })) as unknown as StoredAnalyticsEvent[];
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
      consentedAt: new Date((row.consentedAt as Date) || row.createdAt || Date.now()),
      adultConfirmedAt: new Date((row.adultConfirmedAt as Date) || row.createdAt || Date.now()),
      privacyNoticeVersion: (row.privacyNoticeVersion as string) || "legacy",
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
  const identity = identityFrom({
    phone: (row.phone as string | null) ?? null,
    gender: isGenderIdentity(String(row.gender || "")) ? (row.gender as AccountRecord["gender"]) : null,
    age: typeof row.age === "number" ? row.age : null,
    city: (row.city as string | null) ?? null,
  });
  return {
    id: row.id as string,
    email: row.email as string,
    name: (row.name as string) || "",
    phone: (row.phone as string | null) ?? null,
    age: typeof row.age === "number" && Number.isFinite(row.age) ? row.age : null,
    city: (row.city as string | null) ?? null,
    organisation: (row.organisation as string | null) ?? null,
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
    termsAcceptedAt: row.termsAcceptedAt ? new Date(row.termsAcceptedAt as Date) : null,
    privacyNoticeVersion: (row.privacyNoticeVersion as string | null) ?? null,
    createdAt: new Date((row.createdAt as Date) || Date.now()),
    ...EMPTY_IDENTITY,
    ...identity,
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
  async delete(id) {
    await AccountModel.deleteOne({ id });
  },
};

export const mongoAppSessionStore: AppSessionStore = {
  async create(session: AppSession) {
    await AppSessionModel.create(session);
  },
  async get(token: string) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const row = await AppSessionModel.findOne({ token, createdAt: { $gt: cutoff } }).lean();
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
  async deleteByAccount(accountId: string) {
    await AppSessionModel.deleteMany({ accountId });
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
      legalName: typeof row.legalName === "string" && row.legalName.trim() ? row.legalName : DEFAULT_BILLING_SETTINGS.legalName,
      gstin: typeof row.gstin === "string" ? row.gstin : "",
      address: typeof row.address === "string" ? row.address : "",
      gstRate: Number.isFinite(Number(row.gstRate)) ? Number(row.gstRate) : DEFAULT_BILLING_SETTINGS.gstRate,
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
  async anonymizeByAccount(accountId) {
    await ThreadModel.updateMany(
      { authorId: accountId },
      { $set: { authorId: "deleted", authorName: "Former member" } },
    );
    const rows = await ThreadModel.find({
      $or: [{ "answers.authorId": accountId }, { "answers.upvotedBy": accountId }],
    });
    for (const row of rows) {
      const answers = (row.answers || []) as Array<{
        authorId: string;
        authorName: string;
        upvotedBy: string[];
        upvotes: number;
      }>;
      for (const answer of answers) {
        if (answer.authorId === accountId) {
          answer.authorId = "deleted";
          answer.authorName = "Former member";
        }
        answer.upvotedBy = (answer.upvotedBy || []).filter((id) => id !== accountId);
        answer.upvotes = answer.upvotedBy.length;
      }
      await row.save();
    }
  },
};

function mapRun(row: Record<string, unknown>): AssessmentRun {
  const traits = Array.isArray(row.traits) ? (row.traits as TraitScore[]) : [];
  return {
    id: row.id as string,
    accountId: row.accountId as string,
    assessmentId: row.assessmentId as string,
    answers: (row.answers as Record<string, unknown>) || {},
    score: Number(row.score || 0),
    consentedAt: new Date((row.consentedAt as Date) || row.createdAt || Date.now()),
    noticeVersion: (row.noticeVersion as string) || "legacy",
    traits: traits.map((trait) => ({
      id: String(trait.id || ""),
      label: String(trait.label || ""),
      score: Number(trait.score || 0),
      max: Number(trait.max || 100),
      note: String(trait.note || ""),
    })),
    createdAt: new Date((row.createdAt as Date) || Date.now()),
  };
}

export const mongoAssessmentRunStore: AssessmentRunStore = {
  async insert(run) {
    await AssessmentRunModel.create(run);
    return run;
  },
  async get(id) {
    const row = await AssessmentRunModel.findOne({ id }).lean();
    return row ? mapRun(row as Record<string, unknown>) : null;
  },
  async listByAccount(accountId) {
    const rows = await AssessmentRunModel.find({ accountId }).sort({ createdAt: -1 }).lean();
    return rows.map((row) => mapRun(row as Record<string, unknown>));
  },
  async list() {
    const rows = await AssessmentRunModel.find().sort({ createdAt: -1 }).lean();
    return rows.map((row) => mapRun(row as Record<string, unknown>));
  },
  async deleteByAccount(accountId) {
    await AssessmentRunModel.deleteMany({ accountId });
  },
};

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    number: row.number as string,
    accountId: (row.accountId as string) || null,
    customerName: (row.customerName as string) || "",
    customerEmail: (row.customerEmail as string) || "",
    customerPhone: (row.customerPhone as string) || null,
    organisation: (row.organisation as string) || null,
    sku: row.sku as Invoice["sku"],
    label: (row.label as string) || "",
    qty: Number(row.qty || 1),
    unitAmountPaise: Number(row.unitAmountPaise || 0),
    gstRate: Number(row.gstRate || 18),
    subtotalPaise: Number(row.subtotalPaise || 0),
    gstPaise: Number(row.gstPaise || 0),
    totalPaise: Number(row.totalPaise || 0),
    currency: "INR",
    status: (row.status as Invoice["status"]) || "draft",
    issuedAt: row.issuedAt ? new Date(row.issuedAt as Date) : null,
    dueAt: row.dueAt ? new Date(row.dueAt as Date) : null,
    paidAt: row.paidAt ? new Date(row.paidAt as Date) : null,
    grantAccessOnPay: Boolean(row.grantAccessOnPay),
    kind: row.kind === "complimentary" ? "complimentary" : "sale",
    razorpayPaymentLinkId: (row.razorpayPaymentLinkId as string) || null,
    paymentUrl: (row.paymentUrl as string) || null,
    razorpayPaymentId: (row.razorpayPaymentId as string) || null,
    notes: (row.notes as string) || null,
    createdAt: new Date((row.createdAt as Date) || Date.now()),
  };
}

export const mongoInvoiceStore: InvoiceStore = {
  async list() {
    const rows = await InvoiceModel.find().sort({ createdAt: -1 }).lean();
    return rows.map((row) => mapInvoice(row as Record<string, unknown>));
  },
  async get(id) {
    const row = await InvoiceModel.findOne({ id }).lean();
    return row ? mapInvoice(row as Record<string, unknown>) : null;
  },
  async getByPaymentLinkId(linkId) {
    const row = await InvoiceModel.findOne({ razorpayPaymentLinkId: linkId }).lean();
    return row ? mapInvoice(row as Record<string, unknown>) : null;
  },
  async insert(invoice) {
    await InvoiceModel.create(invoice);
    return invoice;
  },
  async update(invoice) {
    await InvoiceModel.findOneAndUpdate({ id: invoice.id }, invoice, { upsert: true, new: true });
    return invoice;
  },
};
