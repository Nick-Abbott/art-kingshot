import express from "express";
import type { Request, Response } from "express";
import type { RouteContext } from "../types";

export default function adminRoutes(ctx: RouteContext) {
  const router = express.Router();

  function requireAppAdmin(req: Request, res: Response): boolean {
    if (req.user?.isAppAdmin) return true;
    ctx.fail(res, 403, "App admin access required.");
    return false;
  }

  router.get(
    "/api/admin/kingdoms",
    ctx.requireAuthMiddleware,
    (req: Request, res: Response) => {
      if (!requireAppAdmin(req, res)) return;
      const kingdoms = ctx.queries.listAdminKingdoms();
      ctx.ok(res, { kingdoms });
    }
  );

  router.get(
    "/api/admin/alliances",
    ctx.requireAuthMiddleware,
    (req: Request, res: Response) => {
      if (!requireAppAdmin(req, res)) return;
      const kingdomId = Number(req.query?.kingdomId);
      const alliances = Number.isFinite(kingdomId)
        ? ctx.queries.listAlliancesByKingdom(kingdomId)
        : ctx.queries.listAlliances();
      ctx.ok(res, { alliances });
    }
  );

  router.get(
    "/api/admin/alliances/:allianceId/profiles",
    ctx.requireAuthMiddleware,
    (req: Request, res: Response) => {
      if (!requireAppAdmin(req, res)) return;
      const allianceId =
        typeof req.params.allianceId === "string" ? req.params.allianceId.trim() : "";
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance id is required.");
        return;
      }
      const alliance = ctx.getAllianceById(allianceId);
      if (!alliance) {
        ctx.fail(res, 404, "Alliance not found.");
        return;
      }
      const profiles = ctx.queries.listAllianceProfiles(allianceId);
      ctx.ok(res, { profiles });
    }
  );

  router.get(
    "/api/admin/profiles/:profileId",
    ctx.requireAuthMiddleware,
    ctx.requireRoleMiddleware(["app_admin"]),
    (req: Request, res: Response) => {
      const query =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!query) {
        ctx.fail(res, 400, "Profile id is required.");
        return;
      }
      let profile = ctx.getProfileById(query);
      if (!profile) {
        profile = ctx.getProfileByPlayerId(query);
      }
      ctx.ok(res, { profile: profile || null });
    }
  );

  router.delete(
    "/api/admin/profiles/:profileId",
    ctx.requireAuthMiddleware,
    ctx.requireRoleMiddleware(["app_admin"]),
    (req: Request, res: Response) => {
      const profileId =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!profileId) {
        ctx.fail(res, 400, "Profile id is required.");
        return;
      }
      const profile = ctx.getProfileById(profileId);
      if (!profile) {
        ctx.fail(res, 404, "Profile not found.");
        return;
      }
      ctx.queries.deleteProfile(profileId);
      ctx.ok(res, { ok: true });
    }
  );

  router.patch(
    "/api/admin/alliances/:allianceId/profiles/:profileId",
    ctx.requireAuthMiddleware,
    (req: Request, res: Response) => {
      if (!requireAppAdmin(req, res)) return;
      const allianceId =
        typeof req.params.allianceId === "string" ? req.params.allianceId.trim() : "";
      const profileId =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!allianceId || !profileId) {
        ctx.fail(res, 400, "Alliance id and profile id are required.");
        return;
      }
      const profile = ctx.getProfileById(profileId);
      if (!profile || profile.allianceId !== allianceId) {
        ctx.fail(res, 404, "Profile not found.");
        return;
      }

      const parsed = ctx.parseAllianceProfileUpdatePayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error, parsed.code);
        return;
      }
      const body = parsed.data;
      if (body.action === "reject") {
        if (profile.status !== "pending") {
          ctx.fail(res, 400, "Only pending profiles can be rejected.");
          return;
        }
        ctx.updateProfile(
          profile.playerId ?? null,
          profile.playerName || null,
          profile.playerAvatar || null,
          profile.kingdomId ?? null,
          null,
          "pending",
          "member",
          profile.troopCount ?? null,
          profile.marchCount ?? null,
          profile.power ?? null,
          profile.rallySize ?? null,
          Date.now(),
          profile.id
        );
        const updated = ctx.getProfileById(profile.id);
        ctx.ok(res, { profile: updated });
        return;
      }

      const status =
        body.status === "active" || body.status === "pending"
          ? body.status
          : profile.status;
      const role =
        body.role === "alliance_admin" || body.role === "member"
          ? body.role
          : profile.role;

      ctx.updateProfileStatus(status, role, Date.now(), profile.id);
      const updated = ctx.getProfileById(profile.id);
      ctx.ok(res, { profile: updated });
    }
  );

  router.delete(
    "/api/admin/alliances/:allianceId",
    ctx.requireAuthMiddleware,
    (req: Request, res: Response) => {
      if (!requireAppAdmin(req, res)) return;
      const allianceId =
        typeof req.params.allianceId === "string" ? req.params.allianceId.trim() : "";
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance id is required.");
        return;
      }
      const alliance = ctx.getAllianceById(allianceId);
      if (!alliance) {
        ctx.fail(res, 404, "Alliance not found.");
        return;
      }

      try {
        ctx.queries.deleteAllianceCascade(allianceId);
      } catch {
        ctx.fail(res, 500, "Failed to delete alliance.");
        return;
      }

      ctx.ok(res, { ok: true });
    }
  );

  return router;
};

export {};
