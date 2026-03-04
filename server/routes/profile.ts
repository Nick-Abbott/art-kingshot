const express = require("express");

module.exports = function profileRoutes(ctx) {
  const router = express.Router();

  router.get("/api/profiles", ctx.requireAuthMiddleware, (req, res) => {
    const profiles = ctx.selectProfilesByUser.all(req.user.id);
    ctx.ok(res, { profiles });
  });

  router.get("/api/alliances/list", ctx.requireAuthMiddleware, (req, res) => {
    const kingdomId = Number(req.query?.kingdomId);
    let alliances;
    if (Number.isFinite(kingdomId)) {
      alliances = ctx.db
        .prepare(
          "SELECT id, name, kingdomId FROM alliances WHERE kingdomId = ? ORDER BY name ASC"
        )
        .all(kingdomId);
    } else {
      alliances = ctx.db
        .prepare("SELECT id, name, kingdomId FROM alliances ORDER BY name ASC")
        .all();
    }
    ctx.ok(res, { alliances });
  });

  router.post("/api/alliances", ctx.requireAuthMiddleware, (req, res) => {
    if (
      !ctx.enforceRateLimit(req, res, {
        key: `alliances:${req.user?.id || req.ip}`,
        max: 5,
        windowMs: 60_000,
      })
    ) {
      return;
    }
    const profileId =
      typeof req.header("x-profile-id") === "string"
        ? req.header("x-profile-id").trim()
        : "";
    if (!profileId) {
      ctx.fail(res, 400, "profileId is required.");
      return;
    }

    const profile = ctx.selectProfileById.get(profileId);
    if (!profile || (profile.userId !== req.user.id && !req.user?.isAppAdmin)) {
      ctx.fail(res, 403, "Profile access denied.");
      return;
    }
    if (profile.allianceId) {
      ctx.fail(res, 400, "Profile already belongs to an alliance.");
      return;
    }
    if (!profile.kingdomId) {
      ctx.fail(res, 400, "Profile kingdom is required.");
      return;
    }

    const tag = typeof req.body?.tag === "string" ? req.body.tag.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!tag || tag.length !== 3) {
      ctx.fail(res, 400, "Alliance tag must be 3 letters.");
      return;
    }
    if (!name) {
      ctx.fail(res, 400, "Alliance name is required.");
      return;
    }

    const id = tag.toLowerCase();
    const existing = ctx.selectAllianceById.get(id);
    if (existing) {
      ctx.fail(res, 409, "Alliance tag already exists.");
      return;
    }

    const now = Date.now();
    ctx.db.exec("BEGIN");
    try {
      ctx.db
        .prepare(
          "INSERT INTO alliances (id, name, kingdomId, createdAt) VALUES (?, ?, ?, ?)"
        )
        .run(id, name, profile.kingdomId, now);
      ctx.updateProfile.run(
        profile.playerId,
        profile.playerName || null,
        profile.playerAvatar || null,
        profile.kingdomId,
        id,
        "active",
        "alliance_admin",
        profile.troopCount ?? null,
        profile.marchCount ?? null,
        profile.power ?? null,
        profile.rallySize ?? null,
        now,
        profile.id
      );
      ctx.db.exec("COMMIT");
    } catch (error) {
      ctx.db.exec("ROLLBACK");
      ctx.fail(res, 500, "Failed to create alliance.");
      return;
    }

    const alliance = ctx.selectAllianceById.get(id);
    const updatedProfile = ctx.selectProfileById.get(profile.id);
    ctx.ok(res, { alliance, profile: updatedProfile });
  });

  router.delete(
    "/api/alliances/:allianceId",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req, res) => {
      const allianceId =
        typeof req.params.allianceId === "string" ? req.params.allianceId.trim() : "";
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance id is required.");
        return;
      }
      if (req.allianceId !== allianceId) {
        ctx.fail(res, 403, "Not allowed to delete this alliance.");
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

  router.post("/api/profiles", ctx.requireAuthMiddleware, (req, res) => {
    if (
      !ctx.enforceRateLimit(req, res, {
        key: `profiles:${req.user?.id || req.ip}`,
        max: 5,
        windowMs: 60_000,
      })
    ) {
      return;
    }
    const body = req.body || {};
    const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
    const playerName =
      typeof body.playerName === "string" ? body.playerName.trim() : "";
    const playerAvatar =
      typeof body.playerAvatar === "string" ? body.playerAvatar.trim() : "";
    const kingdomId = Number(body.kingdomId);
    const allianceId =
      typeof body.allianceId === "string" ? body.allianceId.trim() : "";
    const troopCount = Number(body.troopCount);
    const marchCount = Number(body.marchCount);
    const power = Number(body.power);
    const rallySize = Number(body.rallySize);

    if (!playerId) {
      ctx.fail(res, 400, "playerId is required.");
      return;
    }

    const existing = ctx.db
      .prepare("SELECT * FROM profiles WHERE playerId = ?")
      .get(playerId);
    if (existing) {
      if (existing.userId) {
        ctx.fail(res, 409, "Profile already exists for this player ID.");
        return;
      }
      const now = Date.now();
      ctx.db
        .prepare(
          `UPDATE profiles
           SET userId = ?,
               playerName = ?,
               playerAvatar = ?,
               kingdomId = ?,
               status = 'pending',
               role = 'member',
               troopCount = ?,
               marchCount = ?,
               power = ?,
               rallySize = ?,
               updatedAt = ?
           WHERE id = ?`
        )
        .run(
          req.user.id,
          playerName || existing.playerName || null,
          playerAvatar || existing.playerAvatar || null,
          Number.isFinite(kingdomId) ? kingdomId : existing.kingdomId,
          Number.isFinite(troopCount) ? troopCount : existing.troopCount,
          Number.isFinite(marchCount) ? marchCount : existing.marchCount,
          Number.isFinite(power) ? power : existing.power,
          Number.isFinite(rallySize) ? rallySize : existing.rallySize,
          now,
          existing.id
        );
      if (existing.allianceId) {
        ctx.db
          .prepare("DELETE FROM members WHERE allianceId = ? AND playerId = ?")
          .run(existing.allianceId, playerId);
        ctx.db
          .prepare("DELETE FROM bear WHERE allianceId = ? AND playerId = ?")
          .run(existing.allianceId, playerId);
      }
      const claimed = ctx.selectProfileById.get(existing.id);
      ctx.ok(res, { profile: claimed });
      return;
    }

    if (allianceId) {
      const alliance = ctx.selectAllianceById.get(allianceId);
      if (!alliance) {
        ctx.fail(res, 400, "Alliance not found.");
        return;
      }
    }

    let status = "pending";
    let role = "member";
    if (allianceId) {
      const existing = ctx.db
        .prepare(
          "SELECT COUNT(1) AS count FROM profiles WHERE allianceId = ? AND status = 'active'"
        )
        .get(allianceId);
      if (!existing || existing.count === 0) {
        status = "active";
        role = "alliance_admin";
      }
    }

    const now = Date.now();
    const id = ctx.crypto.randomUUID();
    ctx.insertProfile.run(
      id,
      req.user.id,
      playerId,
      playerName || null,
      playerAvatar || null,
      Number.isFinite(kingdomId) ? kingdomId : null,
      allianceId || null,
      status,
      role,
      Number.isFinite(troopCount) ? troopCount : null,
      Number.isFinite(marchCount) ? marchCount : null,
      Number.isFinite(power) ? power : null,
      Number.isFinite(rallySize) ? rallySize : null,
      now,
      now
    );

    const profile = ctx.selectProfileById.get(id);
    ctx.ok(res, { profile });
  });

  router.post(
    "/api/alliance/profiles",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req, res) => {
      const body = req.body || {};
      const playerId =
        typeof body.playerId === "string" ? body.playerId.trim() : "";
      const playerName =
        typeof body.playerName === "string" ? body.playerName.trim() : "";
      const kingdomId = Number(body.kingdomId);
      if (!playerId) {
        ctx.fail(res, 400, "playerId is required.");
        return;
      }
      const existing = ctx.db
        .prepare("SELECT id, allianceId FROM profiles WHERE playerId = ?")
        .get(playerId);
      if (existing) {
        ctx.fail(res, 409, "Profile already exists for this player ID.");
        return;
      }

      const alliance = ctx.selectAllianceById.get(req.allianceId);
      if (alliance && Number.isFinite(kingdomId) && alliance.kingdomId !== kingdomId) {
        ctx.fail(res, 400, "Kingdom does not match alliance.");
        return;
      }

      const now = Date.now();
      const id = ctx.crypto.randomUUID();
      ctx.insertProfile.run(
        id,
        null,
        playerId,
        playerName || null,
        null,
        Number.isFinite(kingdomId) ? kingdomId : req.profile?.kingdomId ?? null,
        req.allianceId,
        "active",
        "member",
        null,
        null,
        null,
        null,
        now,
        now
      );

      const profile = ctx.selectProfileById.get(id);
      ctx.ok(res, { profile });
    }
  );

  router.patch("/api/profiles/:profileId", ctx.requireAuthMiddleware, (req, res) => {
    const profileId =
      typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
    if (!profileId) {
      ctx.fail(res, 400, "profileId is required.");
      return;
    }

    const profile = ctx.selectProfileById.get(profileId);
    if (!profile) {
      ctx.fail(res, 404, "Profile not found.");
      return;
    }
    if (profile.userId !== req.user.id && !req.user?.isAppAdmin) {
      ctx.fail(res, 403, "Profile access denied.");
      return;
    }

    const body = req.body || {};
    const nextPlayerId =
      typeof body.playerId === "string" ? body.playerId.trim() : profile.playerId;
    const nextPlayerName =
      typeof body.playerName === "string"
        ? body.playerName.trim()
        : profile.playerName;
    const nextPlayerAvatar =
      typeof body.playerAvatar === "string"
        ? body.playerAvatar.trim()
        : profile.playerAvatar;
    const nextKingdomId =
      body.kingdomId === null
        ? null
        : Number.isFinite(Number(body.kingdomId))
        ? Number(body.kingdomId)
        : profile.kingdomId;
    const nextAllianceId =
      typeof body.allianceId === "string" ? body.allianceId.trim() : profile.allianceId;
    const troopCount =
      body.troopCount === null ? null : Number.isFinite(Number(body.troopCount))
        ? Number(body.troopCount)
        : profile.troopCount;
    const marchCount =
      body.marchCount === null ? null : Number.isFinite(Number(body.marchCount))
        ? Number(body.marchCount)
        : profile.marchCount;
    const power =
      body.power === null ? null : Number.isFinite(Number(body.power))
        ? Number(body.power)
        : profile.power;
    const rallySize =
      body.rallySize === null ? null : Number.isFinite(Number(body.rallySize))
        ? Number(body.rallySize)
        : profile.rallySize;

    if (!nextPlayerId) {
      ctx.fail(res, 400, "playerId is required.");
      return;
    }

    if (nextPlayerId !== profile.playerId) {
      const existing = ctx.db
        .prepare("SELECT id FROM profiles WHERE playerId = ?")
        .get(nextPlayerId);
      if (existing && existing.id !== profile.id) {
        ctx.fail(res, 409, "Profile already exists for this player ID.");
        return;
      }
    }

    let status = profile.status;
    let role = profile.role;
    let allianceId = nextAllianceId;
    if (typeof body.allianceId === "string") {
      if (allianceId) {
        const alliance = ctx.selectAllianceById.get(allianceId);
        if (!alliance) {
          ctx.fail(res, 400, "Alliance not found.");
          return;
        }
      }
      status = "pending";
      role = "member";
    }

    const now = Date.now();
    ctx.updateProfile.run(
      nextPlayerId,
      nextPlayerName || null,
      nextPlayerAvatar || null,
      nextKingdomId,
      allianceId || null,
      status,
      role,
      troopCount,
      marchCount,
      power,
      rallySize,
      now,
      profile.id
    );

    const updated = ctx.selectProfileById.get(profile.id);
    ctx.ok(res, { profile: updated });
  });

  router.get(
    "/api/alliance/profiles",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req, res) => {
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
           LEFT JOIN users ON users.id = profiles.userId
           WHERE profiles.allianceId = ?`
        )
        .all(req.allianceId);
      ctx.ok(res, { profiles });
    }
  );

  router.patch(
    "/api/alliance/profiles/:profileId",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req, res) => {
      const profileId =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!profileId) {
        ctx.fail(res, 400, "profileId is required.");
        return;
      }
      const profile = ctx.selectProfileById.get(profileId);
      if (!profile || profile.allianceId !== req.allianceId) {
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

  router.post("/api/player-lookup", ctx.requireAuthMiddleware, async (req, res) => {
    if (
      !ctx.enforceRateLimit(req, res, {
        key: `lookup:${req.user?.id || req.ip}`,
        max: 20,
        windowMs: 60_000,
      })
    ) {
      return;
    }
    const fid = typeof req.body?.fid === "string" ? req.body.fid.trim() : "";
    if (!fid) {
      ctx.fail(res, 400, "fid is required.");
      return;
    }

    const payload = ctx.buildPlayerLookupPayload(fid);
    const body = new URLSearchParams(payload).toString();

    try {
      const response = await fetch(
        "https://kingshot-giftcode.centurygame.com/api/player",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        }
      );

      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        data = { raw: text };
      }

      if (response.ok) {
        ctx.ok(res, { ok: response.ok, status: response.status, data });
      } else {
        ctx.fail(res, 502, "Lookup request failed.");
      }
    } catch (error) {
      ctx.fail(res, 502, "Lookup request failed.");
    }
  });

  return router;
};

export {};
