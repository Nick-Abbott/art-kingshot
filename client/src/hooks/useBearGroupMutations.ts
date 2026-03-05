import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  removeBearMember,
  resetBearGroup,
  type BearMember,
  upsertBearMember
} from "../api/bear";
import { bearGroupQueryKey } from "./useBearGroupQuery";

type BearGroup = "bear1" | "bear2";

const otherGroup = (group: BearGroup) => (group === "bear1" ? "bear2" : "bear1");

export function useBearGroupMutations(profileId: string) {
  const queryClient = useQueryClient();

  type UpsertVariables = {
    group: BearGroup;
    payload: { playerId: string; playerName: string; rallySize: number };
  };
  type UpsertContext = {
    previousGroup: BearMember[];
    previousOther: BearMember[];
    group: BearGroup;
    other: BearGroup;
  };

  const upsertMutation = useMutation<BearMember[], Error, UpsertVariables, UpsertContext>({
    mutationFn: ({
      group,
      payload
    }) => {
      if (!profileId) return Promise.resolve<BearMember[]>([]);
      return upsertBearMember(profileId, group, payload);
    },
    onMutate: async ({ group, payload }) => {
      const other = otherGroup(group);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: bearGroupQueryKey(profileId, group) }),
        queryClient.cancelQueries({ queryKey: bearGroupQueryKey(profileId, other) })
      ]);

      const previousGroup =
        queryClient.getQueryData<BearMember[]>(bearGroupQueryKey(profileId, group)) ||
        [];
      const previousOther =
        queryClient.getQueryData<BearMember[]>(bearGroupQueryKey(profileId, other)) ||
        [];

      queryClient.setQueryData<BearMember[]>(bearGroupQueryKey(profileId, group), (prev) => {
        const current = prev || [];
        const next = current.filter((member) => member.playerId !== payload.playerId);
        next.push({
          playerId: payload.playerId,
          playerName: payload.playerName,
          rallySize: payload.rallySize
        });
        return next;
      });
      queryClient.setQueryData<BearMember[]>(bearGroupQueryKey(profileId, other), (prev) =>
        (prev || []).filter((member) => member.playerId !== payload.playerId)
      );

      return { previousGroup, previousOther, group, other };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(
        bearGroupQueryKey(profileId, context.group),
        context.previousGroup
      );
      queryClient.setQueryData(
        bearGroupQueryKey(profileId, context.other),
        context.previousOther
      );
    },
    onSuccess: (data, variables) => {
      if (!data) return;
      const other = otherGroup(variables.group);
      queryClient.setQueryData(bearGroupQueryKey(profileId, variables.group), data);
      queryClient.setQueryData<BearMember[]>(bearGroupQueryKey(profileId, other), (prev) =>
        (prev || []).filter((member) => member.playerId !== variables.payload.playerId)
      );
    },
    onSettled: (_data, _error, variables) => {
      if (!variables) return;
      const other = otherGroup(variables.group);
      queryClient.invalidateQueries({
        queryKey: bearGroupQueryKey(profileId, variables.group)
      });
      queryClient.invalidateQueries({
        queryKey: bearGroupQueryKey(profileId, other)
      });
    }
  });

  const removeMutation = useMutation({
    mutationFn: ({ group, playerId }: { group: BearGroup; playerId: string }) => {
      if (!profileId) return Promise.resolve<BearMember[]>([]);
      return removeBearMember(profileId, group, playerId);
    },
    onMutate: async ({ group, playerId }) => {
      await queryClient.cancelQueries({ queryKey: bearGroupQueryKey(profileId, group) });
      const previous =
        queryClient.getQueryData<BearMember[]>(bearGroupQueryKey(profileId, group)) ||
        [];
      queryClient.setQueryData<BearMember[]>(bearGroupQueryKey(profileId, group), (prev) =>
        (prev || []).filter((member) => member.playerId !== playerId)
      );
      return { previous, group };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(bearGroupQueryKey(profileId, context.group), context.previous);
    },
    onSuccess: (data, variables) => {
      if (!data) return;
      queryClient.setQueryData(bearGroupQueryKey(profileId, variables.group), data);
    },
    onSettled: (_data, _error, variables) => {
      if (!variables) return;
      queryClient.invalidateQueries({
        queryKey: bearGroupQueryKey(profileId, variables.group)
      });
    }
  });

  const resetMutation = useMutation({
    mutationFn: ({ group }: { group: BearGroup }) => {
      if (!profileId) return Promise.resolve<BearMember[]>([]);
      return resetBearGroup(profileId, group);
    },
    onMutate: async ({ group }) => {
      await queryClient.cancelQueries({ queryKey: bearGroupQueryKey(profileId, group) });
      const previous =
        queryClient.getQueryData<BearMember[]>(bearGroupQueryKey(profileId, group)) ||
        [];
      queryClient.setQueryData<BearMember[]>(bearGroupQueryKey(profileId, group), []);
      return { previous, group };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(bearGroupQueryKey(profileId, context.group), context.previous);
    },
    onSuccess: (data, variables) => {
      if (!data) return;
      queryClient.setQueryData(bearGroupQueryKey(profileId, variables.group), data);
    },
    onSettled: (_data, _error, variables) => {
      if (!variables) return;
      queryClient.invalidateQueries({
        queryKey: bearGroupQueryKey(profileId, variables.group)
      });
    }
  });

  return {
    upsertMember: (group: BearGroup, payload: {
      playerId: string;
      playerName: string;
      rallySize: number;
    }) => upsertMutation.mutateAsync({ group, payload }),
    removeMember: (group: BearGroup, playerId: string) =>
      removeMutation.mutateAsync({ group, playerId }),
    resetGroup: (group: BearGroup) => resetMutation.mutateAsync({ group })
  };
}
