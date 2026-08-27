import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingExperience } from "./LandingExperience";

describe("LandingExperience", () => {
  it("renders the Lokutara thesis and discovery CTA", () => {
    render(<LandingExperience />);
    expect(screen.getAllByText(/Lokutara/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1, name: /capacity building your managers/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /discovery/i }).length).toBeGreaterThan(0);
  });
});
