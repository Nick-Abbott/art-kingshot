import express from "express";
import type { Request, Response } from "express";
import { DEFAULT_ALLIANCE_SETTINGS } from "../../shared/allianceConfig";
import type { AllianceSettings } from "../../shared/types";
import type { RouteContext } from "../types";

const ISO_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z$/;

type ConfigObject = Record<string, unknown>;

function isValidUtcDateTime(value: string): boolean {
  if (!ISO_UTC_REGEX.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

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
    bearNextTimes: {
      bear1: DEFAULT_ALLIANCE_SETTINGS.bearNextTimes.bear1,
      bear2: DEFAULT_ALLIANCE_SETTINGS.bearNextTimes.bear2,
    },
    vikingNextTime: DEFAULT_ALLIANCE_SETTINGS.vikingNextTime,
  };

  const bearNextTimes = config.bearNextTimes;
  if (bearNextTimes && typeof bearNextTimes === "object") {
    const bear1 = (bearNextTimes as { bear1?: unknown }).bear1;
    const bear2 = (bearNextTimes as { bear2?: unknown }).bear2;
    if (typeof bear1 === "string" && typeof bear2 === "string") {
      if (isValidUtcDateTime(bear1) && isValidUtcDateTime(bear2)) {
        settings.bearNextTimes = {
          bear1,
          bear2,
        };
      }
    }
  }

  const vikingNextTime = config.vikingNextTime;
  if (typeof vikingNextTime === "string" && isValidUtcDateTime(vikingNextTime)) {
    settings.vikingNextTime = vikingNextTime;
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
      const nextConfig: ConfigObject & {
        bearNextTimes: { bear1: string; bear2: string };
        vikingNextTime: string;
      } = {
        ...existing,
        bearNextTimes: {
          bear1: parsed.data.bearNextTimes.bear1,
          bear2: parsed.data.bearNextTimes.bear2,
        },
        vikingNextTime: parsed.data.vikingNextTime,
      };

      ctx.queries.updateAllianceConfig(allianceId, JSON.stringify(nextConfig));
      const settings = resolveSettings(nextConfig);
      ctx.ok(res, { settings });
    }
  );

  return router;
}

export {};
