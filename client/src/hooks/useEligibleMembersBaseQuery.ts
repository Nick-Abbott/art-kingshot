import { useQuery } from "@tanstack/react-query";
import type { EligibleMember } from "@shared/types";

type Options = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<EligibleMember[]>;
  enabled?: boolean;
};

export function useEligibleMembersBaseQuery({
  queryKey,
  queryFn,
  enabled = true
}: Options) {
  return useQuery<EligibleMember[]>({
    queryKey,
    queryFn,
    enabled
  });
}
