import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountPanel } from "./AccountPanel";

vi.mock("./AppShell", async () => {
  const actual = await vi.importActual<typeof import("./AppShell")>("./AppShell");
  return {
    ...actual,
    useAppAccount: () => ({
      id: "acc_1",
      email: "asha@lokutara.test",
      name: "Asha Rao",
      phone: "9876543210",
      age: 29,
      city: "Bengaluru",
      organisation: "Lokutara",
      seats: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
      communityRole: "student",
      access: {
        status: "trial",
        plan: "trial",
        trialEndsAt: "2026-09-10T00:00:00.000Z",
        daysLeft: 12,
        modules: { assessments: true, community: true },
        canEnterApp: true,
      },
    }),
    useSetAppAccount: () => vi.fn(),
  };
});

describe("AccountPanel", () => {
  it("shows collected profile details", () => {
    render(<AccountPanel />);
    expect(screen.getByRole("heading", { name: "Asha Rao" })).toBeInTheDocument();
    expect(screen.getByText("asha@lokutara.test")).toBeInTheDocument();
    expect(screen.getByText("9876543210")).toBeInTheDocument();
    expect(screen.getByText("29")).toBeInTheDocument();
    expect(screen.getByText("Bengaluru")).toBeInTheDocument();
    expect(screen.getByText("Lokutara")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upgrade now/i })).toBeInTheDocument();
  });
});
