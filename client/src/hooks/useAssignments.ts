import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchResults, resetEvent, runAssignments } from "../api/assignments";
import type { AssignmentResult } from "../api/assignments";

export function useAssignments(profileId: string) {
  const queryClient = useQueryClient();
  const assignmentsQuery = useQuery<AssignmentResult | null>({
    queryKey: ["assignments", profileId],
    queryFn: () => fetchResults(profileId),
    enabled: Boolean(profileId)
  });

  const runMutation = useMutation({
    mutationFn: () => {
      if (!profileId) return Promise.resolve<AssignmentResult | null>(null);
      return runAssignments(profileId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["assignments", profileId], data || null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", profileId] });
    }
  });

  const resetMutation = useMutation({
    mutationFn: () => {
      if (!profileId) return Promise.resolve(null);
      return resetEvent(profileId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["assignments", profileId] });
      queryClient.setQueryData(["assignments", profileId], null);
    },
    onSuccess: () => {
      queryClient.setQueryData(["assignments", profileId], null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", profileId] });
    }
  });

  const results = assignmentsQuery.data || null;
  const loading = assignmentsQuery.isLoading;
  const error = (assignmentsQuery.error as Error | null)?.message || "";

  return {
    results,
    loading,
    error,
    run: () => runMutation.mutateAsync(),
    reset: () => resetMutation.mutateAsync()
  };
}
