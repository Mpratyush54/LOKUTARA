export const PRICING = {
  discovery: { inr: 0, label: "Complimentary", duration: "30–45 minutes" },
  virtualSession: { inr: 15000, label: "2–3 hrs virtual session" },
  workshop: { inr: 25000, label: "2–3 hour workshop" },
  fullDay: { inr: 40000, label: "Full day tailored workshop" },
  customDesignMin: { inr: 7500, label: "Custom programme design (from)" },
  customDesignMax: { inr: 15000, label: "Custom programme design (to)" },
  counselling: { inr: 1200, label: "Individual counselling / 60 min" },
} as const;

export const SIZE_TIERS = [
  {
    max: 49,
    tier: "Early team",
    msg: "A founder-led discovery call and a tightly scoped pilot workshop. Built for teams still forming people practices.",
    count: 3,
  },
  {
    max: 500,
    tier: "Launch segment",
    msg: "Custom capacity building or manager effectiveness for Bengaluru knowledge-work startups and SMEs of about 50–500 people.",
    count: 7,
  },
  {
    max: 2000,
    tier: "Growing org",
    msg: "A tailored programme with a named audience, feedback loop, and employer summary. Scope confirmed in discovery.",
    count: 10,
  },
  {
    max: 10000,
    tier: "Larger workforce",
    msg: "Not the first sales motion. After a discovery call we will say honestly whether a pilot is the right fit.",
    count: 14,
  },
] as const;

export function tierForHeadcount(headcount: number): (typeof SIZE_TIERS)[number] {
  return SIZE_TIERS.find((tier) => headcount <= tier.max) ?? SIZE_TIERS[SIZE_TIERS.length - 1];
}

export const OFFERINGS = [
  {
    id: "capacity",
    title: "Capacity building",
    blurb: "Custom workshops shaped by a discovery conversation with your HR lead or founder.",
    tag: "Build · launch now",
    detail:
      "Topics are not a fixed catalogue yet. We design from the problem you name: manager effectiveness, teamwork, psychological skills for workplace demand.",
  },
  {
    id: "managers",
    title: "Manager effectiveness",
    blurb: "Sessions for people who have to lead teams without a clinical playbook.",
    tag: "Build · launch now",
    detail:
      "A 2–3 hour or full-day format. Facilitation included. Participant limit and outcomes agreed in the proposal after discovery.",
  },
  {
    id: "counselling",
    title: "Individual counselling",
    blurb: "Non-emergency counselling with the psychology team. ₹1,200 / 60 minutes.",
    tag: "Support · launch now",
    detail:
      "Direct support, not an emergency service. Crisis cases follow the clinical referral protocol. Corporate retainers come after the operating model is defined.",
  },
  {
    id: "group",
    title: "Group support",
    blurb: "Facilitated group space alongside the training programme.",
    tag: "Support · launch now",
    detail:
      "Group work sits with the workshop design: reflection, experience sharing, and skills practice — not a drop-in crisis group.",
  },
  {
    id: "custom",
    title: "Custom programme design",
    blurb: "Design beyond the agreed workshop scope. ₹7,500–₹15,000.",
    tag: "Build · launch now",
    detail:
      "Used when discovery shows the workshop outline is not enough and a fuller programme needs writing before delivery.",
  },
  {
    id: "discovery",
    title: "HR discovery call",
    blurb: "Complimentary 30–45 minutes. Qualification, problem definition, next step.",
    tag: "Connect · launch now",
    detail:
      "The first commercial gate. We capture use case, audience, budget, timeframe, and buying process. No obligation to buy a workshop.",
  },
] as const;

export const PILLARS = [
  {
    id: "connect",
    label: "Connect",
    status: "in design",
    accent: "later",
    detail: "Understand the firm’s experience and needs. A community / online forum is planned in the first six months — not live yet.",
    action: "We start relationships with a discovery call today. The broader Connect layer ships later.",
    related: ["Discovery"],
  },
  {
    id: "build",
    label: "Build",
    status: "launch now",
    accent: "now",
    detail: "Custom capacity building and manager effectiveness workshops, designed from the discovery conversation.",
    action: "This is the paid core: a workshop shaped to your team after we qualify the problem.",
    related: ["Workshop", "Discovery"],
  },
  {
    id: "measure",
    label: "Measure",
    status: "in design",
    accent: "later",
    detail: "Pre/post effectiveness and a competency framework. Formal tools are not licensed yet. We will not call a self-built tool a validated psychometric.",
    action: "Today we collect honest participant feedback. Validated psychometrics come after licensing.",
    related: ["Assessment later", "Employer summary"],
  },
  {
    id: "support",
    label: "Support",
    status: "launch now",
    accent: "now",
    detail: "Individual and group counselling with clinical oversight. Non-emergency only, with an explicit referral path.",
    action: "Book individual counselling at ₹1,200 / 60 min, or group support alongside a workshop.",
    related: ["Counselling"],
  },
  {
    id: "discovery",
    label: "Discovery",
    status: "launch now",
    accent: "now",
    detail: "Complimentary needs call before any paid workshop. This is how every corporate engagement starts.",
    action: "30–45 minutes with Joel and Divya. No fake webinar, no obligation to buy.",
    related: ["Discovery"],
  },
  {
    id: "feedback",
    label: "Feedback",
    status: "launch now",
    accent: "now",
    detail: "Participant feedback and an employer-facing summary after a pilot — without exposing confidential counselling content.",
    action: "After delivery we close the loop with the buyer. Counselling content stays confidential.",
    related: ["Employer summary", "Workshop"],
  },
] as const;

export const BOOKING_STEPS = [
  {
    id: "request",
    title: "Request support",
    cta: "Discovery or counselling",
    headline: "You tell us which door you need.",
    body: "HR and founders book a discovery call. Individuals request non-emergency counselling. Crisis and emergency care are referred out — this site is not a hotline.",
    ui: ["Who are you booking for?", "Company discovery", "Individual counselling"],
  },
  {
    id: "schedule",
    title: "Choose a time",
    cta: "Confirm with the team",
    headline: "We propose slots that fit Bengaluru work hours.",
    body: "No self-serve calendar app yet. You share preferred windows; we confirm by email or phone within one business day.",
    ui: ["Preferred windows", "Timezone: IST", "Confirm slot"],
  },
  {
    id: "followup",
    title: "We follow up",
    cta: "Human-handled booking",
    headline: "A person closes the loop — not a bot.",
    body: "Joel, Divya, or the psychology team replies with next steps: discovery agenda, workshop proposal outline, or counselling intake.",
    ui: ["Agenda shared", "Pricing if relevant", "What happens next"],
  },
] as const;
