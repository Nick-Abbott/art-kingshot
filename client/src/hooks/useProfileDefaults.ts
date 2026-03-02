import { useEffect, useRef, useState } from "react";
import { fetchProfile, saveProfile, type ProfileDefaults } from "../api/profile";

export function useProfileDefaults(allianceId: string, editing: boolean) {
  const [profile, setProfile] = useState<ProfileDefaults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!allianceId) return;
    setProfile(null);
    setError("");
  }, [allianceId]);

  useEffect(() => {
    if (!editing) return;
    requestId.current += 1;
    setLoading(false);
  }, [editing]);

  useEffect(() => {
    if (!allianceId || editing) return;
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    fetchProfile(allianceId)
      .then((data) => {
        if (current !== requestId.current) return;
        if (editing) return;
        setProfile(data || null);
      })
      .catch((err) => {
        if (current !== requestId.current) return;
        setError(err.message || "Failed to load profile.");
        setProfile(null);
      })
      .finally(() => {
        if (current !== requestId.current) return;
        setLoading(false);
      });
  }, [allianceId, editing]);

  async function saveDefaults(payload: ProfileDefaults) {
    if (!allianceId) return null;
    const updated = await saveProfile(allianceId, payload);
    setProfile(updated);
    return updated;
  }

  return { profile, loading, error, saveDefaults, setProfile };
}
