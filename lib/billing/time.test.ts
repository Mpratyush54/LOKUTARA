import { describe, expect, it } from "vitest";
import {
  inRange,
  istYmd,
  startOfIstDay,
  startOfIstMonth,
  startOfNextIstMonth,
  startOfPreviousIstMonth,
} from "./time";

describe("IST calendar bounds", () => {
  it("maps late-UTC hours onto the next IST date", () => {
    expect(istYmd(new Date("2026-08-31T18:40:00.000Z"))).toBe("2026-09-01");
    expect(istYmd(new Date("2026-08-31T18:20:00.000Z"))).toBe("2026-08-31");
  });

  it("opens August 2026 at IST midnight", () => {
    const now = new Date("2026-08-15T08:00:00.000Z");
    const start = startOfIstMonth(now);
    const next = startOfNextIstMonth(now);
    const prev = startOfPreviousIstMonth(now);
    expect(istYmd(start)).toBe("2026-08-01");
    expect(istYmd(next)).toBe("2026-09-01");
    expect(istYmd(prev)).toBe("2026-07-01");
    expect(inRange(new Date("2026-07-31T18:31:00.000Z"), start, next)).toBe(true);
    expect(inRange(new Date("2026-07-31T18:20:00.000Z"), start, next)).toBe(false);
  });

  it("starts the IST day 5.5 hours before UTC midnight of that date", () => {
    const day = startOfIstDay(new Date("2026-08-31T12:00:00.000Z"));
    expect(day.toISOString()).toBe("2026-08-30T18:30:00.000Z");
  });
});
