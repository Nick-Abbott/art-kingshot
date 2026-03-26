import express from "express";
import type { Request, Response } from "express";
import type { RouteContext } from "../types";

export default function vikingsRoutes(ctx: RouteContext) {
  const router = express.Router();

  router.get(
    "/api/vikings",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      ctx.ok(res, { members: ctx.vikingsRepo.list(allianceId) });
    }
  );

  router.post(
    "/api/vikings",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const parsed = ctx.parseMemberPayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error, parsed.code);
        return;
      }
      const normalized = parsed.data;
      const canManage = req.user?.isAppAdmin || req.profileRole === "alliance_admin";
      if (!canManage && req.profile?.playerId !== normalized.playerId) {
        ctx.fail(res, 403, "Cannot update another member.");
        return;
      }

      ctx.vikingsRepo.upsert(allianceId, normalized);
      ctx.queries.updateProfileStatsForMember(
        normalized.troopCount,
        normalized.marchCount,
        normalized.power,
        normalized.playerName,
        allianceId,
        normalized.playerId
      );
      const members = ctx.vikingsRepo.list(allianceId);
      ctx.ok(res, { members });
    }
  );

  router.get(
    "/api/vikings/eligible",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const members = ctx.queries.listEligibleMembers(allianceId);
      ctx.ok(res, { members });
    }
  );

  router.delete(
    "/api/vikings/:playerId",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
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

      const members = ctx.vikingsRepo.remove(allianceId, playerId);
      ctx.ok(res, { members });
    }
  );

  return router;
};

export {};
