import { apiFetch } from "../apiClient";
import type {
  ApiResponse,
  AlliancesPayload,
  Alliance,
  AllianceCreatePayload,
  Profile,
} from "@shared/types";

export async function fetchAlliances(
  kingdomId?: number | null
): Promise<Alliance[]> {
  const query =
    Number.isFinite(Number(kingdomId)) ? `?kingdomId=${Number(kingdomId)}` : "";
  const res = await apiFetch<ApiResponse<AlliancesPayload>>(`/api/alliances/list${query}`);
  const payload = res.data;
  if (!payload || payload.ok === false) return [];
  return payload.data?.alliances || [];
}

export async function createAlliance(payload: {
  tag: string;
  name: string;
  profileId: string;
}): Promise<{ alliance: Alliance | null; profile: Profile | null }> {
  const res = await apiFetch<ApiResponse<AllianceCreatePayload>>("/api/alliances", {
    method: "POST",
    profileId: payload.profileId,
    body: { tag: payload.tag, name: payload.name },
  });
  const data = res.data;
  if (!data || data.ok === false) return { alliance: null, profile: null };
  return {
    alliance: data.data?.alliance || null,
    profile: data.data?.profile || null,
  };
}

export async function deleteAlliance(payload: {
  allianceId: string;
  profileId: string;
}): Promise<boolean> {
  const res = await apiFetch(`/api/alliances/${payload.allianceId}`, {
    method: "DELETE",
    profileId: payload.profileId,
    allowNonOk: true,
  });
  return res.ok;
}
