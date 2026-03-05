import { useQuery } from "@tanstack/react-query";
import { fetchBearGroup, type BearMember } from "../api/bear";

export const bearGroupQueryKey = (
  profileId: string,
  group: "bear1" | "bear2"
) => ["bearGroup", profileId, group] as const;

export function useBearGroupQuery(profileId: string, group: "bear1" | "bear2") {
  return useQuery<BearMember[]>({
    queryKey: bearGroupQueryKey(profileId, group),
    queryFn: () => fetchBearGroup(profileId, group),
    enabled: Boolean(profileId)
  });
}
