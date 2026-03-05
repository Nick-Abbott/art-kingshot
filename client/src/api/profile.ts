import { apiFetch } from "../apiClient";
import type {
  AllianceProfileUpdateRequest,
  ApiResponse,
  Profile,
  ProfilePayload,
  ProfilesPayload
} from "@shared/types";

export async function fetchProfiles(): Promise<Profile[]> {
  const res = await apiFetch<ApiResponse<ProfilesPayload>>("/api/profiles");
  const payload = res.data;
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
  const res = await apiFetch<ApiResponse<ProfilePayload>>("/api/profiles", {
    method: "POST",
    body: payload
  });
  const data = res.data;
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
  const res = await apiFetch<ApiResponse<ProfilePayload>>(`/api/profiles/${profileId}`, {
    method: "PATCH",
    body: payload
  });
  const data = res.data;
  if (!data || data.ok === false) return null;
  return data.data?.profile || null;
}

export async function fetchAllianceProfiles(profileId: string): Promise<Profile[]> {
  const res = await apiFetch<ApiResponse<ProfilesPayload>>("/api/alliance/profiles", {
    profileId
  });
  const data = res.data;
  if (!data || data.ok === false) return [];
  return data.data?.profiles || [];
}

export async function updateAllianceProfile(
  profileId: string,
  targetProfileId: string,
  payload: AllianceProfileUpdateRequest
): Promise<Profile | null> {
  const res = await apiFetch<ApiResponse<ProfilePayload>>(
    `/api/alliance/profiles/${targetProfileId}`,
    {
      method: "PATCH",
      profileId,
      body: payload
    }
  );
  const data = res.data;
  if (!data || data.ok === false) return null;
  return data.data?.profile || null;
}

export async function createAllianceProfile(
  profileId: string,
  payload: { playerId: string; playerName?: string | null; kingdomId?: number | null }
): Promise<Profile | null> {
  const res = await apiFetch<ApiResponse<ProfilePayload>>("/api/alliance/profiles", {
    method: "POST",
    profileId,
    body: payload
  });
  const data = res.data;
  if (!data || data.ok === false) return null;
  return data.data?.profile || null;
}
