import { apiFetch } from "../apiClient";
import type { ApiResponse, Profile, ProfilePayload, ProfilesPayload } from "@shared/types";

export async function fetchProfiles(): Promise<Profile[]> {
  const res = await apiFetch("/api/profiles");
  const payload = res.data as ApiResponse<ProfilesPayload>;
  if (!payload || payload.ok === false) return [];
  return payload.data?.profiles || [];
}

export async function createProfile(payload: {
  playerId: string;
  playerName?: string | null;
  playerAvatar?: string | null;
  kingdomId?: number | null;
  allianceId?: string | null;
  troopCount?: number | null;
  marchCount?: number | null;
  power?: number | null;
  rallySize?: number | null;
}): Promise<Profile | null> {
  const res = await apiFetch("/api/profiles", { method: "POST", body: payload });
  const data = res.data as ApiResponse<ProfilePayload>;
  if (!data || data.ok === false) return null;
  return data.data?.profile || null;
}

export async function updateProfile(
  profileId: string,
  payload: {
    playerId?: string | null;
    playerName?: string | null;
    playerAvatar?: string | null;
    kingdomId?: number | null;
    allianceId?: string | null;
    troopCount?: number | null;
    marchCount?: number | null;
    power?: number | null;
    rallySize?: number | null;
  }
): Promise<Profile | null> {
  const res = await apiFetch(`/api/profiles/${profileId}`, {
    method: "PATCH",
    body: payload
  });
  const data = res.data as ApiResponse<ProfilePayload>;
  if (!data || data.ok === false) return null;
  return data.data?.profile || null;
}

export async function fetchAllianceProfiles(profileId: string): Promise<Profile[]> {
  const res = await apiFetch("/api/alliance/profiles", { profileId });
  const data = res.data as ApiResponse<ProfilesPayload>;
  if (!data || data.ok === false) return [];
  return data.data?.profiles || [];
}

export async function updateAllianceProfile(
  profileId: string,
  targetProfileId: string,
  payload: { status?: "pending" | "active"; role?: "member" | "alliance_admin" }
): Promise<Profile | null> {
  const res = await apiFetch(`/api/alliance/profiles/${targetProfileId}`, {
    method: "PATCH",
    profileId,
    body: payload
  });
  const data = res.data as ApiResponse<ProfilePayload>;
  if (!data || data.ok === false) return null;
  return data.data?.profile || null;
}
