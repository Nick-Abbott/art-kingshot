import { apiFetch } from "../apiClient";
import type { ApiResponse, LookupPayload } from "@shared/types";

export async function lookupPlayer(fid: string) {
  const res = await apiFetch("/api/player-lookup", {
    method: "POST",
    body: { fid }
  });
  const payload = res.data as ApiResponse<LookupPayload>;
  if (!payload || payload.ok === false) return null;
  return payload.data;
}
