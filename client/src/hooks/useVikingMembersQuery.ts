import { useQuery } from "@tanstack/react-query";
import { fetchVikings, type VikingMember } from "../api/vikings";

export const vikingMembersQueryKey = (profileId: string) =>
  ["vikingMembers", profileId] as const;

export function useVikingMembersQuery(profileId: string) {
  return useQuery<VikingMember[]>({
    queryKey: vikingMembersQueryKey(profileId),
    queryFn: () => fetchVikings(profileId),
    enabled: Boolean(profileId)
  });
}
