import { fetchAllianceProfiles } from "../api/profile";
import { useProfilesListQuery } from "./useProfilesListQuery";

export const allianceProfilesQueryKey = (profileId: string) =>
  ["allianceProfiles", profileId] as const;

export function useAllianceProfilesQuery(profileId: string, enabled: boolean) {
  return useProfilesListQuery({
    queryKey: allianceProfilesQueryKey(profileId),
    queryFn: () => fetchAllianceProfiles(profileId),
    enabled: enabled && Boolean(profileId)
  });
}
