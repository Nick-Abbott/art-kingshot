import { apiFetch } from "../apiClient";
import type { ApiResponse, BearGroup, BearMember, BearPayload } from "@shared/types";

export type { BearMember, BearGroup };

export async function fetchBearGroup(
  allianceId: string,
  group: BearGroup
): Promise<BearMember[]> {
  const res = await apiFetch(`/api/bear/${group}`, { allianceId });
  const payload = res.data as ApiResponse<BearPayload>;
  if (!payload || payload.ok === false) return [];
  return payload.data?.members || [];
}

export async function upsertBearMember(
  allianceId: string,
  group: BearGroup,
  payload: { playerId: string; playerName: string; rallySize: number }
): Promise<BearMember[]> {
  const res = await apiFetch(`/api/bear/${group}`, {
    method: "POST",
    allianceId,
    body: payload
  });
  const data = res.data as ApiResponse<BearPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function resetBearGroup(
  allianceId: string,
  group: BearGroup
): Promise<BearMember[]> {
  const res = await apiFetch(`/api/bear/${group}`, {
    method: "DELETE",
    allianceId
  });
  const data = res.data as ApiResponse<BearPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function removeBearMember(
  allianceId: string,
  group: BearGroup,
  playerId: string
): Promise<BearMember[]> {
  const res = await apiFetch(`/api/bear/${group}/${playerId}`, {
    method: "DELETE",
    allianceId
  });
  const data = res.data as ApiResponse<BearPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}
