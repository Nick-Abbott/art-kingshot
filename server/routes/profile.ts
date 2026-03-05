import express from "express";
import type { Request, Response } from "express";
import type { RouteContext } from "../types";

export default function profileRoutes(ctx: RouteContext) {
  const router = express.Router();
  const toNullableNumber = (value: number | null | undefined): number | null =>
    Number.isFinite(value ?? NaN) ? (value as number) : null;

  router.get("/api/profiles", ctx.requireAuthMiddleware, (req: Request, res: Response) => {
    if (!req.user) {
      ctx.fail(res, 401, "Authentication required.");
      return;
    }
    const profiles = ctx.getProfilesByUser(req.user.id);
    ctx.ok(res, { profiles });
  });

  router.get(
    "/api/alliances/list",
    ctx.requireAuthMiddleware,
    (req: Request, res: Response) => {
      const kingdomId = Number(req.query?.kingdomId);
      let alliances;
    if (Number.isFinite(kingdomId)) {
      alliances = ctx.queries.listAlliancesByKingdom(kingdomId);
    } else {
      alliances = ctx.queries.listAlliances();
    }
    ctx.ok(res, { alliances });
    }
  );

  router.post("/api/alliances", ctx.requireAuthMiddleware, (req: Request, res: Response) => {
    if (
      !ctx.enforceRateLimit(req, res, {
        key: `alliances:${req.user?.id || req.ip}`,
        max: 5,
        windowMs: 60_000,
      })
    ) {
      return;
    }
    const headerProfileId = req.header("x-profile-id");
    const profileId =
      typeof headerProfileId === "string" ? headerProfileId.trim() : "";
    if (!profileId) {
      ctx.fail(res, 400, "profileId is required.");
      return;
    }

    const profile = ctx.getProfileById(profileId);
    if (!req.user || !profile || (profile.userId !== req.user.id && !req.user?.isAppAdmin)) {
      ctx.fail(res, 403, "Profile access denied.");
      return;
    }
    if (profile.allianceId) {
      ctx.fail(res, 400, "Profile already belongs to an alliance.");
      return;
    }
    const kingdomId = profile.kingdomId;
    if (kingdomId == null) {
      ctx.fail(res, 400, "Profile kingdom is required.");
      return;
    }

    const parsed = ctx.parseAllianceCreatePayload(req.body);
    if (!parsed.ok) {
      ctx.fail(res, 400, parsed.error);
      return;
    }
    const { tag, name } = parsed.data;

    const id = tag.toLowerCase();
    const existing = ctx.getAllianceById(id);
    if (existing) {
      ctx.fail(res, 409, "Alliance tag already exists.");
      return;
    }

    const now = Date.now();
    try {
      ctx.db.transaction(() => {
        ctx.queries.insertAlliance(id, name, kingdomId, now);
        ctx.updateProfile(
          profile.playerId ?? null,
          profile.playerName || null,
          profile.playerAvatar || null,
          kingdomId,
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
      })();
    } catch (error) {
      ctx.fail(res, 500, "Failed to create alliance.");
      return;
    }

    const alliance = ctx.getAllianceById(id);
    const updatedProfile = ctx.getProfileById(profile.id);
    ctx.ok(res, { alliance, profile: updatedProfile });
  });

  router.delete(
    "/api/alliances/:allianceId",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const currentAllianceId = req.allianceId;
      if (!currentAllianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const allianceId =
        typeof req.params.allianceId === "string" ? req.params.allianceId.trim() : "";
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance id is required.");
        return;
      }
      if (currentAllianceId !== allianceId) {
        ctx.fail(res, 403, "Not allowed to delete this alliance.");
        return;
      }

    try {
      ctx.db.transaction(() => {
        ctx.queries.deleteMembersForAlliance(allianceId);
        ctx.queries.deleteMetaForAlliance(allianceId);
        ctx.queries.deleteBearForAlliance(allianceId);
        ctx.queries.resetProfilesAlliance(allianceId);
        ctx.queries.deleteAlliance(allianceId);
      })();
    } catch (error) {
      ctx.fail(res, 500, "Failed to delete alliance.");
      return;
    }

      ctx.ok(res, { ok: true });
    }
  );

  router.post("/api/profiles", ctx.requireAuthMiddleware, (req: Request, res: Response) => {
    if (
      !ctx.enforceRateLimit(req, res, {
        key: `profiles:${req.user?.id || req.ip}`,
        max: 5,
        windowMs: 60_000,
      })
    ) {
      return;
    }
    if (!req.user) {
      ctx.fail(res, 401, "Authentication required.");
      return;
    }
    const parsed = ctx.parseProfileCreatePayload(req.body);
    if (!parsed.ok) {
      ctx.fail(res, 400, parsed.error);
      return;
    }
    const {
      playerId,
      playerName,
      playerAvatar,
      kingdomId,
      allianceId,
      troopCount,
      marchCount,
      power,
      rallySize,
    } = parsed.data;

    const existing = ctx.getProfileByPlayerId(playerId);
    if (existing) {
      if (existing.userId) {
        ctx.fail(res, 409, "Profile already exists for this player ID.");
        return;
      }
      const now = Date.now();
      const nextKingdomId =
        kingdomId === undefined
          ? existing.kingdomId ?? null
          : toNullableNumber(kingdomId);
      const nextTroopCount =
        troopCount === undefined
          ? existing.troopCount ?? null
          : toNullableNumber(troopCount);
      const nextMarchCount =
        marchCount === undefined
          ? existing.marchCount ?? null
          : toNullableNumber(marchCount);
      const nextPower =
        power === undefined ? existing.power ?? null : toNullableNumber(power);
      const nextRallySize =
        rallySize === undefined
          ? existing.rallySize ?? null
          : toNullableNumber(rallySize);

      ctx.updateProfileClaim(
        req.user.id,
        playerName || existing.playerName || null,
        playerAvatar || existing.playerAvatar || null,
        nextKingdomId,
        nextTroopCount,
        nextMarchCount,
        nextPower,
        nextRallySize,
        now,
        existing.id
      );
      if (existing.allianceId) {
        ctx.queries.deleteMemberForPlayer(existing.allianceId, playerId);
        ctx.queries.deleteBearForPlayer(existing.allianceId, playerId);
      }
      const claimed = ctx.getProfileById(existing.id);
      ctx.ok(res, { profile: claimed });
      return;
    }

    if (allianceId) {
      const alliance = ctx.getAllianceById(allianceId);
      if (!alliance) {
        ctx.fail(res, 400, "Alliance not found.");
        return;
      }
    }

    let status = "pending";
    let role = "member";
    if (allianceId) {
      const count = ctx.queries.countActiveProfiles(allianceId);
      if (count === 0) {
        status = "active";
        role = "alliance_admin";
      }
    }

    const now = Date.now();
    const id = ctx.crypto.randomUUID();
    const newKingdomId = toNullableNumber(kingdomId);
    const newTroopCount = toNullableNumber(troopCount);
    const newMarchCount = toNullableNumber(marchCount);
    const newPower = toNullableNumber(power);
    const newRallySize = toNullableNumber(rallySize);

    ctx.insertProfile(
      id,
      req.user.id,
      playerId,
      playerName || null,
      playerAvatar || null,
      newKingdomId,
      allianceId || null,
      status,
      role,
      newTroopCount,
      newMarchCount,
      newPower,
      newRallySize,
      now,
      now
    );

    const profile = ctx.getProfileById(id);
    ctx.ok(res, { profile });
  });

  router.post(
    "/api/alliance/profiles",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const parsed = ctx.parseProfileCreatePayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error);
        return;
      }
      const { playerId, playerName, kingdomId } = parsed.data;
      const existing = ctx.getProfileByPlayerId(playerId);
      if (existing) {
        ctx.fail(res, 409, "Profile already exists for this player ID.");
        return;
      }

      const alliance = ctx.getAllianceById(allianceId);
      if (alliance && Number.isFinite(kingdomId) && alliance.kingdomId !== kingdomId) {
        ctx.fail(res, 400, "Kingdom does not match alliance.");
        return;
      }

      const now = Date.now();
      const id = ctx.crypto.randomUUID();
      const nextKingdomId =
        kingdomId === undefined
          ? req.profile?.kingdomId ?? null
          : toNullableNumber(kingdomId);

      ctx.insertProfile(
        id,
        null,
        playerId,
        playerName || null,
        null,
        nextKingdomId,
        allianceId,
        "active",
        "member",
        null,
        null,
        null,
        null,
        now,
        now
      );

      const profile = ctx.getProfileById(id);
      ctx.ok(res, { profile });
    }
  );

  router.patch(
    "/api/profiles/:profileId",
    ctx.requireAuthMiddleware,
    (req: Request, res: Response) => {
      if (!req.user) {
        ctx.fail(res, 401, "Authentication required.");
        return;
      }
      const profileId =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!profileId) {
        ctx.fail(res, 400, "profileId is required.");
        return;
      }

      const profile = ctx.getProfileById(profileId);
      if (!profile) {
        ctx.fail(res, 404, "Profile not found.");
        return;
      }
      if (profile.userId !== req.user.id && !req.user?.isAppAdmin) {
        ctx.fail(res, 403, "Profile access denied.");
        return;
      }

      const parsed = ctx.parseProfileUpdatePayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error);
        return;
      }
      const payload = parsed.data;
      const nextPlayerId =
        typeof payload.playerId === "string" ? payload.playerId : profile.playerId;
      const nextPlayerName =
        typeof payload.playerName === "string"
          ? payload.playerName
          : profile.playerName;
      const nextPlayerAvatar =
        typeof payload.playerAvatar === "string"
          ? payload.playerAvatar
          : profile.playerAvatar;
      const nextKingdomId =
        payload.kingdomId === undefined
          ? profile.kingdomId ?? null
          : toNullableNumber(payload.kingdomId);
      const nextAllianceId =
        payload.allianceId !== undefined ? payload.allianceId : profile.allianceId;
      const troopCount =
        payload.troopCount === undefined
          ? profile.troopCount ?? null
          : toNullableNumber(payload.troopCount);
      const marchCount =
        payload.marchCount === undefined
          ? profile.marchCount ?? null
          : toNullableNumber(payload.marchCount);
      const power =
        payload.power === undefined
          ? profile.power ?? null
          : toNullableNumber(payload.power);
      const rallySize =
        payload.rallySize === undefined
          ? profile.rallySize ?? null
          : toNullableNumber(payload.rallySize);

      if (!nextPlayerId) {
        ctx.fail(res, 400, "playerId is required.");
        return;
      }

      if (nextPlayerId !== profile.playerId) {
        const existing = ctx.getProfileByPlayerId(nextPlayerId);
        if (existing && existing.id !== profile.id) {
          ctx.fail(res, 409, "Profile already exists for this player ID.");
          return;
        }
      }

      let status = profile.status;
      let role = profile.role;
      let allianceId = nextAllianceId;
      if (typeof payload.allianceId === "string") {
        if (allianceId) {
          const alliance = ctx.getAllianceById(allianceId);
          if (!alliance) {
            ctx.fail(res, 400, "Alliance not found.");
            return;
          }
        }
        status = "pending";
        role = "member";
      }

      const now = Date.now();
    ctx.updateProfile(
      nextPlayerId ?? null,
      nextPlayerName || null,
      nextPlayerAvatar || null,
      nextKingdomId ?? null,
      allianceId || null,
      status,
      role,
      troopCount ?? null,
      marchCount ?? null,
      power ?? null,
      rallySize ?? null,
      now,
      profile.id
    );

    const updated = ctx.getProfileById(profile.id);
    ctx.ok(res, { profile: updated });
    }
  );

  router.get(
    "/api/alliance/profiles",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const profiles = ctx.queries.listAllianceProfiles(allianceId);
      ctx.ok(res, { profiles });
    }
  );

  router.patch(
    "/api/alliance/profiles/:profileId",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const profileId =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!profileId) {
        ctx.fail(res, 400, "profileId is required.");
        return;
      }
      const profile = ctx.getProfileById(profileId);
      if (!profile || profile.allianceId !== allianceId) {
        ctx.fail(res, 404, "Profile not found.");
        return;
      }

      const parsed = ctx.parseAllianceProfileUpdatePayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error);
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

  router.post(
    "/api/player-lookup",
    ctx.requireAuthMiddleware,
    async (req: Request, res: Response) => {
      if (
        !ctx.enforceRateLimit(req, res, {
          key: `lookup:${req.user?.id || req.ip}`,
          max: 20,
          windowMs: 60_000,
        })
      ) {
        return;
      }
      const parsed = ctx.parsePlayerLookupPayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error);
        return;
      }
      const { fid } = parsed.data;

      const payload = ctx.buildPlayerLookupPayload(fid);
      const body = new URLSearchParams({
        fid: payload.fid,
        time: String(payload.time),
        sign: payload.sign,
      }).toString();

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
    }
  );

  return router;
};

export {};
