import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AllianceProfileUpdateRequest, Profile } from "@shared/types";
import {
  createAllianceProfile,
  createProfile,
  updateAllianceProfile,
  updateProfile
} from "../api/profile";
import { profilesQueryKey } from "./useProfilesQuery";

export function useCreateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProfile,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: profilesQueryKey });
      const previous = queryClient.getQueryData<Profile[]>(profilesQueryKey) || [];
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profilesQueryKey, context.previous);
      }
    },
    onSuccess: (profile) => {
      if (profile) {
        queryClient.setQueryData<Profile[]>(profilesQueryKey, (prev) => {
          const current = prev || [];
          const exists = current.some((item) => item.id === profile.id);
          return exists ? current : [...current, profile];
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: profilesQueryKey })
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      payload
    }: {
      profileId: string;
      payload: {
        playerId?: string | null;
        playerName?: string | null;
        playerAvatar?: string | null;
        kingdomId?: number | null;
        allianceId?: string | null;
        troopCount?: number | null;
        marchCount?: number | null;
        power?: number | null;
        rallySize?: number | null;
      };
    }) => updateProfile(profileId, payload),
    onMutate: async ({ profileId, payload }) => {
      await queryClient.cancelQueries({ queryKey: profilesQueryKey });
      const previous = queryClient.getQueryData<Profile[]>(profilesQueryKey) || [];
      queryClient.setQueryData<Profile[]>(profilesQueryKey, (prev) => {
        const current = prev || [];
        return current.map((item) =>
          item.id === profileId ? { ...item, ...payload } : item
        );
      });
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profilesQueryKey, context.previous);
      }
    },
    onSuccess: (profile) => {
      if (profile) {
        queryClient.setQueryData<Profile[]>(profilesQueryKey, (prev) => {
          const current = prev || [];
          return current.map((item) => (item.id === profile.id ? profile : item));
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: profilesQueryKey })
  });
}

export function useCreateAllianceProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      payload
    }: {
      profileId: string;
      payload: { playerId: string; playerName?: string | null; kingdomId?: number | null };
    }) => createAllianceProfile(profileId, payload),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: profilesQueryKey });
      const previous = queryClient.getQueryData<Profile[]>(profilesQueryKey) || [];
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profilesQueryKey, context.previous);
      }
    },
    onSuccess: (profile) => {
      if (profile) {
        queryClient.setQueryData<Profile[]>(profilesQueryKey, (prev) => {
          const current = prev || [];
          const exists = current.some((item) => item.id === profile.id);
          return exists ? current : [...current, profile];
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: profilesQueryKey })
  });
}

export function useUpdateAllianceProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      targetProfileId,
      payload
    }: {
      profileId: string;
      targetProfileId: string;
      payload: AllianceProfileUpdateRequest;
    }) => updateAllianceProfile(profileId, targetProfileId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profilesQueryKey })
  });
}
