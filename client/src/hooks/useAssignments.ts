import { useEffect, useRef, useState } from "react";
import { fetchResults, resetEvent, runAssignments } from "../api/assignments";
import type { AssignmentResult } from "../api/assignments";

export function useAssignments(profileId: string) {
  const [results, setResults] = useState<AssignmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!profileId) {
      setResults(null);
      setError("");
      setLoading(false);
      return;
    }
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    fetchResults(profileId)
      .then((data) => {
        if (current !== requestId.current) return;
        setResults(data || null);
      })
      .catch((err) => {
        if (current !== requestId.current) return;
        setError(err.message || "Failed to load results.");
      })
      .finally(() => {
        if (current !== requestId.current) return;
        setLoading(false);
      });
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    setError("");
  }, [profileId]);

  async function run() {
    if (!profileId) return null;
    const data = await runAssignments(profileId);
    setResults(data || null);
    setError("");
    return data;
  }

  async function reset() {
    if (!profileId) return;
    await resetEvent(profileId);
    setResults(null);
    setError("");
  }

  return {
    results,
    loading,
    error,
    run,
    reset
  };
}
