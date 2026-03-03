import { apiFetch } from "../apiClient";
import type { ApiResponse, BearGroup, BearMember, BearPayload } from "@shared/types";

export type { BearMember, BearGroup };

export async function fetchBearGroup(
  profileId: string,
  group: BearGroup
): Promise<BearMember[]> {
  const res = await apiFetch(`/api/bear/${group}`, { profileId });
  const payload = res.data as ApiResponse<BearPayload>;
  if (!payload || payload.ok === false) return [];
  return payload.data?.members || [];
}

export async function upsertBearMember(
  profileId: string,
  group: BearGroup,
  payload: { playerId: string; playerName: string; rallySize: number }
): Promise<BearMember[]> {
  const res = await apiFetch(`/api/bear/${group}`, {
    method: "POST",
    profileId,
    body: payload
  });
  const data = res.data as ApiResponse<BearPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function resetBearGroup(
  profileId: string,
  group: BearGroup
): Promise<BearMember[]> {
  const res = await apiFetch(`/api/bear/${group}`, {
    method: "DELETE",
    profileId
  });
  const data = res.data as ApiResponse<BearPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function removeBearMember(
  profileId: string,
  group: BearGroup,
  playerId: string
): Promise<BearMember[]> {
  const res = await apiFetch(`/api/bear/${group}/${playerId}`, {
    method: "DELETE",
    profileId
  });
  const data = res.data as ApiResponse<BearPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}
