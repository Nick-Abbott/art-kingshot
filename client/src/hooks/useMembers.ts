import type { Member } from "../api/members";
import { useVikingMembersMutations } from "./useVikingMembersMutations";
import { useVikingMembersQuery } from "./useVikingMembersQuery";

export function useMembers(profileId: string) {
  const membersQuery = useVikingMembersQuery(profileId);
  const { saveMember, deleteMember } = useVikingMembersMutations(profileId);
  const members = membersQuery.data || [];
  const loading = membersQuery.isLoading;
  const error = (membersQuery.error as Error | null)?.message || "";

  return {
    members,
    loading,
    error,
    saveMember,
    deleteMember
  };
}
