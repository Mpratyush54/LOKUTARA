/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AccountPanel } from "./AccountPanel";

describe("AccountPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows signup email and identity fields, then saves an update", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/auth/me") && (!init || init.method === undefined || init.method === "GET")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            account: {
              id: "acc_1",
              email: "asha@lokutara.test",
              name: "Asha Rao",
              seats: 1,
              createdAt: "2026-08-01T00:00:00.000Z",
              phone: null,
              gender: null,
              age: null,
              city: null,
              access: {
                status: "trial",
                plan: "trial",
                trialEndsAt: "2026-09-10T00:00:00.000Z",
                daysLeft: 12,
                modules: { assessments: true, community: true },
                canEnterApp: true,
              },
              communityRole: "student",
            },
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          account: {
            id: "acc_1",
            email: "asha@lokutara.test",
            name: "Asha Rao",
            seats: 1,
            createdAt: "2026-08-01T00:00:00.000Z",
            phone: "+919876543210",
            gender: "woman",
            age: 29,
            city: "Bengaluru",
            access: {
              status: "trial",
              plan: "trial",
              trialEndsAt: "2026-09-10T00:00:00.000Z",
              daysLeft: 12,
              modules: { assessments: true, community: true },
              canEnterApp: true,
            },
            communityRole: "student",
          },
        }),
      } as Response;
    });

    render(<AccountPanel />);
    const email = await screen.findByDisplayValue("asha@lokutara.test");
    expect(email).toBeInTheDocument();
    expect(screen.getByLabelText("Gender")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+91 98765 43210" } });
    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "29" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Bengaluru" } });
    fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "woman" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    await waitFor(() => expect(screen.getByText(/saved to this workspace/i)).toBeInTheDocument());
    const patch = vi.mocked(fetch).mock.calls.find((call) => call[1]?.method === "PATCH");
    expect(patch).toBeTruthy();
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
      email: "asha@lokutara.test",
      city: "Bengaluru",
      age: 29,
      gender: "woman",
    });
  });
});
