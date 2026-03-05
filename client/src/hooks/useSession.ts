import { useCallback, useEffect, useState } from "react";
import { fetchSession, logout as logoutSession } from "../api/session";
import type { Profile, User } from "@shared/types";

export function useSession() {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const res = await fetchSession();
      if (res.status === 401) {
        setUser(null);
        setProfiles([]);
        setStatus("unauthenticated");
        return;
      }
      if (res.error) {
        setError(res.error);
        setStatus("unauthenticated");
        return;
      }
      setUser(res.data?.user || null);
      setProfiles(res.data?.profiles || []);
      setStatus("authenticated");
    } catch {
      setError("Failed to load session.");
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await logoutSession();
    setUser(null);
    setProfiles([]);
    setStatus("unauthenticated");
  }, []);

  return {
    status,
    user,
    profiles,
    setProfiles,
    error,
    setError,
    refresh,
    logout
  };
}
