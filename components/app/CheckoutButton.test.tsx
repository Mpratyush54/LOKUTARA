/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppToastHost } from "./AppToast";
import { CheckoutButton } from "./CheckoutButton";

describe("CheckoutButton", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows a popup instead of an error under the button", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: "Online payment is not set up yet. Try again later, or get in touch if this keeps happening." }),
    } as Response);
    render(
      <>
        <CheckoutButton>Upgrade now</CheckoutButton>
        <AppToastHost />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /upgrade now/i }));
    expect(await screen.findByTestId("app-toast")).toHaveTextContent(/get in touch/i);
    expect(screen.queryByText(/get in touch/i, { selector: ".app-error" })).not.toBeInTheDocument();
  });

  it("does not leave error copy under the button while payment opens", async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}) as Promise<Response>);
    render(
      <>
        <CheckoutButton>Pay now</CheckoutButton>
        <AppToastHost />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /pay now/i }));
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    expect(screen.queryByTestId("app-toast")).not.toBeInTheDocument();
  });
});
