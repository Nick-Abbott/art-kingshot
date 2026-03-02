import { useEffect, useMemo, useState } from "react";

type Membership = {
  allianceId: string;
  role: string;
  allianceName?: string;
};

type User = {
  isAppAdmin?: number | boolean;
};

export function useAlliance(memberships: Membership[], user: User | null) {
  const [selectedAlliance, setSelectedAlliance] = useState(
    () => window.localStorage.getItem("selectedAlliance") || ""
  );

  useEffect(() => {
    const allowed = memberships.map((item) => item.allianceId);
    if (selectedAlliance && allowed.includes(selectedAlliance)) return;
    const fallback = allowed[0] || "";
    setSelectedAlliance(fallback);
    if (fallback) {
      window.localStorage.setItem("selectedAlliance", fallback);
    }
  }, [memberships, selectedAlliance]);

  const currentMembership = useMemo(
    () => memberships.find((item) => item.allianceId === selectedAlliance) || null,
    [memberships, selectedAlliance]
  );

  const canManage =
    Boolean(user?.isAppAdmin) || currentMembership?.role === "alliance_admin";

  function updateAlliance(next: string) {
    setSelectedAlliance(next);
    window.localStorage.setItem("selectedAlliance", next);
  }

  return {
    selectedAlliance,
    setSelectedAlliance: updateAlliance,
    currentMembership,
    canManage
  };
}
