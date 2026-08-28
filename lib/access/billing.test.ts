import { describe, expect, it } from "vitest";
import { addDays, canPostCommunityAnswer, canUseModule, communityRoleOf, presentAccount, resolveAccess, type AccountRecord } from "./billing";

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: "acc_1",
    email: "a@lokutara.test",
    name: "Asha",
    passwordHash: "x",
    plan: "none",
    trialEndsAt: null,
    modules: { assessments: false, community: false },
    seats: 1,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    phone: null,
    gender: null,
    age: null,
    city: null,
    ...overrides,
  };
}

describe("resolveAccess", () => {
  it("opens the app during an active trial", () => {
    const now = new Date("2026-08-10T00:00:00.000Z");
    const access = resolveAccess(
      account({
        plan: "trial",
        trialEndsAt: addDays(now, 5),
        modules: { assessments: true, community: true },
      }),
      now,
    );
    expect(access.status).toBe("trial");
    expect(access.canEnterApp).toBe(true);
    expect(canUseModule(access, "assessments")).toBe(true);
  });

  it("closes the paywall when a trial has ended", () => {
    const now = new Date("2026-08-20T00:00:00.000Z");
    const access = resolveAccess(
      account({
        plan: "trial",
        trialEndsAt: new Date("2026-08-10T00:00:00.000Z"),
        modules: { assessments: true, community: true },
      }),
      now,
    );
    expect(access.status).toBe("expired");
    expect(access.canEnterApp).toBe(false);
    expect(canUseModule(access, "community")).toBe(false);
  });

  it("keeps paid modules open without a trial clock", () => {
    const access = resolveAccess(
      account({ plan: "paid", modules: { assessments: true, community: false } }),
    );
    expect(access.status).toBe("paid");
    expect(canUseModule(access, "assessments")).toBe(true);
    expect(canUseModule(access, "community")).toBe(false);
  });
});

describe("community roles", () => {
  it("defaults missing roles to student and only lets specialists and admins answer", () => {
    expect(communityRoleOf(account())).toBe("student");
    expect(canPostCommunityAnswer("student")).toBe(false);
    expect(canPostCommunityAnswer("specialist")).toBe(true);
    expect(canPostCommunityAnswer("admin")).toBe(true);
    expect(presentAccount(account()).communityRole).toBe("student");
    expect(presentAccount(account({ communityRole: "specialist" })).communityRole).toBe("specialist");
  });
});

describe("presentAccount identity", () => {
  it("exposes psychometric identity fields collected on the profile", () => {
    const presented = presentAccount(
      account({
        phone: "+919876543210",
        gender: "woman",
        age: 29,
        city: "Bengaluru",
      }),
    );
    expect(presented.phone).toBe("+919876543210");
    expect(presented.gender).toBe("woman");
    expect(presented.age).toBe(29);
    expect(presented.city).toBe("Bengaluru");
    expect(presented.email).toBe("a@lokutara.test");
  });
});
