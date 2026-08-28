import { Router } from "express";
import { ASSESSMENTS, COMMUNITY } from "../../lib/product/catalog";
import { loadProductSnapshot } from "../../lib/product/snapshot";
import { createProductUpstream, type ProductUpstream } from "../../lib/product/upstream";
import { asyncHandler } from "../middleware/errors";

export function createProductRouter(upstream: ProductUpstream): Router {
  const router = Router();

  router.get("/catalog", (_req, res) => {
    res.json({
      assessments: ASSESSMENTS,
      community: COMMUNITY,
    });
  });

  router.get(
    "/snapshot",
    asyncHandler(async (_req, res) => {
      const snapshot = await loadProductSnapshot(upstream);
      res.json(snapshot);
    }),
  );

  return router;
}

export { createProductUpstream };
