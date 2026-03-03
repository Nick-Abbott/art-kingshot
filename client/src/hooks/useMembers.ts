import { useEffect, useRef, useState } from "react";
import { fetchMembers, removeMember, signupMember, type Member } from "../api/members";

export function useMembers(profileId: string) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!profileId) {
      setMembers([]);
      setError("");
      setLoading(false);
      return;
    }
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    fetchMembers(profileId)
      .then((data) => {
        if (current !== requestId.current) return;
        setMembers(data || []);
      })
      .catch((err) => {
        if (current !== requestId.current) return;
        setError(err.message || "Failed to load members.");
      })
      .finally(() => {
        if (current !== requestId.current) return;
        setLoading(false);
      });
  }, [profileId]);

  async function saveMember(payload: {
    playerId: string;
    troopCount: number;
    playerName: string;
    marchCount: number;
    power: number;
  }) {
    if (!profileId) return [];
    try {
      const updated = await signupMember(profileId, payload);
      setMembers(updated);
      setError("");
      return updated;
    } catch (err: any) {
      setError(err?.message || "Failed to save member.");
      return [];
    }
  }

  async function deleteMember(playerId: string) {
    if (!profileId) return [];
    try {
      const updated = await removeMember(profileId, playerId);
      setMembers(updated);
      setError("");
      return updated;
    } catch (err: any) {
      setError(err?.message || "Failed to remove member.");
      return [];
    }
  }

  return {
    members,
    setMembers,
    loading,
    error,
    saveMember,
    deleteMember
  };
}
