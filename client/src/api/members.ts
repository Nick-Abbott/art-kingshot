import { apiFetch } from "../apiClient";
import type { ApiResponse, Member, MembersPayload } from "@shared/types";

export type { Member };

export async function fetchMembers(allianceId: string): Promise<Member[]> {
  const res = await apiFetch("/api/members", { allianceId });
  const payload = res.data as ApiResponse<MembersPayload>;
  if (!payload || payload.ok === false) return [];
  return payload.data?.members || [];
}

export async function signupMember(
  allianceId: string,
  payload: Omit<Member, "playerName"> & { playerName: string }
) {
  const res = await apiFetch("/api/signup", {
    method: "POST",
    allianceId,
    body: payload
  });
  const data = res.data as ApiResponse<MembersPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function removeMember(allianceId: string, playerId: string) {
  const res = await apiFetch(`/api/members/${playerId}`, {
    method: "DELETE",
    allianceId
  });
  const data = res.data as ApiResponse<MembersPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}
