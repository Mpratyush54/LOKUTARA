import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppShell } from "./AppShell";

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
  usePathname: () => "/app",
}));

describe("AppShell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows a paywall when there is no session", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ authenticated: false }),
    } as Response);
    render(
      <AppShell>
        <p>Secret module</p>
      </AppShell>,
    );
    expect(await screen.findByTestId("paywall")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start free trial/i })).toHaveAttribute("href", "/signup");
    expect(screen.queryByText("Secret module")).not.toBeInTheDocument();
  });

  it("shows a layout skeleton before the session resolves", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}) as Promise<Response>);
    render(
      <AppShell>
        <p>Inside</p>
      </AppShell>,
    );
    expect(screen.getByTestId("app-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Inside")).not.toBeInTheDocument();
  });

  it("renders one dashboard nav, not separate product sites", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        account: {
          id: "acc_1",
          email: "asha@lokutara.test",
          name: "Asha",
          seats: 1,
          createdAt: "2026-08-01T00:00:00.000Z",
          access: {
            status: "trial",
            plan: "trial",
            trialEndsAt: "2026-09-10T00:00:00.000Z",
            daysLeft: 12,
            modules: { assessments: true, community: true },
            canEnterApp: true,
          },
        },
      }),
    } as Response);
    render(
      <AppShell>
        <p>Inside workspace</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.getByText("Inside workspace")).toBeInTheDocument());
    expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toHaveAttribute("href", "/app");
    expect(screen.getAllByRole("link", { name: "Assessments" })[0]).toHaveAttribute("href", "/app/assessments");
    expect(screen.getAllByRole("link", { name: "Community" })[0]).toHaveAttribute("href", "/app/community");
    expect(screen.getAllByRole("link", { name: "Billing" })[0]).toHaveAttribute("href", "/app/billing");
    expect(screen.getAllByRole("link", { name: "Profile" })[0]).toHaveAttribute("href", "/app/account");
    expect(screen.getByTestId("upgrade-banner")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /upgrade now/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^tests$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^forum$/i })).not.toBeInTheDocument();
  });

  it("lets a signed-in expired trial pay from the paywall", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        account: {
          id: "acc_1",
          email: "asha@lokutara.test",
          name: "Asha",
          seats: 1,
          createdAt: "2026-08-01T00:00:00.000Z",
          access: {
            status: "expired",
            plan: "trial",
            trialEndsAt: "2026-08-01T00:00:00.000Z",
            daysLeft: 0,
            modules: { assessments: false, community: false },
            canEnterApp: false,
          },
        },
      }),
    } as Response);
    render(
      <AppShell>
        <p>Secret module</p>
      </AppShell>,
    );
    expect(await screen.findByTestId("paywall")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upgrade now/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute("href", "/app/billing");
    expect(screen.getByRole("link", { name: /get in touch/i })).toHaveAttribute("href", "/#contact");
    expect(screen.queryByRole("link", { name: /talk to founder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /start free trial/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Secret module")).not.toBeInTheDocument();
  });
});
