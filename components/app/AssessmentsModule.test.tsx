/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AssessmentsCatalog, AssessmentRunner } from "./AssessmentsModule";

vi.mock("next/link", () => ({
  default({ href, children, ...props }: { href: string; children: React.ReactNode }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const ocean = {
  id: "ocean",
  title: "Trait profile (OCEAN)",
  duration: "8–12 minutes",
  copy: "Five-factor sketch.",
  itemCount: 5,
  level: "Trait sketch",
  track: "psychology",
  recommended: true,
  kind: "mcq",
};

describe("AssessmentsCatalog", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders an even assessment grid of cards", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ assessments: [ocean, { ...ocean, id: "kolb", title: "Kolb", kind: "rank" }], runs: [] }),
    } as Response);
    const { container } = render(<AssessmentsCatalog />);
    expect(await screen.findByRole("heading", { name: "Assessments" })).toBeInTheDocument();
    expect(container.querySelector(".assessment-grid")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /start test/i })[0]).toHaveAttribute("href", "/app/assessments/ocean");
  });

  it("links finished runs to their reports", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        assessments: [ocean],
        runs: [{ id: "run_1", assessmentId: "ocean", title: "Trait profile (OCEAN)", score: 72, createdAt: "2026-08-28T00:00:00.000Z" }],
      }),
    } as Response);
    render(<AssessmentsCatalog />);
    expect(await screen.findByRole("heading", { name: "Your reports" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /trait profile \(ocean\)/i })).toHaveAttribute(
      "href",
      "/app/assessments/runs/run_1",
    );
  });
});

describe("AssessmentRunner", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("centers a test-taking card with the question prompt", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        assessment: {
          id: "ocean",
          title: "Trait profile (OCEAN)",
          items: [
            {
              id: "o1",
              kind: "mcq",
              prompt: "I look for new ways of doing familiar work.",
              options: [
                { value: 1, label: "Strongly disagree" },
                { value: 5, label: "Strongly agree" },
              ],
            },
          ],
        },
      }),
    } as Response);
    const { container } = render(<AssessmentRunner assessmentId="ocean" />);
    expect(await screen.findByRole("heading", { name: "Trait profile (OCEAN)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(await screen.findByText("I look for new ways of doing familiar work.")).toBeInTheDocument();
    expect(container.querySelector(".runner-stage")).toBeTruthy();
    expect(container.querySelector(".runner")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /strongly disagree/i })).toBeInTheDocument();
    const finish = await screen.findByRole("button", { name: "Finish" });
    expect(finish).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /strongly agree/i }));
    expect(screen.getByRole("radio", { name: /strongly agree/i })).toBeChecked();
  });
});
