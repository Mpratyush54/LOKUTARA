export type ProductUpstream = {
  testsApiUrl: string | null;
  forumApiUrl: string | null;
};

export type UpstreamStatus = "online" | "offline" | "unset";

export type UpstreamFetchResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: "offline" | "error"; message: string };

function trimBase(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

export function createProductUpstream(source: {
  testsApiUrl?: string | null;
  forumApiUrl?: string | null;
}): ProductUpstream {
  return {
    testsApiUrl: trimBase(source.testsApiUrl ?? null),
    forumApiUrl: trimBase(source.forumApiUrl ?? null),
  };
}

export async function fetchUpstream(
  baseUrl: string | null,
  path: string,
  init?: RequestInit,
  timeoutMs = 2500,
): Promise<UpstreamFetchResult> {
  if (!baseUrl) {
    return { ok: false, status: "offline", message: "Upstream URL is not configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init?.headers || {}) },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        message: (data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `Upstream returned ${res.status}`),
      };
    }
    return { ok: true, status: res.status, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream request failed";
    return { ok: false, status: "offline", message };
  } finally {
    clearTimeout(timer);
  }
}

export function statusFromResult(configured: boolean, result: UpstreamFetchResult): UpstreamStatus {
  if (!configured) return "unset";
  return result.ok ? "online" : "offline";
}
