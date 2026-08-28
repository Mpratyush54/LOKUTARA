import { describe, expect, it } from "vitest";
import { ASSESSMENTS, COMMUNITY } from "./catalog";

describe("product catalog", () => {
  it("lists assessments as in-product tools, not licensed psychometrics", () => {
    expect(ASSESSMENTS.map((item) => item.id)).toEqual(["psychology", "placement", "ocean", "riasec"]);
    expect(ASSESSMENTS.some((item) => item.copy.toLowerCase().includes("licensed psychometric"))).toBe(true);
  });

  it("describes the forum as the same product", () => {
    expect(COMMUNITY.title.toLowerCase()).toContain("forum");
    expect(COMMUNITY.empty.toLowerCase()).toContain("separate");
  });
});
