export const GENDER_OPTIONS = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "nonbinary", label: "Non-binary" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export type GenderIdentity = (typeof GENDER_OPTIONS)[number]["id"];

export type IdentityProfile = {
  phone: string | null;
  gender: GenderIdentity | null;
  age: number | null;
  city: string | null;
};

export type ProfilePatch = {
  name?: string;
  email?: string;
} & Partial<IdentityProfile>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CITY_RE = /^[\p{L}\p{M} .'-]{2,80}$/u;
export const MIN_AGE = 13;
export const MAX_AGE = 120;

export const EMPTY_IDENTITY: IdentityProfile = {
  phone: null,
  gender: null,
  age: null,
  city: null,
};

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export function isGenderIdentity(value: string): value is GenderIdentity {
  return GENDER_OPTIONS.some((option) => option.id === value);
}

/** Digits only, 8–15 — covers IN mobiles and most international numbers. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function emptyToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function parseProfilePatch(
  input: Record<string, unknown>,
): { ok: true; value: ProfilePatch } | { ok: false; message: string } {
  const patch: ProfilePatch = {};

  if ("name" in input) {
    if (typeof input.name !== "string") return { ok: false, message: "Enter your name" };
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) return { ok: false, message: "Enter your name" };
    patch.name = name;
  }

  if ("email" in input) {
    if (typeof input.email !== "string") return { ok: false, message: "Enter a valid email" };
    const email = input.email.trim().toLowerCase();
    if (!isEmail(email)) return { ok: false, message: "Enter a valid email" };
    patch.email = email;
  }

  if ("phone" in input) {
    const phone = emptyToNull(input.phone);
    if (phone && !isValidPhone(phone)) {
      return { ok: false, message: "Enter a phone number with 8–15 digits" };
    }
    patch.phone = phone ? normalizePhone(phone) : null;
  }

  if ("gender" in input) {
    const gender = emptyToNull(input.gender);
    if (gender && !isGenderIdentity(gender)) {
      return { ok: false, message: "Choose a gender option" };
    }
    patch.gender = gender && isGenderIdentity(gender) ? gender : null;
  }

  if ("age" in input) {
    if (input.age === null || input.age === "") {
      patch.age = null;
    } else {
      const age = typeof input.age === "number" ? input.age : Number(String(input.age).trim());
      if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
        return { ok: false, message: `Age must be between ${MIN_AGE} and ${MAX_AGE}` };
      }
      patch.age = age;
    }
  }

  if ("city" in input) {
    const city = emptyToNull(input.city);
    if (city && !CITY_RE.test(city)) {
      return { ok: false, message: "Enter a city name (letters, spaces, hyphens)" };
    }
    patch.city = city;
  }

  return { ok: true, value: patch };
}

export function identityFrom(account: Partial<IdentityProfile> | null | undefined): IdentityProfile {
  const gender = account?.gender;
  return {
    phone: account?.phone ?? null,
    gender: gender && isGenderIdentity(gender) ? gender : null,
    age: typeof account?.age === "number" && Number.isFinite(account.age) ? account.age : null,
    city: account?.city ?? null,
  };
}
