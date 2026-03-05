import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@shared/types";

type Options = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<Profile[]>;
  enabled?: boolean;
};

export function useProfilesListQuery({ queryKey, queryFn, enabled = true }: Options) {
  return useQuery<Profile[]>({
    queryKey,
    queryFn,
    enabled
  });
}
