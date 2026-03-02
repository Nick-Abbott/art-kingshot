import { apiFetch } from "../apiClient";
import type { ApiResponse, AssignmentResult, ResultsPayload } from "@shared/types";

export type { AssignmentResult };

export async function runAssignments(allianceId: string): Promise<AssignmentResult | null> {
  const res = await apiFetch("/api/run", { method: "POST", allianceId });
  const payload = res.data as ApiResponse<AssignmentResult>;
  if (!payload || payload.ok === false) return null;
  return payload.data || null;
}

export async function fetchResults(allianceId: string): Promise<AssignmentResult | null> {
  const res = await apiFetch("/api/results", { allianceId });
  const payload = res.data as ApiResponse<ResultsPayload>;
  if (!payload || payload.ok === false) return null;
  return payload.data?.results || null;
}

export async function resetEvent(allianceId: string) {
  await apiFetch("/api/reset", { method: "POST", allianceId });
}
