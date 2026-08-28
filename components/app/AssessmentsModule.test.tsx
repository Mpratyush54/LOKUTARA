/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AssessmentsCatalog, AssessmentRunner, AssessmentResults } from "./AssessmentsModule";

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
  useSearchParams: () => new URLSearchParams(),
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

  it("links completed runs to a results view in the same dashboard", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        assessments: [{ ...ocean, latestRunId: "run_1", latestScore: 72 }],
        runs: [
          {
            id: "run_1",
            assessmentId: "ocean",
            title: "Trait profile (OCEAN)",
            score: 72,
            createdAt: "2026-08-28T00:00:00.000Z",
            resultsPath: "/app/assessments/ocean/results?run=run_1",
          },
        ],
      }),
    } as Response);
    render(<AssessmentsCatalog />);
    expect(await screen.findByRole("link", { name: /view results/i })).toHaveAttribute("href", "/app/assessments/ocean/results");
    expect(screen.getByRole("link", { name: /trait profile/i })).toHaveAttribute(
      "href",
      "/app/assessments/ocean/results?run=run_1",
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
    expect(await screen.findByText("I look for new ways of doing familiar work.")).toBeInTheDocument();
    expect(container.querySelector(".runner-stage")).toBeTruthy();
    expect(container.querySelector(".runner")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /strongly disagree/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument());
  });
});

describe("AssessmentResults", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders stored traits with an honesty disclaimer", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        assessment: { id: "ocean", title: "Trait profile (OCEAN)", copy: "Five-factor sketch." },
        latest: { id: "run_1" },
        runs: [
          {
            id: "run_1",
            assessmentId: "ocean",
            title: "Trait profile (OCEAN)",
            score: 72,
            headline: "Strongest theme in this sketch: Openness.",
            disclaimer: "These scores are a conversation sketch from your self-report — not a licensed psychometric, clinical diagnosis, or hiring decision.",
            traits: [
              { id: "o1", label: "Openness", score: 80, max: 100, note: "Appetite for new ways of doing familiar work." },
              { id: "c1", label: "Conscientiousness", score: 60, max: 100, note: "Finishing what you start." },
            ],
            createdAt: "2026-08-28T00:00:00.000Z",
          },
        ],
      }),
    } as Response);
    render(<AssessmentResults assessmentId="ocean" />);
    expect(await screen.findByText(/not a licensed psychometric/i)).toBeInTheDocument();
    expect(screen.getByText("Openness")).toBeInTheDocument();
    expect(screen.getByText("Strongest theme in this sketch: Openness.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /all assessments/i })).toHaveAttribute("href", "/app/assessments");
  });
});
