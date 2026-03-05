import express from "express";
import type { Request, Response } from "express";
import type { RouteContext } from "../types";

export default function membersRoutes(ctx: RouteContext) {
  const router = express.Router();

  router.get(
    "/api/members",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      ctx.ok(res, { members: ctx.membersRepo.list(allianceId) });
    }
  );

  router.post(
    "/api/signup",
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

      const members = ctx.membersRepo.upsert(allianceId, normalized);
      ctx.queries.updateProfileStatsForMember(
        normalized.troopCount,
        normalized.marchCount,
        normalized.power,
        normalized.playerName,
        allianceId,
        normalized.playerId
      );
      ctx.ok(res, { members });
    }
  );

  router.get(
    "/api/members/eligible",
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
    "/api/members/:playerId",
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

      const members = ctx.membersRepo.remove(allianceId, playerId);
      ctx.ok(res, { members });
    }
  );

  return router;
};

export {};
