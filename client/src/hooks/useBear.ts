import { useBearGroupMutations } from "./useBearGroupMutations";
import { useBearGroupQuery } from "./useBearGroupQuery";

export function useBear(profileId: string) {
  const bear1Query = useBearGroupQuery(profileId, "bear1");
  const bear2Query = useBearGroupQuery(profileId, "bear2");
  const { upsertMember, removeMember, resetGroup } = useBearGroupMutations(profileId);

  const bear1Members = bear1Query.data || [];
  const bear2Members = bear2Query.data || [];
  const loading = bear1Query.isLoading || bear2Query.isLoading;
  const error =
    (bear1Query.error as Error | null)?.message ||
    (bear2Query.error as Error | null)?.message ||
    "";

  return {
    bear1Members,
    bear2Members,
    loading,
    error,
    upsertMember,
    removeMember,
    resetGroup
  };
}
