import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AllianceProfileUpdateRequest, Profile } from "@shared/types";

type MutationFn = (variables: {
  profileId: string;
  payload: AllianceProfileUpdateRequest;
}) => Promise<Profile | null>;

type Options = {
  queryKey: readonly unknown[];
  mutationFn: MutationFn;
  shouldRemove?: (profile: Profile, variables: {
    profileId: string;
    payload: AllianceProfileUpdateRequest;
  }) => boolean;
};

export function useProfileListMutation({ queryKey, mutationFn, shouldRemove }: Options) {
  const queryClient = useQueryClient();
  return useMutation<
    Profile | null,
    Error,
    { profileId: string; payload: AllianceProfileUpdateRequest },
    { previous: Profile[] }
  >({
    mutationFn,
    onMutate: async ({ profileId, payload }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Profile[]>(queryKey) || [];

      if (payload.action === "reject") {
        queryClient.setQueryData<Profile[]>(queryKey, (prev) =>
          (prev || []).filter((item) => item.id !== profileId)
        );
      } else {
        queryClient.setQueryData<Profile[]>(queryKey, (prev) =>
          (prev || []).map((item) =>
            item.id === profileId
              ? {
                  ...item,
                  status: payload.status ?? item.status,
                  role: payload.role ?? item.role
                }
              : item
          )
        );
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (updated, variables) => {
      if (!updated) return;
      const remove =
        variables.payload.action === "reject" ||
        (shouldRemove ? shouldRemove(updated, variables) : false);
      queryClient.setQueryData<Profile[]>(queryKey, (prev) => {
        const current = prev || [];
        if (remove) {
          return current.filter((item) => item.id !== updated.id);
        }
        return current.map((item) => (item.id === updated.id ? updated : item));
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    }
  });
}
