const express = require("express");
import type { BearGroup } from "../../shared/types";

module.exports = function bearRoutes(ctx) {
  const router = express.Router();

  router.get(
    "/api/bear/eligible",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req, res) => {
      const allianceId = req.allianceId;
      const members = ctx.db
        .prepare(
          `SELECT playerId,
                  playerName,
                  rallySize
           FROM profiles
           WHERE allianceId = ?
             AND status = 'active'
             AND playerId NOT IN (
               SELECT playerId FROM bear WHERE allianceId = ?
             )
           ORDER BY COALESCE(playerName, playerId) ASC`
        )
        .all(allianceId, allianceId);
      ctx.ok(res, { members });
    }
  );

  router.get(
    "/api/bear/:group",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req, res) => {
      const allianceId = req.allianceId;
      const group = req.params.group as BearGroup;
      if (group !== "bear1" && group !== "bear2") {
        ctx.fail(res, 400, "Invalid bear group.");
        return;
      }
      const members = ctx.db
        .prepare(
          `SELECT playerId, playerName, rallySize FROM bear WHERE allianceId = ? AND bearGroup = ?`
        )
        .all(allianceId, group);
      ctx.ok(res, { members });
    }
  );

  router.post(
    "/api/bear/:group",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req, res) => {
      const allianceId = req.allianceId;
      const group = req.params.group as BearGroup;
      if (group !== "bear1" && group !== "bear2") {
        ctx.fail(res, 400, "Invalid bear group.");
        return;
      }
      const playerId =
        typeof req.body.playerId === "string" ? req.body.playerId.trim() : "";
      const playerName =
        typeof req.body.playerName === "string" ? req.body.playerName.trim() : "";
      const rallySize = Number(req.body.rallySize);

      if (!playerId) {
        ctx.fail(res, 400, "playerId is required.");
        return;
      }
      if (!Number.isFinite(rallySize) || rallySize <= 0) {
        ctx.fail(res, 400, "rallySize must be a positive number.");
        return;
      }
      const canManage = req.user?.isAppAdmin || req.profileRole === "alliance_admin";
      if (!canManage && req.profile?.playerId !== playerId) {
        ctx.fail(res, 403, "Cannot update another member.");
        return;
      }

      ctx.db
        .prepare(
          `INSERT INTO bear (allianceId, playerId, playerName, rallySize, bearGroup)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(allianceId, playerId) DO UPDATE SET
             playerName=excluded.playerName,
             rallySize=excluded.rallySize,
             bearGroup=excluded.bearGroup`
        )
        .run(allianceId, playerId, playerName, rallySize, group);
      ctx.db
        .prepare(
          `UPDATE profiles
           SET rallySize = ?,
               playerName = ?
           WHERE allianceId = ? AND playerId = ?`
        )
        .run(rallySize, playerName, allianceId, playerId);

      const members = ctx.db
        .prepare(
          `SELECT playerId, playerName, rallySize FROM bear WHERE allianceId = ? AND bearGroup = ?`
        )
        .all(allianceId, group);
      ctx.ok(res, { members });
    }
  );

  router.delete(
    "/api/bear/:group",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req, res) => {
      const allianceId = req.allianceId;
      const group = req.params.group as BearGroup;
      if (group !== "bear1" && group !== "bear2") {
        ctx.fail(res, 400, "Invalid bear group.");
        return;
      }

      ctx.db
        .prepare(`DELETE FROM bear WHERE allianceId = ? AND bearGroup = ?`)
        .run(allianceId, group);
      const members = ctx.db
        .prepare(
          `SELECT playerId, playerName, rallySize FROM bear WHERE allianceId = ? AND bearGroup = ?`
        )
        .all(allianceId, group);
      ctx.ok(res, { members });
    }
  );

  router.delete(
    "/api/bear/:group/:playerId",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req, res) => {
      const allianceId = req.allianceId;
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

      ctx.db
        .prepare(
          `DELETE FROM bear WHERE allianceId = ? AND playerId = ? AND bearGroup = ?`
        )
        .run(allianceId, playerId, group);
      const members = ctx.db
        .prepare(
          `SELECT playerId, playerName, rallySize FROM bear WHERE allianceId = ? AND bearGroup = ?`
        )
        .all(allianceId, group);
      ctx.ok(res, { members });
    }
  );

  return router;
};

export {};
