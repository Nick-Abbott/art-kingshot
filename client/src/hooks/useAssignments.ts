import { useEffect, useRef, useState } from "react";
import { fetchResults, resetEvent, runAssignments } from "../api/assignments";
import type { AssignmentResult } from "../api/assignments";

export function useAssignments(allianceId: string) {
  const [results, setResults] = useState<AssignmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!allianceId) return;
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    fetchResults(allianceId)
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
  }, [allianceId]);

  useEffect(() => {
    if (!allianceId) return;
    setError("");
  }, [allianceId]);

  async function run() {
    if (!allianceId) return null;
    const data = await runAssignments(allianceId);
    setResults(data || null);
    setError("");
    return data;
  }

  async function reset() {
    if (!allianceId) return;
    await resetEvent(allianceId);
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
