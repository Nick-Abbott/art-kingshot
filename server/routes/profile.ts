const express = require("express");
import type { ProfileDefaults } from "../../shared/types";

module.exports = function profileRoutes(ctx) {
  const router = express.Router();

  router.get("/api/me/profile", ctx.requireAuthMiddleware, (req, res) => {
    const allianceId = ctx.requireAlliance(req, res);
    if (!allianceId) return;
    const profile = ctx.selectProfile.get(req.user.id, allianceId) as ProfileDefaults | null;
    ctx.ok(res, { profile: profile || null });
  });

  router.post("/api/me/profile", ctx.requireAuthMiddleware, (req, res) => {
    const allianceId = ctx.requireAlliance(req, res);
    if (!allianceId) return;
    const body = req.body || {};
    const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
    const playerName =
      typeof body.playerName === "string" ? body.playerName.trim() : "";
    const troopCount = Number(body.troopCount);
    const marchCount = Number(body.marchCount);
    const power = Number(body.power);

    ctx.upsertProfile.run(
      ctx.crypto.randomUUID(),
      req.user.id,
      allianceId,
      playerId || null,
      playerName || null,
      Number.isFinite(troopCount) ? troopCount : null,
      Number.isFinite(marchCount) ? marchCount : null,
      Number.isFinite(power) ? power : null
    );

    const profile = ctx.selectProfile.get(req.user.id, allianceId) as ProfileDefaults | null;
    ctx.ok(res, { profile });
  });

  router.post("/api/player-lookup", ctx.requireAuthMiddleware, async (req, res) => {
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
