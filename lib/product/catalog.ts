export const ASSESSMENTS = [
  {
    id: "psychology",
    title: "Psychology inventory",
    duration: "25–40 minutes",
    copy: "A self-report battery used after a workshop or discovery call. Results stay with the participant unless they choose an employer summary.",
    href: "/app/assessments#psychology",
  },
  {
    id: "placement",
    title: "Role / placement screen",
    duration: "15–25 minutes",
    copy: "A structured screen for teams hiring or rotating people. It is a conversation aid, not a hiring score.",
    href: "/app/assessments#placement",
  },
  {
    id: "ocean",
    title: "Trait profile (OCEAN)",
    duration: "15–20 minutes",
    copy: "A five-factor sketch for development conversations. Not a licensed psychometric and not a clinical instrument.",
    href: "/app/assessments#ocean",
  },
  {
    id: "riasec",
    title: "Interest map (RIASEC)",
    duration: "10–15 minutes",
    copy: "Holland-style interest themes to talk about fit and stretch. Same honesty rule: we will not call this a validated psychometric.",
    href: "/app/assessments#riasec",
  },
] as const;

export const COMMUNITY = {
  title: "Workshop forum",
  copy: "A closed space for people who have been through a Lokutara session — questions, specialist replies, no second login product.",
  empty:
    "Threads appear here when the community API is connected. Until then this is the same site, not a separate forum dashboard.",
} as const;

export type ThreadCard = {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  answerCount: number;
  createdAt: string | null;
};
