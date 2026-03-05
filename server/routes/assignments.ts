import express from "express";
import type { Request, Response } from "express";
import type { RouteContext } from "../types";

export default function assignmentsRoutes(ctx: RouteContext) {
  const router = express.Router();

  router.post(
    "/api/run",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      try {
        const run = ctx.generateAssignments(ctx.membersRepo.list(allianceId));
        ctx.metaRepo.setLastRun(allianceId, run);
        ctx.ok(res, run);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Run failed.";
        ctx.fail(res, 400, message);
      }
    }
  );

  router.get(
    "/api/results",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      ctx.ok(res, { results: ctx.metaRepo.getLastRun(allianceId) });
    }
  );

  router.post(
    "/api/reset",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      ctx.metaRepo.clearAll(allianceId, ctx.membersRepo);
      ctx.ok(res, { ok: true });
    }
  );

  return router;
};

export {};
