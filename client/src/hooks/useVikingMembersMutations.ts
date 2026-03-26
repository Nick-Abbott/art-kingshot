import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeViking, signupViking, type VikingMember } from "../api/vikings";
import { vikingMembersQueryKey } from "./useVikingMembersQuery";
import { profilesQueryKey } from "./useProfilesQuery";

type SavePayload = {
  playerId: string;
  troopCount: number;
  playerName: string;
  marchCount: number;
  power: number;
};

type SaveContext = {
  previous: VikingMember[];
};

type DeleteContext = {
  previous: VikingMember[];
};

export function useVikingMembersMutations(profileId: string) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation<VikingMember[], Error, SavePayload, SaveContext>({
    mutationFn: (payload) => {
      if (!profileId) return Promise.resolve<VikingMember[]>([]);
      return signupViking(profileId, payload);
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: vikingMembersQueryKey(profileId) });
      const previous =
        queryClient.getQueryData<VikingMember[]>(vikingMembersQueryKey(profileId)) || [];
      queryClient.setQueryData<VikingMember[]>(vikingMembersQueryKey(profileId), (prev) => {
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
      queryClient.invalidateQueries({ queryKey: profilesQueryKey });
    }
  });

  const deleteMutation = useMutation<VikingMember[], Error, string, DeleteContext>({
    mutationFn: (playerId) => {
      if (!profileId) return Promise.resolve<VikingMember[]>([]);
      return removeViking(profileId, playerId);
    },
    onMutate: async (playerId) => {
      await queryClient.cancelQueries({ queryKey: vikingMembersQueryKey(profileId) });
      const previous =
        queryClient.getQueryData<VikingMember[]>(vikingMembersQueryKey(profileId)) || [];
      queryClient.setQueryData<VikingMember[]>(vikingMembersQueryKey(profileId), (prev) =>
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
      queryClient.invalidateQueries({ queryKey: profilesQueryKey });
    }
  });

  return {
    saveMember: (payload: SavePayload) => saveMutation.mutateAsync(payload),
    deleteMember: (playerId: string) => deleteMutation.mutateAsync(playerId)
  };
}
