import { DEFAULT_ALLIANCE_SETTINGS } from "../../shared/allianceConfig";
import type { AllianceSettings } from "../../shared/types";

const ISO_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z$/;

type ConfigObject = Record<string, unknown>;

function isValidUtcDateTime(value: string): boolean {
  if (!ISO_UTC_REGEX.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

export function parseAllianceConfig(configText: string | null): ConfigObject {
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

export function resolveAllianceSettings(config: ConfigObject): AllianceSettings {
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

export function getAllianceSettingsFromConfig(
  configText: string | null
): AllianceSettings {
  return resolveAllianceSettings(parseAllianceConfig(configText));
}
