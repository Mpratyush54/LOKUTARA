export const PRICING = {
  discovery: { inr: 0, label: "Complimentary", duration: "30–45 minutes" },
  virtualSession: { inr: 15000, label: "2–3 hrs virtual session" },
  workshop: { inr: 25000, label: "2–3 hour workshop" },
  fullDay: { inr: 40000, label: "Full day tailored workshop" },
  customDesignMin: { inr: 7500, label: "Custom programme design (from)" },
  customDesignMax: { inr: 15000, label: "Custom programme design (to)" },
  counselling: { inr: 1200, label: "Individual counselling / 60 min" },
  workspaceYear: { inr: 4999, label: "Lokutara workspace — 12 months" },
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

export function peopleCountForHeadcount(headcount: number): number {
  const min = 20;
  const max = 2000;
  const minPeople = 3;
  const maxPeople = 22;
  const t = Math.min(1, Math.max(0, (headcount - min) / (max - min)));
  return Math.round(minPeople + t * (maxPeople - minPeople));
}

export const PEOPLE_FIGURE_MAX = 22;

export const SELL_ITEMS = [
  {
    id: "workspace",
    sku: "app_access" as const,
    title: "Lokutara workspace — 12 months",
    blurb: "Assessments, reports as PDF, and community in one login.",
    detail:
      "Twelve months of the same dashboard your trial opens: psychometric screens, a written report you can download, and the workshop community. Built for an individual or a people lead who wants the product without waiting on a custom programme.",
    includes: ["All four assessment screens", "Openable reports and PDF download", "Community inside the same login", "12 months of access"],
    duration: "12 months",
    tag: "Product",
    sizeFit: ["1-49", "50-500"],
  },
  {
    id: "counselling",
    sku: "counselling" as const,
    title: "Individual counselling / 60 min",
    blurb: "A confidential hour with a psychologist. Non-emergency only.",
    detail:
      "One 60-minute sitting for an individual question — work, relationships, or personal growth. Session topics are not reported back to an employer. This is not a crisis or psychiatric emergency line; those are referred out.",
    includes: ["60 minutes, one-to-one", "Confidential to the client", "Follow-up booking if you want another hour"],
    duration: "60 minutes",
    tag: "Support",
    sizeFit: ["1-49", "50-500", "501-2000", "2000+"],
  },
  {
    id: "virtual_session",
    sku: "virtual_session" as const,
    title: "2–3 hrs virtual session",
    blurb: "A live virtual session for a team that cannot gather in a room.",
    detail:
      "A facilitated 2–3 hour virtual sitting. The brief is written after we understand the team — communication, collaboration, or manager practice — not a canned webinar. Participant numbers and outcomes are confirmed before the date.",
    includes: ["2–3 hours live, virtual", "Facilitation included", "Agenda agreed after a short brief"],
    duration: "2–3 hours",
    tag: "Build",
    sizeFit: ["1-49", "50-500"],
  },
  {
    id: "workshop",
    sku: "workshop" as const,
    title: "2–3 hour workshop",
    blurb: "An in-room or hybrid workshop designed around the people you have now.",
    detail:
      "The paid core for most Bengaluru teams of about 50–500. We design from the problem you name in discovery: manager effectiveness, teamwork, or psychological skills for workplace demand. Facilitation is included. A participant cap is set in the proposal.",
    includes: ["2–3 hours, facilitated", "Designed after discovery", "Participant feedback at the close"],
    duration: "2–3 hours",
    tag: "Build",
    sizeFit: ["50-500", "501-2000"],
  },
  {
    id: "full_day",
    sku: "full_day" as const,
    title: "Full day tailored workshop",
    blurb: "A full day for a named audience, with time to practise, not only to hear a talk.",
    detail:
      "When a 2–3 hour sitting is not enough room. A full day tailored to one audience — often managers or a whole function — with practice, not a slide dump. Scope, headcount, and an employer summary are confirmed before we hold the date.",
    includes: ["Full working day", "Tailored to a named audience", "Employer summary without counselling content"],
    duration: "Full day",
    tag: "Build",
    sizeFit: ["50-500", "501-2000", "2000+"],
  },
] as const;

export const AUDIENCE = [
  {
    id: "hr",
    title: "I’m an HR / People Leader",
    copy: "Understand your people better through psychometric tools, identify competencies and development areas, and strengthen your organisation through people and leadership development.",
    detail:
      "You stay the buyer. Discovery comes first; psychometric work and leadership programmes are scoped after we understand the organisation.",
    cta: "Book a discovery call",
    form: "discovery" as const,
  },
  {
    id: "startup-team",
    title: "I’m a Startup Looking to Develop My Team",
    copy: "Access practical training for your employees in workplace management, communication, collaboration, and professional effectiveness.",
    detail:
      "A founder or people lead books the same discovery call. Training is designed around the team you have now — not a fixed catalogue.",
    cta: "Book a discovery call",
    form: "discovery" as const,
  },
  {
    id: "startup-mental-health",
    title: "I’m a Startup Looking for Mental Health Support",
    copy: "Outsource professional mental health services for your employees, including confidential one-to-one counselling with qualified mental health professionals.",
    detail:
      "You remain the buyer. Session topics are not reported back to the company. This is not an emergency service.",
    cta: "Book a discovery call",
    form: "discovery" as const,
  },
  {
    id: "individual",
    title: "I’m an Individual With a Question",
    copy: "Have a question about mental health, relationships, work, or personal growth? Get thoughtful, psychology-informed answers from our panel of psychologists.",
    detail: "Ask a psychologist. Crisis and emergency care are referred out — this site is not a hotline.",
    cta: "Ask a psychologist",
    form: "counselling" as const,
  },
] as const;

export const PILOT_STEPS = [
  {
    id: "connect",
    title: "Connect",
    copy: "We begin with a complimentary 30–45 minute call to understand your context, goals, and what you want to achieve. No pressure. Just a conversation.",
  },
  {
    id: "build",
    title: "Build",
    copy: "We design a workshop that fits your people and your goals. This could be a 2–3 hour session or a full-day experience—highly practical and interactive.",
  },
  {
    id: "measure",
    title: "Measure",
    copy: "We gather participant feedback at the end of the session to understand what landed, what mattered, and what can be improved.",
  },
  {
    id: "support",
    title: "Support",
    copy: "You receive an employer summary with key learnings and recommendations—without any counselling content or personal data.",
  },
] as const;

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

export const ABOUT_POINTS = [
  {
    id: "psychology-led",
    title: "Psychology-led",
    copy: "Our services are built and delivered by psychology professionals, not generic workplace-wellness content.",
  },
  {
    id: "your-people",
    title: "Built around your people",
    copy: "We don’t believe every organisation needs the same intervention. We start by understanding your people, your context, and what you’re trying to change.",
  },
  {
    id: "confidential",
    title: "Confidential by design",
    copy: "Individual psychological support stays confidential. Organisational conversations stay at a level that can be responsibly learned and improved — not by exposing individual employees.",
  },
  {
    id: "trainers",
    title: "Who your trainers are",
    copy: "",
  },
] as const;

export const PILLARS = [
  {
    id: "connect",
    label: "Connect",
    status: "in product",
    accent: "now",
    detail: "The workshop forum is a module inside the Lokutara dashboard after login — not a separate community product.",
    action: "Discovery calls still start the relationship. The forum is the Connect layer inside Lokutara.",
    related: ["Discovery", "Forum"],
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
    status: "in product",
    accent: "now",
    detail: "Assessments live in the same dashboard as community. Formal tools are not licensed yet. We will not call a self-built tool a validated psychometric.",
    action: "Participant feedback still ships with workshops. The test runner is the Measure layer inside Lokutara.",
    related: ["Tests", "Employer summary"],
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
