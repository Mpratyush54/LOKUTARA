import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NeedGuide } from "./NeedGuide";

describe("NeedGuide", () => {
  it("starts at company size and advances to who", () => {
    render(<NeedGuide onBookDiscovery={() => {}} onAskPsychologist={() => {}} />);
    expect(screen.getByRole("heading", { name: /company size/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /50–500 people/i }));
    expect(screen.getByRole("heading", { name: /who are you looking to support/i })).toBeInTheDocument();
  });

  it("routes an individual to the contact step", () => {
    render(<NeedGuide onBookDiscovery={() => {}} onAskPsychologist={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /under 50 people/i }));
    fireEvent.click(screen.getByRole("button", { name: /i’m an individual looking for an answer/i }));
    expect(screen.getByRole("heading", { name: /where should we send the recommendation/i })).toBeInTheDocument();
  });
});
