import { apiFetch } from "../apiClient";
import type {
  ApiResponse,
  EligibleMember,
  EligibleMembersPayload,
  Member,
  MembersPayload
} from "@shared/types";

export type { Member, EligibleMember };

export async function fetchMembers(profileId: string): Promise<Member[]> {
  const res = await apiFetch<ApiResponse<MembersPayload>>("/api/members", { profileId });
  const payload = res.data;
  if (!payload || payload.ok === false) return [];
  return payload.data?.members || [];
}

export async function signupMember(
  profileId: string,
  payload: Omit<Member, "playerName"> & { playerName: string }
) {
  const res = await apiFetch<ApiResponse<MembersPayload>>("/api/signup", {
    method: "POST",
    profileId,
    body: payload
  });
  const data = res.data;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function removeMember(profileId: string, playerId: string) {
  const res = await apiFetch<ApiResponse<MembersPayload>>(`/api/members/${playerId}`, {
    method: "DELETE",
    profileId
  });
  const data = res.data;
  if (!data || data.ok === false) return [];
  return data.data?.members || [];
}

export async function fetchEligibleMembers(profileId: string): Promise<EligibleMember[]> {
  const res = await apiFetch<ApiResponse<EligibleMembersPayload>>("/api/members/eligible", {
    profileId
  });
  const payload = res.data;
  if (!payload || payload.ok === false) return [];
  return payload.data?.members || [];
}
