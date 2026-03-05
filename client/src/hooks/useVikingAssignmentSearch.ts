import { useCallback, useMemo, useState } from "react";
import type { AssignmentResult } from "../api/assignments";

type AssignmentMember = AssignmentResult["members"][number];

function normalize(value: string) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function useVikingAssignmentSearch(results: AssignmentResult | null) {
  const [searchQuery, setSearchQuery] = useState("");

  const fuzzyScore = useCallback((query: string, text: string) => {
    if (!query) return 0;
    const q = normalize(query);
    const tValue = normalize(text);
    if (!q || !tValue) return null;
    let qi = 0;
    let score = 0;
    let lastMatch = -1;
    for (let ti = 0; ti < tValue.length && qi < q.length; ti += 1) {
      if (tValue[ti] === q[qi]) {
        score += lastMatch === -1 ? 1 : Math.max(1, 5 - (ti - lastMatch));
        lastMatch = ti;
        qi += 1;
      }
    }
    if (qi < q.length) return null;
    return score;
  }, []);

  const filteredResults = useMemo(() => {
    if (!results?.members) return [];
    const query = searchQuery.trim();
    if (!query) return results.members;
    const scored = results.members
      .map((member) => {
        const name = member.playerName || member.playerId || "";
        const score = fuzzyScore(query, name);
        return score === null ? null : { member, score };
      })
      .filter(
        (item): item is { member: AssignmentMember; score: number } => item !== null
      )
      .sort((a, b) => b.score - a.score);
    return scored.map((item) => item.member);
  }, [fuzzyScore, results, searchQuery]);

  const searchSuggestions = useMemo(() => {
    if (!results?.members) return [];
    const query = searchQuery.trim();
    if (!query) return [];
    const scored = results.members
      .map((member) => {
        const name = member.playerName || member.playerId || "";
        const score = fuzzyScore(query, name);
        return score === null ? null : { name, score };
      })
      .filter((item): item is { name: string; score: number } => item !== null)
      .sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const item of scored) {
      if (seen.has(item.name)) continue;
      seen.add(item.name);
      suggestions.push(item.name);
      if (suggestions.length >= 5) break;
    }
    return suggestions;
  }, [fuzzyScore, results, searchQuery]);

  const topSuggestion = searchSuggestions[0] || "";
  const suggestionTail =
    topSuggestion &&
    topSuggestion.toLowerCase().startsWith(searchQuery.trim().toLowerCase())
      ? topSuggestion.slice(searchQuery.trim().length)
      : "";

  return {
    searchQuery,
    setSearchQuery,
    filteredResults,
    suggestionTail,
    topSuggestion
  };
}
