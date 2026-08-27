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
    form: "question" as const,
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
