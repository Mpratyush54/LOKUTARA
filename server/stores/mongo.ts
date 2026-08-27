import mongoose from "mongoose";
import type { StoredAnalyticsEvent } from "../../lib/tracking/events";
import type {
  EventStore,
  ExperimentConfigStore,
  LeadStore,
  SessionStore,
  StoredExperimentConfig,
  StoredLead,
  StoredSession,
  StoredVisitor,
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

export const EventModel = mongoose.models.Event || mongoose.model("Event", EventSchema);
export const LeadModel = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
export const VisitorModel = mongoose.models.Visitor || mongoose.model("Visitor", VisitorSchema);
export const SessionModel = mongoose.models.Session || mongoose.model("Session", SessionSchema);
export const ExperimentConfigModel =
  mongoose.models.ExperimentConfig || mongoose.model("ExperimentConfig", ExperimentConfigSchema);

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
