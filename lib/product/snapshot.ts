import { ASSESSMENTS, COMMUNITY, type ThreadCard } from "./catalog";
import {
  fetchUpstream,
  statusFromResult,
  type ProductUpstream,
  type UpstreamStatus,
} from "./upstream";

export type ProductSnapshot = {
  assessments: {
    status: UpstreamStatus;
    items: Array<(typeof ASSESSMENTS)[number] & { liveName?: string }>;
    message: string | null;
  };
  community: {
    status: UpstreamStatus;
    threads: ThreadCard[];
    message: string | null;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readThreads(data: unknown): ThreadCard[] {
  const body = asRecord(data);
  const raw = body?.questions;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((item, index) => {
    const row = asRecord(item) ?? {};
    const tags = Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [];
    return {
      id: typeof row.id === "string" ? row.id : String(row._id ?? index),
      title: typeof row.title === "string" ? row.title : "Untitled thread",
      excerpt:
        typeof row.description === "string"
          ? row.description.slice(0, 220)
          : typeof row.excerpt === "string"
            ? row.excerpt.slice(0, 220)
            : "",
      tags,
      answerCount: typeof row.answerCount === "number" ? row.answerCount : 0,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    };
  });
}

function mergeLiveAssessments(data: unknown): ProductSnapshot["assessments"]["items"] {
  const body = asRecord(data);
  const raw = body?.data;
  if (!Array.isArray(raw) || raw.length === 0) {
    return ASSESSMENTS.map((item) => ({ ...item }));
  }
  return ASSESSMENTS.map((item, index) => {
    const live = asRecord(raw[index]);
    const liveName = live && typeof live.name === "string" ? live.name : undefined;
    return { ...item, liveName };
  });
}

export async function loadProductSnapshot(upstream: ProductUpstream): Promise<ProductSnapshot> {
  const [tests, forum] = await Promise.all([
    fetchUpstream(upstream.testsApiUrl, "/api/users/fetch-tests"),
    fetchUpstream(upstream.forumApiUrl, "/api/questions?limit=20"),
  ]);

  return {
    assessments: {
      status: statusFromResult(Boolean(upstream.testsApiUrl), tests),
      items: tests.ok ? mergeLiveAssessments(tests.data) : ASSESSMENTS.map((item) => ({ ...item })),
      message: tests.ok
        ? null
        : upstream.testsApiUrl
          ? "Assessment API is configured but not reachable. Catalog still shows in this dashboard."
          : "Set TESTS_API_URL to connect the competency-mapping API. No separate tests dashboard.",
    },
    community: {
      status: statusFromResult(Boolean(upstream.forumApiUrl), forum),
      threads: forum.ok ? readThreads(forum.data) : [],
      message: forum.ok
        ? null
        : upstream.forumApiUrl
          ? "Community API is configured but not reachable."
          : COMMUNITY.empty,
    },
  };
}
