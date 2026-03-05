import type {
  AdminAlliancesPayload,
  AdminKingdomsPayload,
  AdminProfileLookupPayload,
  Alliance,
  AllianceProfileUpdateRequest,
  ApiResponse,
  Profile,
  ProfilesPayload,
} from "@shared/types";
import { apiFetch } from "../apiClient";

export async function fetchAdminKingdoms(): Promise<number[]> {
  const res = await apiFetch<ApiResponse<AdminKingdomsPayload>>("/api/admin/kingdoms");
  const data = res.data;
  if (!data || data.ok === false) return [];
  return data.data?.kingdoms || [];
}

export async function fetchAdminAlliances(kingdomId?: number | null): Promise<Alliance[]> {
  const url =
    typeof kingdomId === "number"
      ? `/api/admin/alliances?kingdomId=${kingdomId}`
      : "/api/admin/alliances";
  const res = await apiFetch<ApiResponse<AdminAlliancesPayload>>(url);
  const data = res.data;
  if (!data || data.ok === false) return [];
  return data.data?.alliances || [];
}

export async function fetchAdminAllianceProfiles(allianceId: string): Promise<Profile[]> {
  const res = await apiFetch<ApiResponse<ProfilesPayload>>(
    `/api/admin/alliances/${allianceId}/profiles`
  );
  const data = res.data;
  if (!data || data.ok === false) return [];
  return data.data?.profiles || [];
}

export async function updateAdminAllianceProfile(
  allianceId: string,
  profileId: string,
  payload: AllianceProfileUpdateRequest
): Promise<Profile | null> {
  const res = await apiFetch<ApiResponse<{ profile: Profile | null }>>(
    `/api/admin/alliances/${allianceId}/profiles/${profileId}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
  const data = res.data;
  if (!data || data.ok === false) return null;
  return data.data?.profile || null;
}

export async function deleteAdminAlliance(allianceId: string): Promise<boolean> {
  const res = await apiFetch<ApiResponse<{ ok: boolean }>>(
    `/api/admin/alliances/${allianceId}`,
    {
      method: "DELETE",
    }
  );
  const data = res.data;
  return Boolean(data && data.ok);
}

export async function fetchAdminProfile(profileId: string): Promise<Profile | null> {
  const res = await apiFetch<ApiResponse<AdminProfileLookupPayload>>(
    `/api/admin/profiles/${profileId}`
  );
  const data = res.data;
  if (!data || data.ok === false) return null;
  return data.data?.profile || null;
}

export async function deleteAdminProfile(profileId: string): Promise<boolean> {
  const res = await apiFetch<ApiResponse<{ ok: boolean }>>(`/api/admin/profiles/${profileId}`, {
    method: "DELETE",
  });
  const data = res.data;
  return Boolean(data && data.ok);
}
