import { useQuery } from "@tanstack/react-query";
import { fetchMembers, type Member } from "../api/members";

export const vikingMembersQueryKey = (profileId: string) =>
  ["vikingMembers", profileId] as const;

export function useVikingMembersQuery(profileId: string) {
  return useQuery<Member[]>({
    queryKey: vikingMembersQueryKey(profileId),
    queryFn: () => fetchMembers(profileId),
    enabled: Boolean(profileId)
  });
}
