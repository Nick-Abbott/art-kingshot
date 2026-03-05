import type { Profile } from "@shared/types";
import { useAllianceProfileMutation } from "./useAllianceProfileMutations";

type Role = "member" | "alliance_admin";

type Status = "pending" | "active";

export function useAllianceAdminActions(
  selectedProfileId: string,
  allianceId: string | null
) {
  const allianceProfileMutation = useAllianceProfileMutation(
    selectedProfileId,
    allianceId
  );

  async function approveProfile(target: Profile, status: Status) {
    if (!selectedProfileId) return;
    await allianceProfileMutation.mutateAsync({
      targetProfileId: target.id,
      payload: { status }
    });
  }

  async function rejectProfile(target: Profile) {
    if (!selectedProfileId) return;
    await allianceProfileMutation.mutateAsync({
      targetProfileId: target.id,
      payload: { action: "reject" }
    });
  }

  async function setRole(target: Profile, role: Role) {
    if (!selectedProfileId) return;
    await allianceProfileMutation.mutateAsync({
      targetProfileId: target.id,
      payload: { role }
    });
  }

  return {
    approveProfile,
    rejectProfile,
    setRole
  };
}
