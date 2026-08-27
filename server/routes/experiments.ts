import { Router } from "express";
import {
  DEFAULT_EXPERIMENT_CONFIGS,
  KNOWN_EXPERIMENTS,
  isExperimentKey,
  normalizeExperimentConfig,
  type ExperimentKey,
} from "../../lib/tracking/experiment";
import { asyncHandler } from "../middleware/errors";
import type { ExperimentConfigStore } from "../stores/memory";

/** Public (read-only) experiment config for client assignment. No secrets. */
export function createExperimentsRouter(deps: { experiments: ExperimentConfigStore }): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const stored = await deps.experiments.list();
      const byKey = new Map(stored.map((row) => [row.key, row]));
      const experiments = KNOWN_EXPERIMENTS.map((meta) => {
        const row = byKey.get(meta.key);
        return normalizeExperimentConfig(meta.key, row ?? DEFAULT_EXPERIMENT_CONFIGS[meta.key]);
      });
      res.json({ experiments });
    }),
  );

  router.get(
    "/:key",
    asyncHandler(async (req, res) => {
      const keyParam = req.params.key;
      if (!isExperimentKey(keyParam)) {
        res.status(404).json({ error: "not_found", message: "Unknown experiment" });
        return;
      }
      const key = keyParam as ExperimentKey;
      const row = await deps.experiments.get(key);
      res.json({
        experiment: normalizeExperimentConfig(key, row ?? DEFAULT_EXPERIMENT_CONFIGS[key]),
      });
    }),
  );

  return router;
}
