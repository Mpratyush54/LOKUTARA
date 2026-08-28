import type { SizeBand } from "@/lib/leads/validate";

export type GuideLetter = "a" | "b" | "c" | "d" | "e";

export type GuideServiceId =
  | "psychologists"
  | "psychometrics"
  | "training"
  | "leadership"
  | "counselling"
  | "discovery";

export type GuideAnswers = {
  sizeBand: SizeBand | null;
  who: GuideLetter | null;
  noticing: GuideLetter | null;
  affected: GuideLetter | null;
  success: GuideLetter | null;
};

export const GUIDE_SIZE_OPTIONS: Array<{ id: SizeBand; label: string }> = [
  { id: "1-49", label: "Under 50 people" },
  { id: "50-500", label: "50–500 people" },
  { id: "501-2000", label: "501–2000 people" },
  { id: "2000+", label: "More than 2,000 people" },
];

export const GUIDE_QUESTIONS = {
  who: {
    kicker: "Question 1",
    prompt: "Who are you looking to support?",
    options: [
      { id: "a", label: "Myself" },
      { id: "b", label: "My leaders / managers" },
      { id: "c", label: "My employees / team" },
      { id: "d", label: "My organisation as a whole" },
      { id: "e", label: "I’m an individual looking for an answer" },
    ],
  },
  noticing: {
    kicker: "Question 2",
    prompt: "What are you noticing right now?",
    hint: "The problem, not the service.",
    options: [
      { id: "a", label: "We don’t have a clear understanding of our people’s strengths and competencies." },
      { id: "b", label: "Our employees need to develop practical workplace skills." },
      { id: "c", label: "Our managers / leaders could lead more effectively." },
      { id: "d", label: "Our employees are struggling with their mental health or need someone to talk to." },
      { id: "e", label: "We’re not sure what the problem is yet." },
    ],
  },
  affected: {
    kicker: "Question 3",
    prompt: "Who is most affected by this?",
    hint: "Scale, and whether this needs one intervention or a combination.",
    options: [
      { id: "a", label: "A few individuals" },
      { id: "b", label: "A particular team" },
      { id: "c", label: "Our managers / leadership team" },
      { id: "d", label: "Most of our employees" },
      { id: "e", label: "The organisation as a whole" },
    ],
  },
  success: {
    kicker: "Question 4",
    prompt: "What would success look like?",
    hint: "The end goal, not the catalogue item.",
    options: [
      { id: "a", label: "We want to understand our people better." },
      { id: "b", label: "We want our people to work better." },
      { id: "c", label: "We want our leaders to become better leaders." },
      { id: "d", label: "We want our employees to have somewhere to turn when they are struggling." },
      { id: "e", label: "We want to understand what’s going on before deciding what to do." },
    ],
  },
} as const;

export const GUIDE_SERVICES: Record<
  GuideServiceId,
  { title: string; verb: string; blurb: string }
> = {
  psychologists: {
    title: "Ask the Psychologists",
    verb: "Ask",
    blurb: "Thoughtful, psychology-informed answers from our panel. Not an emergency line.",
  },
  psychometrics: {
    title: "Psychometric & Competency Assessment",
    verb: "Understand",
    blurb: "Psychometric assessment and competency mapping, so you can see strengths and development areas.",
  },
  training: {
    title: "Workplace Training",
    verb: "Develop",
    blurb: "Practical training in workplace management, communication, collaboration, and team effectiveness.",
  },
  leadership: {
    title: "Leadership Development",
    verb: "Lead",
    blurb: "Leadership assessment plus development for people who have to lead teams.",
  },
  counselling: {
    title: "1-to-1 Counselling",
    verb: "Support",
    blurb: "Confidential counselling with qualified mental-health professionals. Non-emergency only.",
  },
  discovery: {
    title: "Assessment / Discovery",
    verb: "Clarify",
    blurb: "A complimentary discovery call to understand what’s going on before you buy a programme.",
  },
};

const FROM_NOTICING: Record<GuideLetter, GuideServiceId> = {
  a: "psychometrics",
  b: "training",
  c: "leadership",
  d: "counselling",
  e: "discovery",
};

const FROM_SUCCESS: Record<GuideLetter, GuideServiceId> = {
  a: "psychometrics",
  b: "training",
  c: "leadership",
  d: "counselling",
  e: "discovery",
};

const SERVICE_ORDER: GuideServiceId[] = [
  "psychometrics",
  "training",
  "leadership",
  "counselling",
  "discovery",
  "psychologists",
];

/**
 * Draft mapping from the four-question guide.
 * The commercial logic is still to be confirmed in person — change this
 * function, not the UI.
 */
export function recommendGuide(answers: GuideAnswers): GuideServiceId[] {
  if (answers.who === "e") return ["psychologists"];

  const set = new Set<GuideServiceId>();

  if (answers.noticing) set.add(FROM_NOTICING[answers.noticing]);

  if (answers.who === "b") set.add("leadership");
  const leadershipRelated = answers.noticing === "c" || answers.affected === "c";
  if (answers.who === "a" && leadershipRelated) set.add("leadership");

  switch (answers.affected) {
    case "a":
      set.add("counselling");
      if (answers.noticing === "a" || answers.noticing === "e" || answers.success === "a") {
        set.add("psychometrics");
      }
      break;
    case "b":
      set.add("psychometrics");
      set.add("training");
      break;
    case "c":
      set.add("psychometrics");
      set.add("leadership");
      break;
    case "d":
      set.add("training");
      set.add("counselling");
      break;
    case "e":
      set.add("psychometrics");
      set.add("training");
      set.add("leadership");
      set.add("counselling");
      break;
    default:
      break;
  }

  if (answers.success) set.add(FROM_SUCCESS[answers.success]);
  if (set.size === 0) set.add("discovery");

  return SERVICE_ORDER.filter((id) => set.has(id));
}

export function recommendHeadline(services: GuideServiceId[]): string {
  if (services.length === 1 && services[0] === "psychologists") {
    return "Based on what you’ve told us, we’d recommend talking to our psychologists.";
  }
  if (services.length === 1) {
    return "Based on what you’ve told us, we’d recommend…";
  }
  return "Based on what you’ve told us, we’d recommend a combination of…";
}

export function encodeGuideLead(answers: GuideAnswers, services: GuideServiceId[]): { role: string; preferredTime: string } {
  const parts = [
    `who=${answers.who ?? ""}`,
    `notice=${answers.noticing ?? ""}`,
    `affected=${answers.affected ?? ""}`,
    `success=${answers.success ?? ""}`,
  ];
  return {
    role: parts.join(";"),
    preferredTime: services.join(","),
  };
}
