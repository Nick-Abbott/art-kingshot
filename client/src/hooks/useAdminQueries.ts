import { useQuery } from "@tanstack/react-query";
import type { Alliance } from "@shared/types";
import {
  fetchAdminAllianceProfiles,
  fetchAdminAlliances,
  fetchAdminKingdoms
} from "../api/admin";
import { useProfilesListQuery } from "./useProfilesListQuery";

export const adminKingdomsQueryKey = ["adminKingdoms"] as const;
export const adminAlliancesQueryKey = (kingdomId: number | null) =>
  ["adminAlliances", kingdomId ?? "none"] as const;
export const adminAllianceProfilesQueryKey = (allianceId: string) =>
  ["adminAllianceProfiles", allianceId] as const;

export function useAdminKingdomsQuery(enabled: boolean) {
  return useQuery<number[]>({
    queryKey: adminKingdomsQueryKey,
    queryFn: () => fetchAdminKingdoms(),
    enabled
  });
}

export function useAdminAlliancesQuery(kingdomId: number | null, enabled: boolean) {
  return useQuery<Alliance[]>({
    queryKey: adminAlliancesQueryKey(kingdomId),
    queryFn: () => fetchAdminAlliances(kingdomId),
    enabled: enabled && kingdomId !== null
  });
}

export function useAdminAllianceProfilesQuery(allianceId: string, enabled: boolean) {
  return useProfilesListQuery({
    queryKey: adminAllianceProfilesQueryKey(allianceId),
    queryFn: () => fetchAdminAllianceProfiles(allianceId),
    enabled: enabled && Boolean(allianceId)
  });
}
