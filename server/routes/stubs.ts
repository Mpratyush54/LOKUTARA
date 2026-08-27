import { Router } from "express";

export function createStubRouter(feature: "chat" | "tests"): Router {
  const router = Router();
  router.use((_req, res) => {
    res.status(501).json({
      status: "not_mounted",
      feature,
      message: `${feature} will mount on this Express server when the existing app is provided. Same deployment.`,
    });
  });
  return router;
}
