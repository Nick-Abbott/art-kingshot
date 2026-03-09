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
        const recipients = ctx.queries.listOptedInAssignmentRecipients(allianceId);
        if (recipients.length > 0) {
          ctx.queries.deletePendingAssignmentNotificationsForAlliance(allianceId);
          const byPlayerId = new Map(
            run.members.map((member) => [member.playerId, member])
          );
          const now = Date.now();
          for (const recipient of recipients) {
            const assignment = byPlayerId.get(recipient.playerId);
            if (!assignment) continue;
            ctx.queries.insertAssignmentNotification(
              ctx.crypto.randomUUID(),
              allianceId,
              recipient.playerId,
              recipient.discordId,
              JSON.stringify(assignment),
              "pending",
              now,
              now
            );
          }
          const cutoff = now - 7 * 24 * 60 * 60 * 1000;
          ctx.queries.deleteAssignmentNotificationsBeforeTimestamp(cutoff);
        }
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
      ctx.metaRepo.clearLastRun(allianceId);
      ctx.ok(res, { ok: true });
    }
  );

  return router;
};

export {};
