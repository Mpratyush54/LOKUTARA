export const LEAD_TYPES = ["discovery", "counselling", "popup", "demo"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const SIZE_BANDS = ["1-49", "50-500", "501-2000", "2000+"] as const;
export type SizeBand = (typeof SIZE_BANDS)[number];

export type LeadInput = {
  type: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  organisation?: string;
  sizeBand?: string;
  preferredTime?: string;
};

export type ValidLead = {
  type: LeadType;
  name: string;
  email: string;
  phone: string;
  role: string | null;
  organisation: string | null;
  sizeBand: SizeBand | null;
  preferredTime: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLead(input: LeadInput): { ok: true; value: ValidLead } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!LEAD_TYPES.includes(input.type as LeadType)) errors.push("type is invalid");
  const name = (input.name || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  const phone = (input.phone || "").trim();
  if (name.length < 2) errors.push("name is required");
  if (!EMAIL_RE.test(email)) errors.push("email is invalid");
  if (phone.length < 8) errors.push("phone is required");

  let sizeBand: SizeBand | null = null;
  if (input.sizeBand) {
    if ((SIZE_BANDS as readonly string[]).includes(input.sizeBand)) sizeBand = input.sizeBand as SizeBand;
    else errors.push("sizeBand is invalid");
  }

  if (input.type === "discovery" || input.type === "demo") {
    if (!(input.organisation || "").trim()) errors.push("organisation is required");
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      type: input.type as LeadType,
      name,
      email,
      phone,
      role: emptyToNull(input.role),
      organisation: emptyToNull(input.organisation),
      sizeBand,
      preferredTime: emptyToNull(input.preferredTime),
    },
  };
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = (value || "").trim();
  return trimmed.length ? trimmed : null;
}
