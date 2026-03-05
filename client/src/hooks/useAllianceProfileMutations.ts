import type { AllianceProfileUpdateRequest } from "@shared/types";
import { updateAllianceProfile } from "../api/profile";
import { allianceProfilesQueryKey } from "./useAllianceProfilesQuery";
import { useProfileListMutation } from "./useProfileListMutation";

export function useAllianceProfileMutation(profileId: string, allianceId: string | null) {
  const mutation = useProfileListMutation({
    queryKey: allianceProfilesQueryKey(profileId),
    mutationFn: ({ profileId: targetProfileId, payload }) =>
      updateAllianceProfile(profileId, targetProfileId, payload),
    shouldRemove: (profile) => profile.allianceId !== allianceId
  });

  return {
    mutateAsync: ({
      targetProfileId,
      payload
    }: {
      targetProfileId: string;
      payload: AllianceProfileUpdateRequest;
    }) => mutation.mutateAsync({ profileId: targetProfileId, payload })
  };
}
