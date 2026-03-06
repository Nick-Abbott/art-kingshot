import express from "express";
import type { Request, Response } from "express";
import type {
  AssignmentMember,
  AssignmentResult,
  BearGroup,
  Profile,
} from "../../shared/types";
import type { RouteContext } from "../types";

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
      const memberPayload = {
        playerId: profile.playerId,
        playerName:
          parsed.data.playerName ?? profile.playerName ?? "Unknown",
        troopCount: parsed.data.troopCount,
        marchCount: parsed.data.marchCount,
        power: parsed.data.power,
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
