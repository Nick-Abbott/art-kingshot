import express from "express";
import type { Request, Response } from "express";
import { DEFAULT_ALLIANCE_SETTINGS } from "../../shared/allianceConfig";
import type { AllianceSettings } from "../../shared/types";
import type { RouteContext } from "../types";

const TIME_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

type ConfigObject = Record<string, unknown>;

function parseConfig(configText: string | null): ConfigObject {
  if (!configText) return {};
  try {
    const parsed = JSON.parse(configText);
    if (parsed && typeof parsed === "object") {
      return parsed as ConfigObject;
    }
  } catch {
    return {};
  }
  return {};
}

function resolveSettings(config: ConfigObject): AllianceSettings {
  const settings: AllianceSettings = {
    bearTimes: {
      bear1: DEFAULT_ALLIANCE_SETTINGS.bearTimes.bear1,
      bear2: DEFAULT_ALLIANCE_SETTINGS.bearTimes.bear2,
    },
  };

  const bearTimes = config.bearTimes;
  if (bearTimes && typeof bearTimes === "object") {
    const bear1 = (bearTimes as { bear1?: unknown }).bear1;
    const bear2 = (bearTimes as { bear2?: unknown }).bear2;
    if (typeof bear1 === "string" && TIME_24H_REGEX.test(bear1)) {
      settings.bearTimes.bear1 = bear1;
    }
    if (typeof bear2 === "string" && TIME_24H_REGEX.test(bear2)) {
      settings.bearTimes.bear2 = bear2;
    }
  }

  return settings;
}

export default function allianceSettingsRoutes(ctx: RouteContext) {
  const router = express.Router();

  router.get(
    "/api/alliance/settings",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }
      const configText = ctx.queries.getAllianceConfig(allianceId);
      const settings = resolveSettings(parseConfig(configText));
      ctx.ok(res, { settings });
    }
  );

  router.put(
    "/api/alliance/settings",
    ctx.requireAuthMiddleware,
    ctx.requireAllianceMiddleware,
    ctx.requireRoleMiddleware(["alliance_admin"]),
    (req: Request, res: Response) => {
      const allianceId = req.allianceId;
      if (!allianceId) {
        ctx.fail(res, 400, "Alliance is required.");
        return;
      }

      const parsed = ctx.parseAllianceSettingsPayload(req.body);
      if (!parsed.ok) {
        ctx.fail(res, 400, parsed.error, parsed.code);
        return;
      }

      const existing = parseConfig(ctx.queries.getAllianceConfig(allianceId));
      const nextConfig = {
        ...existing,
        bearTimes: {
          bear1: parsed.data.bearTimes.bear1,
          bear2: parsed.data.bearTimes.bear2,
        },
      };

      ctx.queries.updateAllianceConfig(allianceId, JSON.stringify(nextConfig));
      const settings = resolveSettings(nextConfig);
      ctx.ok(res, { settings });
    }
  );

  return router;
}

export {};
