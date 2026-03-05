import express from "express";
import type { Request, Response } from "express";
import type { BearGroup } from "../../shared/types";
import type { RouteContext } from "../types";

export default function bearRoutes(ctx: RouteContext) {
  const router = express.Router();

  router.get(
    "/api/bear/eligible",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const members = ctx.queries.listEligibleBearMembers(allianceId);
      ctx.ok(res, { members });
    }
  );

  router.get(
    "/api/bear/:group",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const group = req.params.group as BearGroup;
      if (group !== "bear1" && group !== "bear2") {
        ctx.fail(res, 400, "Invalid bear group.");
        return;
      }
      const members = ctx.queries.listBearGroupMembers(allianceId, group);
      ctx.ok(res, { members });
    }
  );

  router.post(
    "/api/bear/:group",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const group = req.params.group as BearGroup;
      if (group !== "bear1" && group !== "bear2") {
        ctx.fail(res, 400, "Invalid bear group.");
        return;
      }
      const parsed = ctx.parseBearPayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error);
        return;
      }
      const { playerId, playerName, rallySize } = parsed.data;
      const canManage = req.user?.isAppAdmin || req.profileRole === "alliance_admin";
      if (!canManage && req.profile?.playerId !== playerId) {
        ctx.fail(res, 403, "Cannot update another member.");
        return;
      }

      ctx.queries.upsertBearMember(allianceId, playerId, playerName, rallySize, group);
      ctx.queries.updateProfileRallySize(rallySize, playerName, allianceId, playerId);

      const members = ctx.queries.listBearGroupMembers(allianceId, group);
      ctx.ok(res, { members });
    }
  );

  router.delete(
    "/api/bear/:group",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const group = req.params.group as BearGroup;
      if (group !== "bear1" && group !== "bear2") {
        ctx.fail(res, 400, "Invalid bear group.");
        return;
      }

      ctx.queries.deleteBearGroup(allianceId, group);
      const members = ctx.queries.listBearGroupMembers(allianceId, group);
      ctx.ok(res, { members });
    }
  );

  router.delete(
    "/api/bear/:group/:playerId",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const group = req.params.group as BearGroup;
      if (group !== "bear1" && group !== "bear2") {
        ctx.fail(res, 400, "Invalid bear group.");
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

      ctx.queries.deleteBearMember(allianceId, playerId, group);
      const members = ctx.queries.listBearGroupMembers(allianceId, group);
      ctx.ok(res, { members });
    }
  );

  return router;
};

export {};
