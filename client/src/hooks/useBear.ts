import { useEffect, useRef, useState } from "react";
import {
  fetchBearGroup,
  removeBearMember,
  resetBearGroup,
  upsertBearMember,
  type BearMember
} from "../api/bear";

export function useBear(profileId: string) {
  const [bear1Members, setBear1Members] = useState<BearMember[]>([]);
  const [bear2Members, setBear2Members] = useState<BearMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!profileId) {
      setBear1Members([]);
      setBear2Members([]);
      setError("");
      setLoading(false);
      return;
    }
    setBear1Members([]);
    setBear2Members([]);
    setError("");
    const current = ++requestId.current;
    setLoading(true);
    Promise.all([
      fetchBearGroup(profileId, "bear1"),
      fetchBearGroup(profileId, "bear2")
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
  }, [profileId]);

  async function upsertMember(
    group: "bear1" | "bear2",
    payload: { playerId: string; playerName: string; rallySize: number }
  ) {
    if (!profileId) return [];
    const updated = await upsertBearMember(profileId, group, payload);
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
    if (!profileId) return [];
    const updated = await removeBearMember(profileId, group, playerId);
    if (group === "bear1") {
      setBear1Members(updated);
    } else {
      setBear2Members(updated);
    }
    return updated;
  }

  async function resetGroup(group: "bear1" | "bear2") {
    if (!profileId) return [];
    const updated = await resetBearGroup(profileId, group);
    if (group === "bear1") {
      setBear1Members(updated);
    } else {
      setBear2Members(updated);
    }
    return updated;
  }

  async function refreshGroup(group: "bear1" | "bear2") {
    if (!profileId) return [];
    const updated = await fetchBearGroup(profileId, group);
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
