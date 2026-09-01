import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NeedGuide } from "./NeedGuide";
import { EMPTY_LANDING_QUERY } from "@/lib/landing/urlState";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("NeedGuide", () => {
  it("starts at company size and advances to who", () => {
    render(<NeedGuide onBookDiscovery={() => {}} onAskPsychologist={() => {}} />);
    expect(screen.getByRole("heading", { name: /company size/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/company size in employees/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /50–500 people/i }));
    expect(screen.getByRole("heading", { name: /who are you looking to support/i })).toBeInTheDocument();
    expect(window.location.search).toMatch(/gstep=who/);
    expect(window.location.search).toMatch(/size=50-500/);
  });

  it("treats the slider as the same size question", () => {
    render(<NeedGuide onBookDiscovery={() => {}} onAskPsychologist={() => {}} />);
    fireEvent.change(screen.getByLabelText(/company size in employees/i), { target: { value: "40" } });
    expect(window.location.search).toMatch(/headcount=40/);
    expect(window.location.search).toMatch(/size=1-49/);
    fireEvent.click(screen.getByRole("button", { name: /under 50 people/i }));
    expect(screen.getByRole("heading", { name: /who are you looking to support/i })).toBeInTheDocument();
  });

  it("routes an individual to the contact step", () => {
    render(<NeedGuide onBookDiscovery={() => {}} onAskPsychologist={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /under 50 people/i }));
    fireEvent.click(screen.getByRole("button", { name: /i’m an individual looking for an answer/i }));
    expect(screen.getByRole("heading", { name: /where should we send the recommendation/i })).toBeInTheDocument();
    expect(window.location.search).toMatch(/gstep=contact/);
    expect(window.location.search).toMatch(/who=e/);
  });

  it("restores a later step from the URL", () => {
    render(
      <NeedGuide
        initial={{ ...EMPTY_LANDING_QUERY, gstep: "who", size: "50-500" }}
        onBookDiscovery={() => {}}
        onAskPsychologist={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: /who are you looking to support/i })).toBeInTheDocument();
  });
});
