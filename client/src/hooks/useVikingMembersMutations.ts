import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeMember, signupMember, type Member } from "../api/members";
import { vikingMembersQueryKey } from "./useVikingMembersQuery";

type SavePayload = {
  playerId: string;
  troopCount: number;
  playerName: string;
  marchCount: number;
  power: number;
};

type SaveContext = {
  previous: Member[];
};

type DeleteContext = {
  previous: Member[];
};

export function useVikingMembersMutations(profileId: string) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation<Member[], Error, SavePayload, SaveContext>({
    mutationFn: (payload) => {
      if (!profileId) return Promise.resolve<Member[]>([]);
      return signupMember(profileId, payload);
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: vikingMembersQueryKey(profileId) });
      const previous =
        queryClient.getQueryData<Member[]>(vikingMembersQueryKey(profileId)) || [];
      queryClient.setQueryData<Member[]>(vikingMembersQueryKey(profileId), (prev) => {
        const current = prev || [];
        const next = current.filter((member) => member.playerId !== payload.playerId);
        next.push({
          playerId: payload.playerId,
          troopCount: payload.troopCount,
          playerName: payload.playerName,
          marchCount: payload.marchCount,
          power: payload.power
        });
        return next;
      });
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (!context) return;
      queryClient.setQueryData(vikingMembersQueryKey(profileId), context.previous);
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.setQueryData(vikingMembersQueryKey(profileId), data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: vikingMembersQueryKey(profileId) });
    }
  });

  const deleteMutation = useMutation<Member[], Error, string, DeleteContext>({
    mutationFn: (playerId) => {
      if (!profileId) return Promise.resolve<Member[]>([]);
      return removeMember(profileId, playerId);
    },
    onMutate: async (playerId) => {
      await queryClient.cancelQueries({ queryKey: vikingMembersQueryKey(profileId) });
      const previous =
        queryClient.getQueryData<Member[]>(vikingMembersQueryKey(profileId)) || [];
      queryClient.setQueryData<Member[]>(vikingMembersQueryKey(profileId), (prev) =>
        (prev || []).filter((member) => member.playerId !== playerId)
      );
      return { previous };
    },
    onError: (_error, _playerId, context) => {
      if (!context) return;
      queryClient.setQueryData(vikingMembersQueryKey(profileId), context.previous);
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.setQueryData(vikingMembersQueryKey(profileId), data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: vikingMembersQueryKey(profileId) });
    }
  });

  return {
    saveMember: (payload: SavePayload) => saveMutation.mutateAsync(payload),
    deleteMember: (playerId: string) => deleteMutation.mutateAsync(playerId)
  };
}
