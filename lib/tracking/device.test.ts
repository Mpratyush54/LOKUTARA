import { describe, expect, it } from "vitest";
import { parseUserAgent } from "./device";

describe("parseUserAgent", () => {
  it("detects desktop Chrome on Windows", () => {
    expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0")).toMatchObject({
      device: "desktop",
      browser: "Chrome",
      os: "Windows",
    });
  });

  it("detects mobile Safari", () => {
    expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toMatchObject({
      device: "mobile",
      os: "iOS",
    });
  });
});
