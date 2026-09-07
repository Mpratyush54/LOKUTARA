import { describe, expect, it } from "vitest";
import { normalizePromoCode, promoDiscountPaise, validatePromo, type Promo } from "./promos";

function promo(overrides: Partial<Promo> = {}): Promo {
  return {
    id: "promo_1",
    code: "WELCOME10",
    kind: "percent",
    value: 10,
    maxDiscountRupees: null,
    maxUses: null,
    usedCount: 0,
    firstTimeOnly: true,
    active: true,
    expiresAt: null,
    note: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("promos", () => {
  it("normalizes codes to uppercase alphanumerics", () => {
    expect(normalizePromoCode(" welcome-10 ")).toBe("WELCOME-10");
    expect(normalizePromoCode("off@50%")).toBe("OFF50");
    expect(normalizePromoCode(null)).toBe("");
  });

  it("computes percent and flat discounts capped at the subtotal", () => {
    expect(promoDiscountPaise(promo({ kind: "percent", value: 10 }), 2_500_000)).toBe(250_000);
    expect(promoDiscountPaise(promo({ kind: "flat", value: 500 }), 2_500_000)).toBe(50_000);
    expect(promoDiscountPaise(promo({ kind: "flat", value: 50_000 }), 2_500_000)).toBe(2_500_000);
  });

  it("caps percent discounts at the max amount", () => {
    expect(promoDiscountPaise(promo({ kind: "percent", value: 20, maxDiscountRupees: 500 }), 2_500_000)).toBe(50_000);
    expect(promoDiscountPaise(promo({ kind: "percent", value: 20, maxDiscountRupees: 5000 }), 2_500_000)).toBe(500_000);
  });

  it("rejects inactive, expired, exhausted, and repeat-use codes", () => {
    expect(validatePromo(promo({ active: false }), { isFirstTime: true }).ok).toBe(false);
    expect(validatePromo(promo({ expiresAt: new Date("2026-01-01T00:00:00.000Z") }), { isFirstTime: true }).ok).toBe(false);
    expect(validatePromo(promo({ maxUses: 1, usedCount: 1 }), { isFirstTime: true }).ok).toBe(false);
    expect(validatePromo(promo({ firstTimeOnly: true }), { isFirstTime: false }).ok).toBe(false);
    expect(validatePromo(promo(), { isFirstTime: true })).toEqual({ ok: true });
  });
});
