import express from "express";
import type { Request, Response } from "express";
import type {
  AssignmentMember,
  AssignmentResult,
  BearGroup,
  Profile,
} from "../../shared/types";
import type { RouteContext } from "../types";
import { parsePlayerLookup } from "../utils/playerLookup";

type BotAuth = {
  userId: string;
  profiles: Profile[];
};

type ActiveProfile = Profile & { allianceId: string; playerId: string };

function getDiscordId(req: Request): string {
  const header = req.header("x-discord-id");
  if (typeof header === "string" && header.trim()) return header.trim();
  const body = req.body as { discordId?: unknown } | undefined;
  if (body && typeof body.discordId === "string") {
    return body.discordId.trim();
  }
  return "";
}

function getGuildId(req: Request): string {
  const header = req.header("x-guild-id");
  if (typeof header === "string" && header.trim()) return header.trim();
  const body = req.body as { guildId?: unknown } | undefined;
  if (body && typeof body.guildId === "string") {
    return body.guildId.trim();
  }
  return "";
}

function getProfileForBot(
  ctx: RouteContext,
  res: Response,
  profiles: Profile[],
  profileId: string
): ActiveProfile | null {
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) {
    ctx.fail(res, 404, "Profile not found.");
    return null;
  }
  if (!profile.allianceId || profile.status !== "active") {
    ctx.fail(res, 403, "Profile is not active in an alliance.");
    return null;
  }
  if (!profile.playerId) {
    ctx.fail(res, 400, "Profile playerId is required.");
    return null;
  }
  return profile as ActiveProfile;
}

