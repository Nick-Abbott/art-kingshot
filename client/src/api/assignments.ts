import { apiFetch } from "../apiClient";
import type { ApiResponse, AssignmentResult, ResultsPayload } from "@shared/types";

export type { AssignmentResult };

export async function runAssignments(profileId: string): Promise<AssignmentResult | null> {
  const res = await apiFetch("/api/run", { method: "POST", profileId });
  const payload = res.data as ApiResponse<AssignmentResult>;
  if (!payload || payload.ok === false) return null;
  return payload.data || null;
}

export async function fetchResults(profileId: string): Promise<AssignmentResult | null> {
  const res = await apiFetch("/api/results", { profileId });
  const payload = res.data as ApiResponse<ResultsPayload>;
  if (!payload || payload.ok === false) return null;
  return payload.data?.results || null;
}

export async function resetEvent(profileId: string) {
  await apiFetch("/api/reset", { method: "POST", profileId });
}
