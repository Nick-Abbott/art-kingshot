import { useEffect, useMemo, useState } from "react";
import type { Profile, User } from "@shared/types";

export function useProfileSelection(profiles: Profile[], user: User | null) {
  const [selectedProfileId, setSelectedProfileId] = useState(
    () => window.localStorage.getItem("selectedProfile") || ""
  );

  useEffect(() => {
    if (profiles.length === 0) {
      return;
    }
    const allowed = profiles.map((profile) => profile.id);
    if (selectedProfileId && allowed.includes(selectedProfileId)) return;
    const fallback = allowed[0] || "";
    setSelectedProfileId(fallback);
    if (fallback) {
      window.localStorage.setItem("selectedProfile", fallback);
    }
  }, [profiles, selectedProfileId]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );

  const canManage =
    Boolean(user?.isAppAdmin) || selectedProfile?.role === "alliance_admin";

  function updateProfileSelection(next: string) {
    setSelectedProfileId(next);
    window.localStorage.setItem("selectedProfile", next);
  }

  return {
    selectedProfileId,
    setSelectedProfileId: updateProfileSelection,
    selectedProfile,
    canManage
  };
}
