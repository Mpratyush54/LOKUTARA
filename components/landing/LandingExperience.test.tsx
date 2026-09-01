import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingExperience } from "./LandingExperience";

describe("LandingExperience", () => {
  it("renders the Lokutara thesis, four ways in, and the need guide", () => {
    render(<LandingExperience />);
    expect(screen.getAllByText(/Lokutara/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^product$/i })[0]).toHaveAttribute("href", "/app");
    expect(screen.getByRole("heading", { level: 1, name: /capacity building your managers/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /one team\. four ways we can help/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /not sure what you need/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /select your company size/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /select your company size/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /i’m an hr \/ people leader/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /50–500 people/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /discovery/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /psychology-led/i })).toBeInTheDocument();
    expect(screen.getByText(/copy coming next/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /buy now/i }).length).toBe(5);
    expect(screen.getByText(/assessments, reports as pdf/i)).toBeInTheDocument();
    const wheel = screen.getByRole("heading", { level: 2, name: /click the wheel/i });
    const offerings = screen.getByRole("heading", { level: 2, name: /what we sell now/i });
    expect(wheel.compareDocumentPosition(offerings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/from the first call through delivery/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lokutara process/i)).not.toBeInTheDocument();
  }, 20_000);

  it("opens an offer from the URL and keeps a buy path", () => {
    render(
      <LandingExperience
        initial={{
          audience: null,
          headcount: 120,
          offer: "workshop",
          pillar: null,
          phone: null,
          gstep: null,
          size: "50-500",
          who: null,
          noticing: null,
          affected: null,
          success: null,
          buy: null,
          paid: false,
        }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: /2–3 hour workshop/i })).toBeInTheDocument();
    expect(screen.getByText(/design from the problem you name/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /buy now/i }).length).toBeGreaterThan(5);
  }, 20_000);
});
