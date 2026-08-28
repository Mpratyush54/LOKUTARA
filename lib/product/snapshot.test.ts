import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProductSnapshot } from "./snapshot";

describe("loadProductSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns catalog and honest empty community when APIs are unset", async () => {
    const snapshot = await loadProductSnapshot({ testsApiUrl: null, forumApiUrl: null });
    expect(snapshot.assessments.status).toBe("unset");
    expect(snapshot.assessments.items).toHaveLength(4);
    expect(snapshot.community.status).toBe("unset");
    expect(snapshot.community.threads).toEqual([]);
    expect(snapshot.community.message).toMatch(/same site/i);
  });

  it("maps live forum threads when the community API answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (String(input).includes("/api/questions")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              questions: [
                {
                  id: "q1",
                  title: "How do we brief managers?",
                  description: "After the workshop.",
                  tags: ["managers"],
                  answerCount: 2,
                  createdAt: "2026-08-01T00:00:00.000Z",
                },
              ],
            }),
          };
        }
        return { ok: false, status: 500, json: async () => ({}) };
      }),
    );

    const snapshot = await loadProductSnapshot({
      testsApiUrl: "http://tests.test",
      forumApiUrl: "http://forum.test",
    });
    expect(snapshot.community.status).toBe("online");
    expect(snapshot.community.threads[0]?.title).toBe("How do we brief managers?");
    expect(snapshot.assessments.status).toBe("offline");
  });
});
