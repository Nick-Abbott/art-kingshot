import { fetchEligibleMembers } from "../api/members";
import { useEligibleMembersBaseQuery } from "./useEligibleMembersBaseQuery";

export const eligibleMembersQueryKey = (profileId: string) =>
  ["eligibleMembers", profileId] as const;

export function useEligibleMembersQuery(profileId: string, enabled: boolean) {
  return useEligibleMembersBaseQuery({
    queryKey: eligibleMembersQueryKey(profileId),
    queryFn: () => fetchEligibleMembers(profileId),
    enabled: enabled && Boolean(profileId)
  });
}
