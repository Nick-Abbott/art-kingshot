import { apiFetch } from "../apiClient";
import type {
  ApiResponse,
  EligibleMember,
  EligibleMembersPayload,
  VikingMember,
  VikingsPayload
} from "@shared/types";

export type { VikingMember, EligibleMember };

export async function fetchVikings(profileId: string): Promise<VikingMember[]> {
  const res = await apiFetch<ApiResponse<VikingsPayload>>("/api/vikings", { profileId });
  const payload = res.data;
  if (!payload || payload.ok === false) return [];
  return payload.data?.members || [];
}

export async function signupViking(
  profileId: string,
  payload: Omit<VikingMember, "playerName"> & { playerName: string }
) {
  const res = await apiFetch<ApiResponse<VikingsPayload>>("/api/vikings", {
    method: "POST",
    profileId,
    body: payload
  });
  const data = res.data;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function removeViking(profileId: string, playerId: string) {
  const res = await apiFetch<ApiResponse<VikingsPayload>>(`/api/vikings/${playerId}`, {
    method: "DELETE",
    profileId
  });
  const data = res.data;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function fetchEligibleVikings(profileId: string): Promise<EligibleMember[]> {
  const res = await apiFetch<ApiResponse<EligibleMembersPayload>>("/api/vikings/eligible", {
    profileId
  });
  const payload = res.data;
  if (!payload || payload.ok === false) return [];
  return payload.data?.members || [];
}
