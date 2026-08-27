const VISITOR_RE = /^v_[a-z0-9]{16,}$/;
const SESSION_RE = /^s_[a-z0-9]{16,}$/;

export function createVisitorId(random = () => Math.random().toString(36).slice(2, 12)): string {
  return `v_${random()}${random()}`.slice(0, 24);
}

export function createSessionId(random = () => Math.random().toString(36).slice(2, 12)): string {
  return `s_${random()}${random()}`.slice(0, 24);
}

export function isVisitorId(value: string | undefined | null): value is string {
  return Boolean(value && VISITOR_RE.test(value));
}

export function isSessionId(value: string | undefined | null): value is string {
  return Boolean(value && SESSION_RE.test(value));
}

export function resolveVisitorId(existing: string | undefined | null): { id: string; isNew: boolean } {
  if (isVisitorId(existing)) return { id: existing, isNew: false };
  return { id: createVisitorId(), isNew: true };
}

export function resolveSessionId(
  existing: string | undefined | null,
  lastActivityMs: number | undefined,
  nowMs: number,
  ttlMs = 30 * 60 * 1000,
): { id: string; isNew: boolean } {
  const expired = lastActivityMs === undefined || nowMs - lastActivityMs > ttlMs;
  if (isSessionId(existing) && !expired) return { id: existing, isNew: false };
  return { id: createSessionId(), isNew: true };
}
