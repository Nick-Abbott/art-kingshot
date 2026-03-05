import { fetchEligibleBearMembers } from "../api/bear";
import { useEligibleMembersBaseQuery } from "./useEligibleMembersBaseQuery";

export const eligibleBearMembersQueryKey = (profileId: string) =>
  ["eligibleBearMembers", profileId] as const;

export function useEligibleBearMembersQuery(profileId: string, enabled: boolean) {
  return useEligibleMembersBaseQuery({
    queryKey: eligibleBearMembersQueryKey(profileId),
    queryFn: () => fetchEligibleBearMembers(profileId),
    enabled: enabled && Boolean(profileId)
  });
}
