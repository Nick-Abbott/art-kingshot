import { useEffect, useRef, useState } from "react";
import {
  fetchBearGroup,
  removeBearMember,
  resetBearGroup,
  upsertBearMember,
  type BearMember
} from "../api/bear";

export function useBear(allianceId: string) {
  const [bear1Members, setBear1Members] = useState<BearMember[]>([]);
  const [bear2Members, setBear2Members] = useState<BearMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!allianceId) return;
    setBear1Members([]);
    setBear2Members([]);
    setError("");
    const current = ++requestId.current;
    setLoading(true);
    Promise.all([
      fetchBearGroup(allianceId, "bear1"),
      fetchBearGroup(allianceId, "bear2")
    ])
      .then(([bear1, bear2]) => {
        if (current !== requestId.current) return;
        setBear1Members(bear1 || []);
        setBear2Members(bear2 || []);
      })
      .catch((err) => {
        if (current !== requestId.current) return;
        setError(err.message || "Failed to load bear rosters.");
      })
      .finally(() => {
        if (current !== requestId.current) return;
        setLoading(false);
      });
  }, [allianceId]);

  async function upsertMember(
    group: "bear1" | "bear2",
    payload: { playerId: string; playerName: string; rallySize: number }
  ) {
    if (!allianceId) return [];
    const updated = await upsertBearMember(allianceId, group, payload);
    if (group === "bear1") {
      setBear1Members(updated);
      setBear2Members((prev) =>
        prev.filter((member) => member.playerId !== payload.playerId)
      );
    } else {
      setBear2Members(updated);
      setBear1Members((prev) =>
        prev.filter((member) => member.playerId !== payload.playerId)
      );
    }
    return updated;
  }

  async function removeMember(group: "bear1" | "bear2", playerId: string) {
    if (!allianceId) return [];
    const updated = await removeBearMember(allianceId, group, playerId);
    if (group === "bear1") {
      setBear1Members(updated);
    } else {
      setBear2Members(updated);
    }
    return updated;
  }

  async function resetGroup(group: "bear1" | "bear2") {
    if (!allianceId) return [];
    const updated = await resetBearGroup(allianceId, group);
    if (group === "bear1") {
      setBear1Members(updated);
    } else {
      setBear2Members(updated);
    }
    return updated;
  }

  async function refreshGroup(group: "bear1" | "bear2") {
    if (!allianceId) return [];
    const updated = await fetchBearGroup(allianceId, group);
    if (group === "bear1") {
      setBear1Members(updated);
    } else {
      setBear2Members(updated);
    }
    return updated;
  }

  return {
    bear1Members,
    bear2Members,
    setBear1Members,
    setBear2Members,
    loading,
    error,
    upsertMember,
    removeMember,
    resetGroup,
    refreshGroup
  };
}
