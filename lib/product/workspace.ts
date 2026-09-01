export const COMMUNITY_TAG_GROUPS = {
  psychology: ["mental-health", "stress-management", "motivation", "counselling"],
  corporate: ["interview", "resume", "leadership", "teamwork", "productivity"],
  industry: ["software", "ai-ml", "internship", "startup", "project-help"],
} as const;

export const COMMUNITY_TAGS = Object.values(COMMUNITY_TAG_GROUPS).flat();

export type LocalAnswer = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
  upvotes: number;
  upvotedBy: string[];
};

export type LocalThread = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  tags: string[];
  views: number;
  createdAt: Date;
  answers: LocalAnswer[];
};

export type McqItem = {
  id: string;
  kind: "mcq";
  prompt: string;
  options: Array<{ value: number; label: string }>;
};

export type RankItem = {
  id: string;
  kind: "rank";
  prompt: string;
  options: Array<{ id: string; label: string; mode: string }>;
};

export type AssessmentItem = McqItem | RankItem;

export type LocalAssessment = {
  id: string;
  title: string;
  duration: string;
  copy: string;
  level: string;
  track: "psychology" | "placement";
  recommended: boolean;
  items: AssessmentItem[];
};

const LIKERT: McqItem["options"] = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

export const LOCAL_ASSESSMENTS: LocalAssessment[] = [
  {
    id: "psychology",
    title: "Psychology inventory",
    duration: "12–18 minutes",
    copy: "A self-report battery used after a workshop or discovery call. Results stay with you unless you share them.",
    level: "Development",
    track: "psychology",
    recommended: true,
    items: [
      { id: "psy1", kind: "mcq", prompt: "I can name what I am feeling while a meeting is still running.", options: LIKERT },
      { id: "psy2", kind: "mcq", prompt: "I recover reasonably after a sharp piece of feedback.", options: LIKERT },
      { id: "psy3", kind: "mcq", prompt: "I notice when a teammate has gone quiet before they say so.", options: LIKERT },
      { id: "psy4", kind: "mcq", prompt: "I ask for help before the work is already late.", options: LIKERT },
      { id: "psy5", kind: "mcq", prompt: "Conflict in the room stays with me after I leave.", options: LIKERT },
      { id: "psy6", kind: "mcq", prompt: "I can keep a boundary when someone wants more of my evening.", options: LIKERT },
    ],
  },
  {
    id: "ocean",
    title: "Trait profile (OCEAN)",
    duration: "8–12 minutes",
    copy: "Five-factor sketch for development conversations. Not a licensed psychometric.",
    level: "Trait sketch",
    track: "psychology",
    recommended: true,
    items: [
      { id: "o1", kind: "mcq", prompt: "I look for new ways of doing familiar work.", options: LIKERT },
      { id: "c1", kind: "mcq", prompt: "I finish what I start even when the energy drops.", options: LIKERT },
      { id: "e1", kind: "mcq", prompt: "I speak up in a room of people I do not know well.", options: LIKERT },
      { id: "a1", kind: "mcq", prompt: "I try to understand a colleague before I push my view.", options: LIKERT },
      { id: "n1", kind: "mcq", prompt: "Tight deadlines leave me unsettled for hours afterwards.", options: LIKERT },
    ],
  },
  {
    id: "kolb",
    title: "Learning style (Kolb ranking)",
    duration: "10–15 minutes",
    copy: "Rank four statements per situation — same interaction as the Competency-Mapping Kolb runner. A conversation aid, not a diagnostic.",
    level: "Learning",
    track: "psychology",
    recommended: false,
    items: [
      {
        id: "k1",
        kind: "rank",
        prompt: "When I have a new problem at work, I usually…",
        options: [
          { id: "ce", label: "Jump in and try something, then see what happens.", mode: "CE" },
          { id: "ro", label: "Watch how others handle it before I move.", mode: "RO" },
          { id: "ac", label: "Think it through until I have a model.", mode: "AC" },
          { id: "ae", label: "Make a plan and start executing it.", mode: "AE" },
        ],
      },
      {
        id: "k2",
        kind: "rank",
        prompt: "In a workshop, I get the most from…",
        options: [
          { id: "ce", label: "A live case I can feel my way through.", mode: "CE" },
          { id: "ro", label: "Listening to how others made sense of it.", mode: "RO" },
          { id: "ac", label: "A framework I can take apart.", mode: "AC" },
          { id: "ae", label: "A drill I can apply on Monday.", mode: "AE" },
        ],
      },
      {
        id: "k3",
        kind: "rank",
        prompt: "When a project goes sideways, I first…",
        options: [
          { id: "ce", label: "Stay with the discomfort and notice what it is telling me.", mode: "CE" },
          { id: "ro", label: "Collect views before I decide what it means.", mode: "RO" },
          { id: "ac", label: "Look for the pattern that explains the miss.", mode: "AC" },
          { id: "ae", label: "Change one concrete thing and test it.", mode: "AE" },
        ],
      },
    ],
  },
  {
    id: "placement",
    title: "Role / placement screen",
    duration: "6–10 minutes",
    copy: "A conversation aid for teams hiring or rotating people — not a hiring score.",
    level: "Placement",
    track: "placement",
    recommended: false,
    items: [
      { id: "p1", kind: "mcq", prompt: "I prefer work with a clear owner and a named outcome.", options: LIKERT },
      { id: "p2", kind: "mcq", prompt: "I am comfortable coordinating across two or more teams.", options: LIKERT },
      { id: "p3", kind: "mcq", prompt: "Ambiguous briefs slow me down more than hard briefs.", options: LIKERT },
      { id: "p4", kind: "mcq", prompt: "I would rather coach someone than do the task myself.", options: LIKERT },
    ],
  },
];

export type StoredAnswer =
  | { kind: "mcq"; value: number }
  | { kind: "rank"; ranked: Array<{ optionId: string; label: string; mode: string; rank: number }> };

export function scoreAssessment(assessment: LocalAssessment, answers: Record<string, StoredAnswer>): number {
  const parts: number[] = [];
  for (const item of assessment.items) {
    const answer = answers[item.id];
    if (!answer) continue;
    if (answer.kind === "mcq") parts.push(answer.value / 5);
    if (answer.kind === "rank") {
      const top = answer.ranked.find((row) => row.rank === 1);
      parts.push(top ? 0.8 : 0.5);
    }
  }
  if (!parts.length) return 0;
  return Math.round((parts.reduce((sum, n) => sum + n, 0) / parts.length) * 100);
}

export function relativeDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function assessmentTitle(id: string): string {
  return LOCAL_ASSESSMENTS.find((item) => item.id === id)?.title ?? id;
}

export function presentAssessmentRun(run: {
  id: string;
  assessmentId: string;
  score: number;
  createdAt: Date;
}) {
  return {
    id: run.id,
    assessmentId: run.assessmentId,
    title: assessmentTitle(run.assessmentId),
    score: run.score,
    createdAt: run.createdAt.toISOString(),
  };
}

/** Forum production reply policy — shown in the community UI, not only in routes. */
export const COMMUNITY_REPLY_RULES = [
  {
    who: "Students",
    canReply: false,
    detail: "Ask questions, browse, and upvote. Cannot post answers — including on their own unanswered thread.",
  },
  {
    who: "Specialists",
    canReply: true,
    detail: "Post answers on unanswered (Pending) and already-answered threads.",
  },
  {
    who: "Admins",
    canReply: true,
    detail: "Post answers and moderate. Same reply permission as specialists.",
  },
] as const;
