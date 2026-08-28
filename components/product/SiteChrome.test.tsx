import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteChrome } from "./SiteChrome";

describe("product chrome", () => {
  it("points marketing chrome at the one product dashboard", () => {
    render(
      <SiteChrome current="app">
        <p>Inside</p>
      </SiteChrome>,
    );
    expect(screen.getAllByRole("link", { name: "Product" })[0]).toHaveAttribute("href", "/app");
    expect(screen.queryByRole("link", { name: "Tests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Forum" })).not.toBeInTheDocument();
  });
});
