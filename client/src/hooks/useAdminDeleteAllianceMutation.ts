import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Alliance } from "@shared/types";
import { deleteAdminAlliance } from "../api/admin";
import { adminAlliancesQueryKey, adminAllianceProfilesQueryKey } from "./useAdminQueries";

type DeleteContext = {
  previous: Alliance[];
};

export function useAdminDeleteAllianceMutation(kingdomId: number | null) {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string, DeleteContext>({
    mutationFn: (allianceId) => deleteAdminAlliance(allianceId),
    onMutate: async (allianceId) => {
      await queryClient.cancelQueries({ queryKey: adminAlliancesQueryKey(kingdomId) });
      const previous =
        queryClient.getQueryData<Alliance[]>(adminAlliancesQueryKey(kingdomId)) ||
        [];
      queryClient.setQueryData<Alliance[]>(
        adminAlliancesQueryKey(kingdomId),
        (prev) => (prev || []).filter((item) => item.id !== allianceId)
      );
      queryClient.removeQueries({
        queryKey: adminAllianceProfilesQueryKey(allianceId)
      });
      return { previous };
    },
    onError: (_error, _allianceId, context) => {
      if (!context) return;
      queryClient.setQueryData(adminAlliancesQueryKey(kingdomId), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminAlliancesQueryKey(kingdomId) });
    }
  });
}
