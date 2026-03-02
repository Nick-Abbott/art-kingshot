const express = require("express");

module.exports = function assignmentsRoutes(ctx) {
  const router = express.Router();

  router.post(
    "/api/run",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req, res) => {
      const allianceId = req.allianceId;
      try {
        const run = ctx.generateAssignments(ctx.membersRepo.list(allianceId));
        ctx.metaRepo.setLastRun(allianceId, run);
        ctx.ok(res, run);
      } catch (error) {
        ctx.fail(res, 400, error.message);
      }
    }
  );

  router.get(
    "/api/results",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req, res) => {
      ctx.ok(res, { results: ctx.metaRepo.getLastRun(req.allianceId) });
    }
  );

  router.post(
    "/api/reset",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req, res) => {
      const allianceId = req.allianceId;
      ctx.metaRepo.clearAll(allianceId, ctx.membersRepo);
      ctx.ok(res, { ok: true });
    }
  );

  return router;
};

export {};
