import { describe, expect, it } from "vitest";
import { isEmail, parseProfilePatch } from "./profile";

describe("parseProfilePatch", () => {
  it("accepts identity fields with signup-style email", () => {
    const parsed = parseProfilePatch({
      name: "Asha Rao",
      email: "asha@lokutara.test",
      phone: "+91 98765 43210",
      gender: "woman",
      age: 29,
      city: "Bengaluru",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.email).toBe("asha@lokutara.test");
    expect(parsed.value.phone).toBe("+919876543210");
    expect(parsed.value.gender).toBe("woman");
    expect(parsed.value.age).toBe(29);
    expect(parsed.value.city).toBe("Bengaluru");
  });

  it("rejects invalid email, short phone, and out-of-range age", () => {
    expect(parseProfilePatch({ email: "not-an-email" }).ok).toBe(false);
    expect(parseProfilePatch({ phone: "123" }).ok).toBe(false);
    expect(parseProfilePatch({ age: 9 }).ok).toBe(false);
    expect(parseProfilePatch({ age: 200 }).ok).toBe(false);
    expect(parseProfilePatch({ gender: "unknown" }).ok).toBe(false);
    expect(parseProfilePatch({ city: "x" }).ok).toBe(false);
  });

  it("clears optional identity fields when blank", () => {
    const parsed = parseProfilePatch({ phone: "  ", gender: "", age: "", city: "" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual({ phone: null, gender: null, age: null, city: null });
  });

  it("shares the same email rule as signup", () => {
    expect(isEmail("asha@lokutara.test")).toBe(true);
    expect(isEmail("nope")).toBe(false);
  });
});
