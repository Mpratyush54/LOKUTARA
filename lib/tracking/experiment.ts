export type ExperimentKey = "hero_cta";

export type ExperimentVariant = "control" | "variant";

export type ExperimentWeights = {
  control: number;
  variant: number;
};

export type ExperimentConfig = {
  key: ExperimentKey;
  enabled: boolean;
  weights: ExperimentWeights;
  forcedVariant: ExperimentVariant | null;
};

export const KNOWN_EXPERIMENTS: Array<{ key: ExperimentKey; label: string; description: string }> = [
  {
    key: "hero_cta",
    label: "Hero CTA",
    description: "Primary homepage CTA copy (discovery call vs get in touch).",
  },
];

export const DEFAULT_EXPERIMENT_CONFIGS: Record<ExperimentKey, ExperimentConfig> = {
  hero_cta: {
    key: "hero_cta",
    enabled: true,
    weights: { control: 50, variant: 50 },
    forcedVariant: null,
  },
};

export function isExperimentKey(value: string): value is ExperimentKey {
  return KNOWN_EXPERIMENTS.some((item) => item.key === value);
}

export function hashBucket(visitorId: string, key: ExperimentKey, modulus = 10_000): number {
  let hash = 0;
  const input = `${key}:${visitorId}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % modulus;
}

/** Stable 50/50 assignment used when no remote config is available. */
export function assignVariant(visitorId: string, key: ExperimentKey): ExperimentVariant {
  return hashBucket(visitorId, key, 2) === 0 ? "control" : "variant";
}

export function useExperimentStub(visitorId: string, key: ExperimentKey): ExperimentVariant {
  return assignVariant(visitorId, key);
}

/**
 * Resolve variant from optional admin config.
 * - forcedVariant wins when set
 * - disabled experiments fall back to control
 * - otherwise weighted bucketing; invalid weights fall back to assignVariant
 */
export function resolveVariant(
  visitorId: string,
  key: ExperimentKey,
  config?: Partial<ExperimentConfig> | null,
): ExperimentVariant {
  if (config?.forcedVariant === "control" || config?.forcedVariant === "variant") {
    return config.forcedVariant;
  }
  if (config?.enabled === false) return "control";

  const controlW = Number(config?.weights?.control);
  const variantW = Number(config?.weights?.variant);
  if (!Number.isFinite(controlW) || !Number.isFinite(variantW) || controlW < 0 || variantW < 0) {
    return assignVariant(visitorId, key);
  }
  const total = controlW + variantW;
  if (total <= 0) return assignVariant(visitorId, key);

  const bucket = hashBucket(visitorId, key, 10_000);
  const threshold = (controlW / total) * 10_000;
  return bucket < threshold ? "control" : "variant";
}

export function normalizeExperimentConfig(
  key: ExperimentKey,
  patch:
    | (Partial<Omit<ExperimentConfig, "key">> & { key?: string })
    | null
    | undefined,
): ExperimentConfig {
  const base = DEFAULT_EXPERIMENT_CONFIGS[key];
  const weights = {
    control: Number(patch?.weights?.control ?? base.weights.control),
    variant: Number(patch?.weights?.variant ?? base.weights.variant),
  };
  let forcedVariant: ExperimentVariant | null = null;
  if (patch?.forcedVariant === "control" || patch?.forcedVariant === "variant") {
    forcedVariant = patch.forcedVariant;
  } else if (patch?.forcedVariant === null) {
    forcedVariant = null;
  } else if (base.forcedVariant) {
    forcedVariant = base.forcedVariant;
  }

  return {
    key,
    enabled: patch?.enabled ?? base.enabled,
    weights: {
      control: Number.isFinite(weights.control) && weights.control >= 0 ? weights.control : base.weights.control,
      variant: Number.isFinite(weights.variant) && weights.variant >= 0 ? weights.variant : base.weights.variant,
    },
    forcedVariant,
  };
}
