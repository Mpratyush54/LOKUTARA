import { describe, expect, it } from "vitest";
import { createSessionId, createVisitorId, resolveSessionId, resolveVisitorId } from "./identity";

describe("identity", () => {
  it("creates prefixed ids", () => {
    expect(createVisitorId(() => "abcdefghij")).toMatch(/^v_/);
    expect(createSessionId(() => "abcdefghij")).toMatch(/^s_/);
  });

  it("reuses a valid visitor id", () => {
    const existing = "v_abcdefghijklmnop";
    expect(resolveVisitorId(existing)).toEqual({ id: existing, isNew: false });
    expect(resolveVisitorId("bad").isNew).toBe(true);
  });

  it("rotates session after idle ttl", () => {
    const sid = "s_abcdefghijklmnop";
    const now = 1_000_000;
    expect(resolveSessionId(sid, now - 1000, now).isNew).toBe(false);
    expect(resolveSessionId(sid, now - 31 * 60 * 1000, now).isNew).toBe(true);
  });
});
