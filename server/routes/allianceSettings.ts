import express from "express";
import type { Request, Response } from "express";
import {
  getAllianceSettingsFromConfig,
  parseAllianceConfig,
  resolveAllianceSettings,
} from "../utils/allianceSettings";
import type { RouteContext } from "../types";

type ConfigObject = Record<string, unknown>;

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
      const settings = getAllianceSettingsFromConfig(configText);
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

      const existing = parseAllianceConfig(ctx.queries.getAllianceConfig(allianceId));
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
      const settings = resolveAllianceSettings(nextConfig);
      ctx.ok(res, { settings });
    }
  );

  return router;
}

export {};
