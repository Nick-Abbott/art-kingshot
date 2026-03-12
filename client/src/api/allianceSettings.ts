import { apiFetch } from "../apiClient";
import type {
  ApiResponse,
  AllianceSettings,
  AllianceSettingsPayload,
  AllianceSettingsUpdateRequest,
} from "@shared/types";
import { DEFAULT_ALLIANCE_SETTINGS } from "@shared/allianceConfig";

export async function fetchAllianceSettings(profileId: string): Promise<AllianceSettings> {
  const res = await apiFetch<ApiResponse<AllianceSettingsPayload>>(
    "/api/alliance/settings",
    { profileId, allowNonOk: true }
  );
  const payload = res.data;
  if (!payload || payload.ok === false) return DEFAULT_ALLIANCE_SETTINGS;
  return payload.data?.settings || DEFAULT_ALLIANCE_SETTINGS;
}

export async function updateAllianceSettings(
  profileId: string,
  settings: AllianceSettingsUpdateRequest
): Promise<AllianceSettings | null> {
  const res = await apiFetch<ApiResponse<AllianceSettingsPayload>>(
    "/api/alliance/settings",
    {
      method: "PUT",
      profileId,
      body: settings,
    }
  );
  const payload = res.data;
  if (!payload || payload.ok === false) return null;
  return payload.data?.settings || null;
}
