import { useQuery } from "@tanstack/react-query";
import type { AllianceSettings } from "@shared/types";
import { fetchAllianceSettings } from "../api/allianceSettings";

export const allianceSettingsQueryKey = (profileId: string) =>
  ["allianceSettings", profileId] as const;

export function useAllianceSettingsQuery(profileId: string, enabled: boolean) {
  return useQuery<AllianceSettings>({
    queryKey: allianceSettingsQueryKey(profileId),
    queryFn: () => fetchAllianceSettings(profileId),
    enabled: enabled && Boolean(profileId),
  });
}
