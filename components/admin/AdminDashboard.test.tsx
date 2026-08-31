import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AdminDashboard } from "./AdminDashboard";

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const overview = {
  metrics: {
    dau: 4,
    wau: 12,
    mau: 40,
    uniqueVisitors: 40,
    sessions: 55,
    pageViews: 120,
    newVisitors: 18,
    returningVisitors: 22,
    bounceRate: 0.32,
    pagesPerSession: 2.2,
    funnel: {
      pageViews: 120,
      ctaClicks: 30,
      formStarts: 12,
      leadsSubmitted: 5,
      conversionRate: 0.125,
    },
    sources: [
      { channel: "direct", visitors: 22 },
      { channel: "linkedin", visitors: 18 },
    ],
  },
  series: [
    { date: "2026-08-30", views: 10, leads: 1, signups: 0, revenue: 0 },
    { date: "2026-08-31", views: 14, leads: 2, signups: 1, revenue: 2_950_000 },
  ],
  commerce: {
    revenueToday: 2_950_000,
    revenueThisMonth: 2_950_000,
    revenueLastMonth: 1_180_000,
    momRevenuePct: 1.5,
    invoicesThisMonth: 2,
    paidThisMonth: 1,
    outstandingPaise: 141_600,
    peopleThisMonth: 3,
    peopleLastMonth: 2,
    visitorsThisMonth: 40,
    visitorsLastMonth: 22,
    leadsThisMonth: 5,
    leadsLastMonth: 3,
    series: [],
  },
  accounts: { none: 1, trial: 3, paid: 1, expired: 1, total: 6 },
  workspace: { runs: 8, threads: 4, replies: 11 },
  recent: {
    leads: [
      {
        id: "lead_1",
        type: "discovery",
        name: "Ravi Iyer",
        email: "ravi@firm.test",
        phone: "9999999999",
        organisation: "Nandi Labs",
        createdAt: "2026-08-30T10:00:00.000Z",
        redacted: false,
      },
    ],
    people: [
      {
        id: "acc_1",
        email: "asha@lokutara.test",
        name: "Asha Rao",
        phone: "9876543210",
        city: "Bengaluru",
        seats: 1,
        createdAt: "2026-08-28T00:00:00.000Z",
        access: {
          status: "trial",
          plan: "trial",
          trialEndsAt: "2026-09-10T00:00:00.000Z",
          daysLeft: 10,
          modules: { assessments: true, community: true },
          canEnterApp: true,
        },
      },
    ],
    runs: [
      {
        id: "run_1",
        accountName: "Asha Rao",
        assessmentId: "ocean",
        score: 72,
        createdAt: "2026-08-29T00:00:00.000Z",
      },
    ],
    threads: [
      {
        id: "th_1",
        title: "How do we brief managers?",
        authorName: "Asha Rao",
        answerCount: 2,
        views: 9,
        createdAt: "2026-08-29T12:00:00.000Z",
      },
    ],
  },
};

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows a skeleton while the session is unknown", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}) as Promise<Response>);
    render(<AdminDashboard />);
    expect(screen.getByTestId("admin-skeleton")).toBeInTheDocument();
  });

  it("renders snapshot KPIs, funnel, charts, and named activity", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/admin/session")) return json({ authenticated: true, configured: true });
      if (url.includes("/api/admin/overview")) return json(overview);
      return json({}, 404);
    });
    render(<AdminDashboard />);
    expect(await screen.findByTestId("admin-overview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /6 people on lokutara/i })).toBeInTheDocument();
    expect(screen.getByText("Visitors")).toBeInTheDocument();
    expect(screen.getByText("Site funnel")).toBeInTheDocument();
    expect(screen.getByText("Traffic sources")).toBeInTheDocument();
    expect(screen.getByText("Pageviews · 14 days")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Ravi Iyer")).toBeInTheDocument();
    expect(screen.getByText("Trait profile (OCEAN)")).toBeInTheDocument();
    expect(screen.getByText("How do we brief managers?")).toBeInTheDocument();
    expect(screen.getByText("linkedin")).toBeInTheDocument();
    expect(screen.getByText("Revenue today")).toBeInTheDocument();
    expect(screen.getByText("This month")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /billing/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("admin-skeleton")).not.toBeInTheDocument());
  });

  it("still shows dashboard structure when the workspace is empty", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/admin/session")) return json({ authenticated: true, configured: true });
      if (url.includes("/api/admin/overview")) {
        return json({
          ...overview,
          metrics: {
            ...overview.metrics,
            uniqueVisitors: 0,
            sessions: 0,
            pageViews: 0,
            dau: 0,
            mau: 0,
            pagesPerSession: 0,
            bounceRate: 0,
            funnel: { pageViews: 0, ctaClicks: 0, formStarts: 0, leadsSubmitted: 0, conversionRate: 0 },
            sources: [],
          },
          accounts: { none: 0, trial: 0, paid: 0, expired: 0, total: 0 },
          workspace: { runs: 0, threads: 0, replies: 0 },
          recent: { leads: [], people: [], runs: [], threads: [], invoices: [] },
          commerce: {
            revenueToday: 0,
            revenueThisMonth: 0,
            revenueLastMonth: 0,
            momRevenuePct: 0,
            invoicesThisMonth: 0,
            paidThisMonth: 0,
            outstandingPaise: 0,
            peopleThisMonth: 0,
            peopleLastMonth: 0,
            visitorsThisMonth: 0,
            visitorsLastMonth: 0,
            leadsThisMonth: 0,
            leadsLastMonth: 0,
            series: [],
          },
        });
      }
      return json({}, 404);
    });
    render(<AdminDashboard />);
    expect(await screen.findByRole("heading", { name: /waiting on the first signup/i })).toBeInTheDocument();
    expect(screen.getByText("Site funnel")).toBeInTheDocument();
    expect(screen.getByText("Latest people")).toBeInTheDocument();
    expect(screen.getByText("Latest leads")).toBeInTheDocument();
    expect(screen.getByText("Latest screens")).toBeInTheDocument();
    expect(screen.getByText("Latest threads")).toBeInTheDocument();
    expect(screen.getByText(/no signups yet/i)).toBeInTheDocument();
  });

  it("opens the people tab from an attention flag", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/admin/session")) return json({ authenticated: true, configured: true });
      if (url.includes("/api/admin/overview")) return json(overview);
      if (url.includes("/api/admin/accounts")) return json({ accounts: overview.recent.people });
      if (url.includes("/api/admin/billing")) {
        return json({
          settings: {
            autoTrialOnSignup: true,
            defaultTrialDays: 14,
            trialModules: { assessments: true, community: true },
          },
        });
      }
      return json({}, 404);
    });
    render(<AdminDashboard />);
    const flag = await screen.findByRole("button", { name: /1 expired/i });
    fireEvent.click(flag);
    expect(await screen.findByText("Auto-start trial on signup")).toBeInTheDocument();
  });

  it("opens billing with the workshop catalogue", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/admin/session")) return json({ authenticated: true, configured: true });
      if (url.includes("/api/admin/overview")) return json(overview);
      if (url.includes("/api/admin/invoices")) {
        return json({
          invoices: [],
          catalog: [
            { sku: "workshop", label: "2–3 hour workshop", unitAmountPaise: 2_500_000, custom: false },
          ],
          razorpayConfigured: false,
          settings: { legalName: "Lokutara", gstin: "", address: "", gstRate: 18 },
        });
      }
      if (url.includes("/api/admin/accounts")) return json({ accounts: overview.recent.people });
      return json({}, 404);
    });
    render(<AdminDashboard />);
    fireEvent.click(await screen.findByRole("button", { name: /billing/i }));
    expect(await screen.findByTestId("admin-billing")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New bill" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2–3 hour workshop/i })).toBeInTheDocument();
    expect(screen.getByText(/razorpay is not configured/i)).toBeInTheDocument();
  });
});
