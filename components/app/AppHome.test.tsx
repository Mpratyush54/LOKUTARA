import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppHome } from "./AppHome";

vi.mock("next/link", () => ({
  default({ href, children, ...props }: { href: string; children: React.ReactNode }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

describe("AppHome", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows a skeleton while the workspace loads", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}) as Promise<Response>);
    render(<AppHome />);
    expect(screen.getByTestId("home-skeleton")).toBeInTheDocument();
  });

  it("renders a next-action brief, named scores, and community threads", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        runs: [{ id: "r1", assessmentId: "ocean", score: 72, createdAt: "2026-08-28T00:00:00.000Z" }],
        threadCount: 3,
        recentThreads: [{ id: "t1", title: "How do we brief managers?", answerCount: 2 }],
      }),
    } as Response);
    render(<AppHome />);
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /next: psychology inventory/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent screens" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Community" })).toBeInTheDocument();
    expect(screen.getByText("Trait profile (OCEAN)")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/app/assessments/psychology");
    expect(screen.getByRole("link", { name: /trait profile \(ocean\)/i })).toHaveAttribute(
      "href",
      "/app/assessments/runs/r1",
    );
    expect(screen.getByText("How do we brief managers?")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("home-skeleton")).not.toBeInTheDocument());
  });

  it("invites a first action when the workspace is empty", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ runs: [], threadCount: 0, recentThreads: [] }),
    } as Response);
    render(<AppHome />);
    expect(await screen.findByText(/no threads yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start now" })).toHaveAttribute("href", "/app/assessments/psychology");
    expect(screen.getByRole("link", { name: "Ask a question" })).toHaveAttribute("href", "/app/community/ask");
  });
});
