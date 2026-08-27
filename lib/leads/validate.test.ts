import { describe, expect, it } from "vitest";
import { validateLead } from "./validate";

describe("validateLead", () => {
  it("accepts a discovery lead", () => {
    const result = validateLead({
      type: "discovery",
      name: "Priya Shah",
      email: "priya@startup.test",
      phone: "9876543210",
      organisation: "Northstar",
      sizeBand: "50-500",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe("priya@startup.test");
  });

  it("rejects counselling without contact fields", () => {
    const result = validateLead({ type: "counselling", name: "A" });
    expect(result.ok).toBe(false);
  });

  it("does not require organisation for counselling", () => {
    const result = validateLead({
      type: "counselling",
      name: "Arun Mehta",
      email: "arun@mail.test",
      phone: "9876543210",
      preferredTime: "Wed 2pm",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a guide lead without organisation", () => {
    const result = validateLead({
      type: "guide",
      name: "Priya Shah",
      email: "priya@startup.test",
      phone: "9876543210",
      sizeBand: "50-500",
      role: "who=c;notice=b;affected=b;success=b",
      preferredTime: "training",
    });
    expect(result.ok).toBe(true);
  });
});
