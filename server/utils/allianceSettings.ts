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
    vikingNextTimes: {
      viking1: DEFAULT_ALLIANCE_SETTINGS.vikingNextTimes.viking1,
      viking2: DEFAULT_ALLIANCE_SETTINGS.vikingNextTimes.viking2,
    },
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

  const vikingNextTimes = config.vikingNextTimes;
  if (vikingNextTimes && typeof vikingNextTimes === "object") {
    const viking1 = (vikingNextTimes as { viking1?: unknown }).viking1;
    const viking2 = (vikingNextTimes as { viking2?: unknown }).viking2;
    if (typeof viking1 === "string" && typeof viking2 === "string") {
      if (isValidUtcDateTime(viking1) && isValidUtcDateTime(viking2)) {
        settings.vikingNextTimes = {
          viking1,
          viking2,
        };
      }
    }
  } else {
    const legacyVikingNext = config.vikingNextTime;
    if (typeof legacyVikingNext === "string" && isValidUtcDateTime(legacyVikingNext)) {
      const base = Date.parse(legacyVikingNext);
      const viking2 =
        Number.isFinite(base)
          ? new Date(base + 2 * 24 * 60 * 60 * 1000).toISOString()
          : DEFAULT_ALLIANCE_SETTINGS.vikingNextTimes.viking2;
      settings.vikingNextTimes = {
        viking1: legacyVikingNext,
        viking2,
      };
    }
  }

  return settings;
}

export function getAllianceSettingsFromConfig(
  configText: string | null
): AllianceSettings {
  return resolveAllianceSettings(parseAllianceConfig(configText));
}
