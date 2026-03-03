import { apiFetch } from "../apiClient";
import type { ApiResponse, Member, MembersPayload } from "@shared/types";

export type { Member };

export async function fetchMembers(profileId: string): Promise<Member[]> {
  const res = await apiFetch("/api/members", { profileId });
  const payload = res.data as ApiResponse<MembersPayload>;
  if (!payload || payload.ok === false) return [];
  return payload.data?.members || [];
}

export async function signupMember(
  profileId: string,
  payload: Omit<Member, "playerName"> & { playerName: string }
) {
  const res = await apiFetch("/api/signup", {
    method: "POST",
    profileId,
    body: payload
  });
  const data = res.data as ApiResponse<MembersPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function removeMember(profileId: string, playerId: string) {
  const res = await apiFetch(`/api/members/${playerId}`, {
    method: "DELETE",
    profileId
  });
  const data = res.data as ApiResponse<MembersPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}
