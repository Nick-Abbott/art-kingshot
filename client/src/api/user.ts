import type { ApiResponse, Profile, ProfilePayload } from "@shared/types";
import { apiFetch } from "../apiClient";

export async function updateAssignmentDmOptIn(
  profileId: string,
  enabled: boolean
): Promise<Profile | null> {
  const res = await apiFetch<ApiResponse<ProfilePayload>>(
    `/api/profiles/${profileId}/assignments-opt-in`,
    {
      method: "POST",
      body: { enabled }
    }
  );
  if (!res.ok) return null;
  if (!res.data || res.data.ok === false) return null;
  return res.data.data?.profile ?? null;
}
