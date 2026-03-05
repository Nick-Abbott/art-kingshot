import { apiFetch } from "../apiClient";
import type { ApiResponse, AssignmentResult, ResultsPayload } from "@shared/types";

export type { AssignmentResult };

export async function runAssignments(profileId: string): Promise<AssignmentResult | null> {
  const res = await apiFetch<ApiResponse<AssignmentResult>>("/api/run", {
    method: "POST",
    profileId
  });
  const payload = res.data;
  if (!payload || payload.ok === false) return null;
  return payload.data || null;
}

export async function fetchResults(profileId: string): Promise<AssignmentResult | null> {
  const res = await apiFetch<ApiResponse<ResultsPayload>>("/api/results", { profileId });
  const payload = res.data;
  if (!payload || payload.ok === false) return null;
  return payload.data?.results || null;
}

export async function resetEvent(profileId: string) {
  await apiFetch("/api/reset", { method: "POST", profileId });
}