export default function botRoutes(ctx: RouteContext) {
  const router = express.Router();

  function requireBotAuth(req: Request, res: Response): BotAuth | null {
    if (!ctx.DISCORD_BOT_SECRET) {
      ctx.fail(res, 500, "Bot auth is not configured.");
      return null;
    }
    const secret = req.header("x-bot-secret");
    if (!secret || secret !== ctx.DISCORD_BOT_SECRET) {
      ctx.fail(res, 401, "Bot authentication required.");
      return null;
    }
    const discordId = getDiscordId(req);
    if (!discordId) {
      ctx.fail(res, 400, "discordId is required.");
      return null;
    }
    const user = ctx.getUserByDiscordId(discordId);
    if (!user) {
      ctx.fail(res, 404, "Discord user not found.");
      return null;
    }
    const profiles = ctx.getProfilesByUser(user.id);
    return { userId: user.id, profiles };
  }

  router.post(
    "/api/bot/vikings",
    (req: Request, res: Response) => {
      const auth = requireBotAuth(req, res);
      if (!auth) return;
      const parsed = ctx.parseBotMemberPayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error, parsed.code);
        return;
      }
      const profile = getProfileForBot(
        ctx,
        res,
        auth.profiles,
        parsed.data.profileId
      );
      if (!profile) return;
      const troopCount = parsed.data.troopCount ?? profile.troopCount ?? null;
      const power = parsed.data.power ?? profile.power ?? null;
      if (troopCount == null) {
        ctx.fail(res, 400, "troopCount is required.");
        return;
      }
      if (power == null) {
        ctx.fail(res, 400, "power is required.");
        return;
      }
      const memberPayload = {
        playerId: profile.playerId,
        playerName:
          parsed.data.playerName ?? profile.playerName ?? "Unknown",
        troopCount,
        marchCount: parsed.data.marchCount,
        power,
      };
      const normalized = ctx.parseMemberPayload(memberPayload);
      if (!normalized.ok) {
        ctx.fail(res, 400, normalized.error, normalized.code);
        return;
      }

      const allianceId = profile.allianceId;
      const members = ctx.membersRepo.upsert(allianceId, normalized.data);
      ctx.queries.updateProfileStatsForMember(
        normalized.data.troopCount,
        normalized.data.marchCount,
        normalized.data.power,
        normalized.data.playerName,
        allianceId,
        normalized.data.playerId
      );
      ctx.ok(res, { members });
    }
  );

  router.delete(
    "/api/bot/vikings/:profileId",
    (req: Request, res: Response) => {
      const auth = requireBotAuth(req, res);
      if (!auth) return;
      const profileId =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!profileId) {
        ctx.fail(res, 400, "profileId is required.");
        return;
      }
      const profile = getProfileForBot(ctx, res, auth.profiles, profileId);
      if (!profile) return;
      const members = ctx.membersRepo.remove(profile.allianceId, profile.playerId);
      ctx.ok(res, { members });
    }
  );

  router.post(
    "/api/bot/bear/:group",
    (req: Request, res: Response) => {
      const auth = requireBotAuth(req, res);
      if (!auth) return;
      const group = req.params.group as BearGroup;
      if (group !== "bear1" && group !== "bear2") {
        ctx.fail(res, 400, "Invalid bear group.");
        return;
      }
      const parsed = ctx.parseBotBearPayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error, parsed.code);
        return;
      }
      const profile = getProfileForBot(
        ctx,
        res,
        auth.profiles,
        parsed.data.profileId
      );
      if (!profile) return;
      const bearPayload = {
        playerId: profile.playerId,
        playerName: parsed.data.playerName ?? profile.playerName ?? "Unknown",
        rallySize: parsed.data.rallySize,
      };
      const normalized = ctx.parseBearPayload(bearPayload);
      if (!normalized.ok) {
        ctx.fail(res, 400, normalized.error, normalized.code);
        return;
      }

      const allianceId = profile.allianceId;
      ctx.queries.upsertBearMember(
        allianceId,
        normalized.data.playerId,
        normalized.data.playerName,
        normalized.data.rallySize,
        group
      );
      ctx.queries.updateProfileRallySize(
        normalized.data.rallySize,
        normalized.data.playerName,
        allianceId,
        normalized.data.playerId
      );
      const members = ctx.queries.listBearGroupMembers(allianceId, group);
      ctx.ok(res, { members });
    }
  );

  router.get(
    "/api/bot/bear",
    (req: Request, res: Response) => {
      const auth = requireBotAuth(req, res);
      if (!auth) return;
      const profileId =
        typeof req.query.profileId === "string" ? req.query.profileId.trim() : "";
      if (!profileId) {
        ctx.fail(res, 400, "profileId is required.");
        return;
      }
      const profile = getProfileForBot(ctx, res, auth.profiles, profileId);
      if (!profile) return;

      const member = ctx.queries.getBearMemberByPlayer(
        profile.allianceId,
        profile.playerId
      );
      ctx.ok(res, { member });
    }
  );

  router.get(
    "/api/bot/profiles",
    (req: Request, res: Response) => {
      const auth = requireBotAuth(req, res);
      if (!auth) return;
      ctx.ok(res, { profiles: auth.profiles });
    }
  );

  router.post(
    "/api/bot/profiles/link",
    async (req: Request, res: Response) => {
      const auth = requireBotAuth(req, res);
      if (!auth) return;
      const parsed = ctx.parseBotLinkPayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error, parsed.code);
        return;
      }
      const { playerId } = parsed.data;
      const guildId = getGuildId(req);
      const guildAssociation = guildId
        ? ctx.queries.getAllianceGuildByGuildId(guildId)
        : null;
      const targetAllianceId = guildAssociation?.allianceId || null;

      const payload = ctx.buildPlayerLookupPayload(playerId);
      const body = new URLSearchParams({
        fid: payload.fid,
        time: String(payload.time),
        sign: payload.sign,
      }).toString();

      let lookupData: unknown = null;
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
        lookupData = JSON.parse(text);
      } catch {
        ctx.fail(res, 502, "Lookup request failed.");
        return;
      }

      const parsedLookup = parsePlayerLookup(lookupData);
      if (!parsedLookup) {
        ctx.fail(res, 404, "Player not found.");
        return;
      }

      const existing = ctx.getProfileByPlayerId(playerId);
      const now = Date.now();
      if (existing) {
        if (existing.userId && existing.userId !== auth.userId) {
          ctx.fail(res, 409, "Profile already exists for this player ID.");
          return;
        }
        if (
          targetAllianceId &&
          existing.allianceId &&
          existing.allianceId !== targetAllianceId
        ) {
          ctx.fail(res, 409, "Profile already belongs to another alliance.");
          return;
        }
        if (!existing.userId) {
          ctx.updateProfileClaim(
            auth.userId,
            parsedLookup.playerName,
            parsedLookup.avatar,
            parsedLookup.kingdomId,
            existing.troopCount ?? null,
            existing.marchCount ?? null,
            existing.power ?? null,
            existing.rallySize ?? null,
            now,
            existing.id
          );
          if (targetAllianceId && existing.allianceId !== targetAllianceId) {
            ctx.updateProfile(
              existing.playerId ?? null,
              parsedLookup.playerName,
              parsedLookup.avatar,
              parsedLookup.kingdomId,
              targetAllianceId,
              "pending",
              "member",
              existing.troopCount ?? null,
              existing.marchCount ?? null,
              existing.power ?? null,
              existing.rallySize ?? null,
              now,
              existing.id
            );
          }
          if (existing.allianceId) {
            ctx.queries.deleteMemberForPlayer(existing.allianceId, playerId);
            ctx.queries.deleteBearForPlayer(existing.allianceId, playerId);
          }
          const claimed = ctx.getProfileById(existing.id);
          ctx.ok(res, { profile: claimed });
          return;
        }
        ctx.updateProfileFields(
          playerId,
          parsedLookup.playerName,
          parsedLookup.avatar,
          parsedLookup.kingdomId,
          existing.troopCount ?? null,
          existing.marchCount ?? null,
          existing.power ?? null,
          existing.rallySize ?? null,
          now,
          existing.id
        );
        if (targetAllianceId && !existing.allianceId) {
          ctx.updateProfile(
            existing.playerId ?? null,
            parsedLookup.playerName,
            parsedLookup.avatar,
            parsedLookup.kingdomId,
            targetAllianceId,
            "pending",
            "member",
            existing.troopCount ?? null,
            existing.marchCount ?? null,
            existing.power ?? null,
            existing.rallySize ?? null,
            now,
            existing.id
          );
        }
        const updated = ctx.getProfileById(existing.id);
        ctx.ok(res, { profile: updated });
        return;
      }

      const id = ctx.crypto.randomUUID();
      ctx.insertProfile(
        id,
        auth.userId,
        playerId,
        parsedLookup.playerName,
        parsedLookup.avatar,
        parsedLookup.kingdomId,
        targetAllianceId,
        "pending",
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

  router.delete(
    "/api/bot/bear/:group/:profileId",
    (req: Request, res: Response) => {
      const auth = requireBotAuth(req, res);
      if (!auth) return;
      const group = req.params.group as BearGroup;
      if (group !== "bear1" && group !== "bear2") {
        ctx.fail(res, 400, "Invalid bear group.");
        return;
      }
      const profileId =
        typeof req.params.profileId === "string" ? req.params.profileId.trim() : "";
      if (!profileId) {
        ctx.fail(res, 400, "profileId is required.");
        return;
      }
      const profile = getProfileForBot(ctx, res, auth.profiles, profileId);
      if (!profile) return;
      ctx.queries.deleteBearMember(profile.allianceId, profile.playerId, group);
      const members = ctx.queries.listBearGroupMembers(profile.allianceId, group);
      ctx.ok(res, { members });
    }
  );

  router.get(
    "/api/bot/vikings/assignments",
    (req: Request, res: Response) => {
      const auth = requireBotAuth(req, res);
      if (!auth) return;
      const profileId =
        typeof req.query.profileId === "string" ? req.query.profileId.trim() : "";
      if (!profileId) {
        ctx.fail(res, 400, "profileId is required.");
        return;
      }
      const profile = getProfileForBot(ctx, res, auth.profiles, profileId);
      if (!profile) return;

      const results = ctx.metaRepo.getLastRun(profile.allianceId) as
        | AssignmentResult
        | null;
      let assignment: AssignmentMember | null = null;
      if (results?.members) {
        assignment =
          results.members.find((member) => member.playerId === profile.playerId) ??
          null;
      }
      ctx.ok(res, { results, assignment });
    }
  );

  return router;
}

export {};
