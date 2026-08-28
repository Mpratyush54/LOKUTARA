/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CommunityExplore, CommunityRules, ThreadDetail } from "./CommunityModule";

vi.mock("next/link", () => ({
  default({ href, children, ...props }: { href: string; children: React.ReactNode }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock("./AppShell", async () => {
  const actual = await vi.importActual<typeof import("./AppShell")>("./AppShell");
  return {
    ...actual,
    useAppAccount: () => ({
      id: "acc_1",
      email: "asha@lokutara.test",
      name: "Asha",
      seats: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
      communityRole: "student",
      access: {
        status: "trial",
        plan: "trial",
        trialEndsAt: null,
        daysLeft: 12,
        modules: { assessments: true, community: true },
        canEnterApp: true,
      },
    }),
    jsonFetch: (...args: Parameters<typeof actual.jsonFetch>) => actual.jsonFetch(...args),
  };
});

describe("CommunityRules", () => {
  it("lists who can and cannot answer", () => {
    render(<CommunityRules role="student" />);
    expect(screen.getByRole("heading", { name: "Who can reply" })).toBeInTheDocument();
    expect(screen.getByText("Students")).toBeInTheDocument();
    expect(screen.getByText("Specialists")).toBeInTheDocument();
    expect(screen.getByText("Admins")).toBeInTheDocument();
    expect(screen.getAllByText("Cannot answer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Can answer").length).toBeGreaterThan(0);
    expect(screen.getByText(/your role/i)).toBeInTheDocument();
  });
});

describe("CommunityExplore", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows reply rules on the explore feed", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        threads: [],
        replyPolicy: {
          role: "student",
          canReply: false,
          rules: [
            { who: "Students", canReply: false, detail: "Ask only" },
            { who: "Specialists", canReply: true, detail: "Answer" },
            { who: "Admins", canReply: true, detail: "Answer" },
          ],
        },
      }),
    } as Response);
    render(<CommunityExplore />);
    expect(await screen.findByRole("heading", { name: "Who can reply" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Explore" })).toBeInTheDocument();
  });
});

describe("ThreadDetail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("locks the reply composer for students and aligns answers in cards", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/auth/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ account: { id: "acc_1", communityRole: "student" } }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          thread: {
            id: "thr_1",
            authorName: "Asha",
            title: "How do we brief managers?",
            body: "Need a short ritual.",
            tags: ["leadership"],
            views: 4,
            answerCount: 1,
            createdAt: "2026-08-28T00:00:00.000Z",
            answers: [
              {
                id: "ans_1",
                authorName: "Specialist",
                body: "Keep it to one page.",
                createdAt: "2026-08-28T01:00:00.000Z",
                upvotes: 2,
                upvotedBy: [],
              },
            ],
          },
          replyPolicy: { role: "student", canReply: false, rules: [] },
        }),
      } as Response;
    });
    const { container } = render(<ThreadDetail id="thr_1" />);
    expect(await screen.findByRole("heading", { name: "How do we brief managers?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your answer" })).toBeInTheDocument();
    expect(screen.getByText(/only verified specialists and admins can answer/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /post answer/i })).not.toBeInTheDocument();
    expect(container.querySelector(".reply-panel")).toBeTruthy();
    expect(container.querySelector(".answer-card")).toBeTruthy();
  });
});
