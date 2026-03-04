const express = require("express");
import type { Member } from "../../shared/types";

module.exports = function membersRoutes(ctx) {
  const router = express.Router();

  router.get(
    "/api/members",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req, res) => {
      ctx.ok(res, { members: ctx.membersRepo.list(req.allianceId) });
    }
  );

  router.post(
    "/api/signup",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req, res) => {
      const allianceId = req.allianceId;
      const normalized = ctx.normalizeMemberPayload(req.body || {}) as
        | Member
        | { error: string };
      if ("error" in normalized) {
        ctx.fail(res, 400, normalized.error);
        return;
      }
      const canManage = req.user?.isAppAdmin || req.profileRole === "alliance_admin";
      if (!canManage && req.profile?.playerId !== normalized.playerId) {
        ctx.fail(res, 403, "Cannot update another member.");
        return;
      }

      const members = ctx.membersRepo.upsert(allianceId, normalized);
      ctx.ok(res, { members });
    }
  );

  router.delete(
    "/api/members/:playerId",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req, res) => {
      const allianceId = req.allianceId;
      const playerId =
        typeof req.params.playerId === "string" ? req.params.playerId.trim() : "";
      if (!playerId) {
        ctx.fail(res, 400, "playerId is required.");
        return;
      }
      const canManage = req.user?.isAppAdmin || req.profileRole === "alliance_admin";
      if (!canManage && req.profile?.playerId !== playerId) {
        ctx.fail(res, 403, "Cannot remove another member.");
        return;
      }

      const members = ctx.membersRepo.remove(allianceId, playerId);
      ctx.ok(res, { members });
    }
  );

  return router;
};

export {};
