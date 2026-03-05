import { updateAdminAllianceProfile } from "../api/admin";
import { adminAllianceProfilesQueryKey } from "./useAdminQueries";
import { useProfileListMutation } from "./useProfileListMutation";

export function useAdminAllianceProfileMutation(allianceId: string) {
  return useProfileListMutation({
    queryKey: adminAllianceProfilesQueryKey(allianceId),
    mutationFn: ({ profileId, payload }) =>
      updateAdminAllianceProfile(allianceId, profileId, payload)
  });
}
