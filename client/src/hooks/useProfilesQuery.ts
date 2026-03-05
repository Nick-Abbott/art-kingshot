import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@shared/types";
import { fetchProfiles } from "../api/profile";

export const profilesQueryKey = ["profiles"] as const;

export function useProfilesQuery(enabled: boolean) {
  return useQuery<Profile[]>({
    queryKey: profilesQueryKey,
    queryFn: fetchProfiles,
    enabled
  });
}
