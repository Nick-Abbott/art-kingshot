const express = require("express");

module.exports = function adminRoutes(ctx) {
  const router = express.Router();

  function requireAppAdmin(req, res) {
    if (req.user?.isAppAdmin) return true;
    ctx.fail(res, 403, "App admin access required.");
    return false;
  }

  router.get("/api/admin/kingdoms", ctx.requireAuthMiddleware, (req, res) => {
    if (!requireAppAdmin(req, res)) return;
    const kingdoms = ctx.db
      .prepare(
        "SELECT DISTINCT kingdomId FROM alliances WHERE kingdomId IS NOT NULL ORDER BY kingdomId ASC"
      )
      .all()
      .map((row) => row.kingdomId);
    ctx.ok(res, { kingdoms });
  });

  router.get("/api/admin/alliances", ctx.requireAuthMiddleware, (req, res) => {
    if (!requireAppAdmin(req, res)) return;
    const kingdomId = Number(req.query?.kingdomId);
    const alliances = Number.isFinite(kingdomId)
      ? ctx.db
          .prepare(
            "SELECT id, name, kingdomId FROM alliances WHERE kingdomId = ? ORDER BY name ASC"
          )
          .all(kingdomId)
      : ctx.db
          .prepare("SELECT id, name, kingdomId FROM alliances ORDER BY name ASC")
          .all();
    ctx.ok(res, { alliances });
  });

  router.get(
    "/api/admin/alliances/:allianceId/profiles",
    ctx.requireAuthMiddleware,
    (req, res) => {
      if (!requireAppAdmin(req, res)) return;
      const allianceId =
        typeof req.params.allianceId === "string" ? req.params.allianceId.trim() : "";
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance id is required.");
        return;
      }
      const alliance = ctx.selectAllianceById.get(allianceId);
      if (!alliance) {
        ctx.fail(res, 404, "Alliance not found.");
        return;
      }
      const profiles = ctx.db
        .prepare(
          `SELECT profiles.id,
                  profiles.userId,
                  profiles.playerId,
                  profiles.playerName,
                  profiles.playerAvatar,
                  profiles.kingdomId,
                  profiles.allianceId,
                  profiles.status,
                  profiles.role,
                  profiles.troopCount,
                  profiles.marchCount,
                  profiles.power,
                  profiles.rallySize,
                  users.displayName AS userDisplayName
           FROM profiles
           JOIN users ON users.id = profiles.userId
           WHERE profiles.allianceId = ?`
        )
        .all(allianceId);
      ctx.ok(res, { profiles });
    }
  );

  router.get(
    "/api/admin/profiles/:profileId",
    ctx.requireAuthMiddleware,
    ctx.requireRoleMiddleware(["app_admin"]),
    (req, res) => {
      const query =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!query) {
        ctx.fail(res, 400, "Profile id is required.");
        return;
      }
      let profile = ctx.selectProfileById.get(query);
      if (!profile) {
        profile = ctx.db
          .prepare("SELECT * FROM profiles WHERE playerId = ?")
          .get(query);
      }
      ctx.ok(res, { profile: profile || null });
    }
  );

  router.delete(
    "/api/admin/profiles/:profileId",
    ctx.requireAuthMiddleware,
    ctx.requireRoleMiddleware(["app_admin"]),
    (req, res) => {
      const profileId =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!profileId) {
        ctx.fail(res, 400, "Profile id is required.");
        return;
      }
      const profile = ctx.selectProfileById.get(profileId);
      if (!profile) {
        ctx.fail(res, 404, "Profile not found.");
        return;
      }
      ctx.db.prepare("DELETE FROM profiles WHERE id = ?").run(profileId);
      ctx.ok(res, { ok: true });
    }
  );

  router.patch(
    "/api/admin/alliances/:allianceId/profiles/:profileId",
    ctx.requireAuthMiddleware,
    (req, res) => {
      if (!requireAppAdmin(req, res)) return;
      const allianceId =
        typeof req.params.allianceId === "string" ? req.params.allianceId.trim() : "";
      const profileId =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!allianceId || !profileId) {
        ctx.fail(res, 400, "Alliance id and profile id are required.");
        return;
      }
      const profile = ctx.selectProfileById.get(profileId);
      if (!profile || profile.allianceId !== allianceId) {
        ctx.fail(res, 404, "Profile not found.");
        return;
      }

      const body = req.body || {};
      if (body.action === "reject") {
        if (profile.status !== "pending") {
          ctx.fail(res, 400, "Only pending profiles can be rejected.");
          return;
        }
        ctx.updateProfile.run(
          profile.playerId,
          profile.playerName || null,
          profile.playerAvatar || null,
          profile.kingdomId,
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
        const updated = ctx.selectProfileById.get(profile.id);
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

      ctx.updateProfileStatus.run(status, role, Date.now(), profile.id);
      const updated = ctx.selectProfileById.get(profile.id);
      ctx.ok(res, { profile: updated });
    }
  );

  router.delete(
    "/api/admin/alliances/:allianceId",
    ctx.requireAuthMiddleware,
    (req, res) => {
      if (!requireAppAdmin(req, res)) return;
      const allianceId =
        typeof req.params.allianceId === "string" ? req.params.allianceId.trim() : "";
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance id is required.");
        return;
      }
      const alliance = ctx.selectAllianceById.get(allianceId);
      if (!alliance) {
        ctx.fail(res, 404, "Alliance not found.");
        return;
      }

      ctx.db.exec("BEGIN");
      try {
        ctx.db.prepare("DELETE FROM members WHERE allianceId = ?").run(allianceId);
        ctx.db.prepare("DELETE FROM meta WHERE allianceId = ?").run(allianceId);
        ctx.db.prepare("DELETE FROM bear WHERE allianceId = ?").run(allianceId);
        ctx.db
          .prepare(
            "UPDATE profiles SET allianceId = NULL, status = 'pending', role = 'member' WHERE allianceId = ?"
          )
          .run(allianceId);
        ctx.db.prepare("DELETE FROM alliances WHERE id = ?").run(allianceId);
        ctx.db.exec("COMMIT");
      } catch (error) {
        ctx.db.exec("ROLLBACK");
        ctx.fail(res, 500, "Failed to delete alliance.");
        return;
      }

      ctx.ok(res, { ok: true });
    }
  );

  return router;
};

export {};
