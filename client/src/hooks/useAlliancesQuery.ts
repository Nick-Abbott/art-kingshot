import { useQuery } from "@tanstack/react-query";
import type { Alliance } from "@shared/types";
import { fetchAlliances } from "../api/alliances";

export const alliancesQueryKey = (kingdomId: number | null) =>
  ["alliances", kingdomId ?? "none"] as const;

export function useAlliancesQuery(kingdomId: number | null, enabled: boolean) {
  return useQuery<Alliance[]>({
    queryKey: alliancesQueryKey(kingdomId),
    queryFn: () => (kingdomId ? fetchAlliances(kingdomId) : Promise.resolve([])),
    enabled: enabled && kingdomId !== null
  });
}
