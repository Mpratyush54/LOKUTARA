import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthForm } from "./AuthForm";

vi.mock("next/link", () => ({
  default({ href, children, ...props }: { href: string; children: React.ReactNode }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

describe("AuthForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("collects name, email, phone, age, city, and organisation on signup", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ ok: true }),
    } as Response);

    render(<AuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Asha Rao" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "asha@lokutara.test" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "29" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Bengaluru" } });
    fireEvent.change(screen.getByLabelText("Organisation"), { target: { value: "Lokutara" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pass-word" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Asha Rao",
      email: "asha@lokutara.test",
      phone: "9876543210",
      age: 29,
      city: "Bengaluru",
      organisation: "Lokutara",
      password: "pass-word",
      acceptLegal: true,
    });
  });

  it("only asks for email and password on login", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Phone")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Age")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("City")).not.toBeInTheDocument();
  });
});
