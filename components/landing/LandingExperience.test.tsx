import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingExperience } from "./LandingExperience";

describe("LandingExperience", () => {
  it("renders the Lokutara thesis, four ways in, and the need guide", () => {
    render(<LandingExperience />);
    expect(screen.getAllByText(/Lokutara/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1, name: /capacity building your managers/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /one team\. four ways we can help/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /not sure what you need/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i’m an hr \/ people leader/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /50–500 people/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /discovery/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: /connect, build, measure, support/i })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3, name: "Connect" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/no pressure\. just a conversation/i)).toBeInTheDocument();
  }, 20_000);
});
