import type { StoredAnalyticsEvent } from "./events";
import type { ExperimentKey, ExperimentVariant } from "./experiment";

export type VariantStats = {
  variant: ExperimentVariant;
  assignments: number;
  ctaClicks: number;
  ctr: number;
};

export type ExperimentRuntimeStats = {
  key: ExperimentKey;
  variants: VariantStats[];
};

function asVariant(value: unknown): ExperimentVariant | null {
  if (value === "control" || value === "variant") return value;
  return null;
}

/**
 * Derive assignment counts and CTR from events that carry experiment props
 * (`props.experiment` + `props.variant`), typically on page_view / cta_click.
 */
export function computeExperimentStats(
  events: StoredAnalyticsEvent[],
  key: ExperimentKey,
): ExperimentRuntimeStats {
  const assigned = new Map<ExperimentVariant, Set<string>>();
  const clicks = new Map<ExperimentVariant, number>();
  assigned.set("control", new Set());
  assigned.set("variant", new Set());
  clicks.set("control", 0);
  clicks.set("variant", 0);

  for (const event of events) {
    if (event.props?.experiment !== key) continue;
    const variant = asVariant(event.props.variant);
    if (!variant) continue;

    if (event.name === "page_view" || event.name === "session_start") {
      assigned.get(variant)!.add(event.visitorId);
    }
    if (event.name === "cta_click") {
      clicks.set(variant, (clicks.get(variant) || 0) + 1);
    }
  }

  const variants: VariantStats[] = (["control", "variant"] as const).map((variant) => {
    const assignments = assigned.get(variant)!.size;
    const ctaClicks = clicks.get(variant) || 0;
    return {
      variant,
      assignments,
      ctaClicks,
      ctr: assignments === 0 ? 0 : ctaClicks / assignments,
    };
  });

  return { key, variants };
}
