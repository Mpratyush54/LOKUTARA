export type PromoKind = "percent" | "flat";

export type Promo = {
  id: string;
  code: string;
  kind: PromoKind;
  /** Percent 1–100, or flat rupees. */
  value: number;
  /** Percent promos stop here (rupees). Null = no cap. */
  maxDiscountRupees: number | null;
  maxUses: number | null;
  usedCount: number;
  firstTimeOnly: boolean;
  active: boolean;
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
};

export function normalizePromoCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") : "";
}

export function validatePromo(
  promo: Promo,
  input: { isFirstTime: boolean; now?: Date },
): { ok: true } | { ok: false; error: string } {
  const now = input.now ?? new Date();
  if (!promo.active) return { ok: false, error: "This code is no longer active" };
  if (promo.expiresAt && promo.expiresAt.getTime() < now.getTime()) {
    return { ok: false, error: "This code has expired" };
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { ok: false, error: "This code has reached its usage limit" };
  }
  if (promo.firstTimeOnly && !input.isFirstTime) {
    return { ok: false, error: "This code is for first-time buyers only" };
  }
  return { ok: true };
}

/** Discount in paise, capped at the subtotal and at the promo's max (percent promos). */
export function promoDiscountPaise(promo: Promo, subtotalPaise: number): number {
  const subtotal = Math.max(0, Math.round(subtotalPaise));
  if (subtotal <= 0) return 0;
  let discount: number;
  if (promo.kind === "percent") {
    const pct = Math.max(0, Math.min(100, promo.value));
    discount = Math.floor((subtotal * pct) / 100);
    if (promo.maxDiscountRupees != null) {
      discount = Math.min(discount, Math.max(0, Math.round(promo.maxDiscountRupees * 100)));
    }
  } else {
    discount = Math.max(0, Math.round(promo.value * 100));
  }
  return Math.min(subtotal, discount);
}

export function presentPromo(promo: Promo) {
  const cap = promo.kind === "percent" && promo.maxDiscountRupees != null ? ` up to Rs ${promo.maxDiscountRupees}` : "";
  return {
    ...promo,
    expiresAt: promo.expiresAt?.toISOString() ?? null,
    createdAt: promo.createdAt.toISOString(),
    valueLabel: promo.kind === "percent" ? `${promo.value}% off${cap}` : `Rs ${promo.value} off`,
  };
}
