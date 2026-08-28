import type { GenderIdentity, IdentityProfile } from "./profile";
import { EMPTY_IDENTITY, identityFrom } from "./profile";

export const PRODUCT_MODULES = ["assessments", "community"] as const;
export type ProductModule = (typeof PRODUCT_MODULES)[number];

export type Plan = "none" | "trial" | "paid";

export type CommunityRole = "student" | "specialist" | "admin";

export type ModuleFlags = Record<ProductModule, boolean>;

export type BillingSettings = {
  autoTrialOnSignup: boolean;
  defaultTrialDays: number;
  trialModules: ModuleFlags;
};

export type AccountRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  plan: Plan;
  trialEndsAt: Date | null;
  modules: ModuleFlags;
  seats: number;
  createdAt: Date;
  communityRole?: CommunityRole;
} & IdentityProfile;

export type AccessStatus = "none" | "trial" | "paid" | "expired";

export type AccessSnapshot = {
  status: AccessStatus;
  plan: Plan;
  trialEndsAt: string | null;
  daysLeft: number | null;
  modules: ModuleFlags;
  canEnterApp: boolean;
};

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  autoTrialOnSignup: true,
  defaultTrialDays: 14,
  trialModules: { assessments: true, community: true },
};

export const ALL_MODULES_OFF: ModuleFlags = { assessments: false, community: false };
export const ALL_MODULES_ON: ModuleFlags = { assessments: true, community: true };

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function resolveAccess(account: AccountRecord, now = new Date()): AccessSnapshot {
  if (account.plan === "paid") {
    return {
      status: "paid",
      plan: "paid",
      trialEndsAt: account.trialEndsAt ? account.trialEndsAt.toISOString() : null,
      daysLeft: null,
      modules: { ...account.modules },
      canEnterApp: account.modules.assessments || account.modules.community,
    };
  }

  if (account.plan === "trial" && account.trialEndsAt && account.trialEndsAt.getTime() > now.getTime()) {
    const daysLeft = Math.max(1, Math.ceil((account.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    return {
      status: "trial",
      plan: "trial",
      trialEndsAt: account.trialEndsAt.toISOString(),
      daysLeft,
      modules: { ...account.modules },
      canEnterApp: account.modules.assessments || account.modules.community,
    };
  }

  if (account.plan === "trial") {
    return {
      status: "expired",
      plan: "trial",
      trialEndsAt: account.trialEndsAt ? account.trialEndsAt.toISOString() : null,
      daysLeft: 0,
      modules: { ...ALL_MODULES_OFF },
      canEnterApp: false,
    };
  }

  return {
    status: "none",
    plan: "none",
    trialEndsAt: null,
    daysLeft: null,
    modules: { ...ALL_MODULES_OFF },
    canEnterApp: false,
  };
}

export function canUseModule(access: AccessSnapshot, module: ProductModule): boolean {
  return access.canEnterApp && access.modules[module];
}

export function communityRoleOf(account: Pick<AccountRecord, "communityRole"> | null | undefined): CommunityRole {
  const role = account?.communityRole;
  if (role === "specialist" || role === "admin") return role;
  return "student";
}

export function canPostCommunityAnswer(role: CommunityRole): boolean {
  return role === "specialist" || role === "admin";
}

export function presentAccount(account: AccountRecord, now = new Date()) {
  const access = resolveAccess(account, now);
  const communityRole = communityRoleOf(account);
  const identity = identityFrom(account);
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    seats: account.seats,
    createdAt: account.createdAt.toISOString(),
    access,
    communityRole,
    phone: identity.phone,
    gender: identity.gender,
    age: identity.age,
    city: identity.city,
  };
}

export function applyProfilePatch(
  account: AccountRecord,
  patch: Partial<Pick<AccountRecord, "name" | "email" | "phone" | "gender" | "age" | "city">>,
): AccountRecord {
  return {
    ...account,
    ...EMPTY_IDENTITY,
    ...identityFrom(account),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
    ...(patch.age !== undefined ? { age: patch.age } : {}),
    ...(patch.city !== undefined ? { city: patch.city } : {}),
  };
}

export type { GenderIdentity, IdentityProfile };
