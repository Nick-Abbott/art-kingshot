import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { useProfileSelection } from "../hooks/useProfileSelection";
import type { Profile } from "@shared/types";

const profiles: Profile[] = [
  {
    id: "p1",
    userId: "u1",
    playerId: "FID1",
    playerName: "Alpha",
    allianceId: "art",
    status: "active",
    role: "member"
  },
  {
    id: "p2",
    userId: "u1",
    playerId: "FID2",
    playerName: "Beta",
    allianceId: "beta",
    status: "active",
    role: "alliance_admin"
  }
];

describe("useProfileSelection", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps selected profile when still allowed", () => {
    window.localStorage.setItem("selectedProfile", "p2");
    const { result } = renderHook(() => useProfileSelection(profiles, null));
    expect(result.current.selectedProfileId).toBe("p2");
  });

  it("falls back to first profile when selection is invalid", () => {
    window.localStorage.setItem("selectedProfile", "missing");
    const { result } = renderHook(() => useProfileSelection(profiles, null));
    expect(result.current.selectedProfileId).toBe("p1");
  });

  it("updates localStorage on change", () => {
    const { result } = renderHook(() => useProfileSelection(profiles, null));
    act(() => {
      result.current.setSelectedProfileId("p2");
    });
    expect(window.localStorage.getItem("selectedProfile")).toBe("p2");
  });
});
