import { apiFetch } from "../apiClient";
import type { ApiResponse, ProfileDefaults, ProfilePayload } from "@shared/types";

export type { ProfileDefaults };

export async function fetchProfile(allianceId: string): Promise<ProfileDefaults | null> {
  const res = await apiFetch("/api/me/profile", { allianceId });
  const payload = res.data as ApiResponse<ProfilePayload>;
  if (!payload || payload.ok === false) return null;
  return payload.data?.profile || null;
}

export async function saveProfile(
  allianceId: string,
  payload: ProfileDefaults
): Promise<ProfileDefaults | null> {
  const res = await apiFetch("/api/me/profile", {
    method: "POST",
    allianceId,
    body: payload
  });
  const data = res.data as ApiResponse<ProfilePayload>;
  if (!data || data.ok === false) return null;
  return data.data?.profile || null;
}
