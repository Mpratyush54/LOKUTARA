import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CookieBanner } from "@/components/consent/CookieBanner";
import { DEFAULT_CONSENT } from "@/lib/tracking/consent";

describe("CookieBanner", () => {
  it("asks for a choice when consent is undecided", () => {
    render(<CookieBanner consent={DEFAULT_CONSENT} onAcceptAll={() => {}} onRejectOptional={() => {}} />);
    expect(screen.getByRole("dialog", { name: /cookie/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept all/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cookie policy/i })).toHaveAttribute("href", "/cookies");
  });

  it("hides after a decision", () => {
    const { container } = render(
      <CookieBanner
        consent={{ necessary: true, analytics: false, marketing: false, decidedAt: "2026-08-26" }}
        onAcceptAll={() => {}}
        onRejectOptional={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
