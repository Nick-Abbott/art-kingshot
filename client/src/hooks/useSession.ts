import { useCallback, useEffect, useState } from "react";
import { fetchSession, logout as logoutSession } from "../api/session";

type Membership = {
  userId: string;
  allianceId: string;
  role: string;
  allianceName?: string;
};

type User = {
  id: string;
  discordId: string;
  displayName: string;
  avatar?: string | null;
  isAppAdmin?: number | boolean;
};

export function useSession() {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const res = await fetchSession();
      if (res.status === 401) {
        setUser(null);
        setMemberships([]);
        setStatus("unauthenticated");
        return;
      }
      if (res.error) {
        setError(res.error);
        setStatus("unauthenticated");
        return;
      }
      setUser(res.data?.user || null);
      setMemberships(res.data?.memberships || []);
      setStatus("authenticated");
    } catch (err) {
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
    setMemberships([]);
    setStatus("unauthenticated");
  }, []);

  return {
    status,
    user,
    memberships,
    error,
    setError,
    refresh,
    logout
  };
}
