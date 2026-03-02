import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { useAlliance } from "../hooks/useAlliance";

const baseMemberships = [
  { allianceId: "art", role: "alliance_admin", allianceName: "ART" },
  { allianceId: "beta", role: "member", allianceName: "BETA" }
];

describe("useAlliance", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps selected alliance when still allowed", () => {
    window.localStorage.setItem("selectedAlliance", "beta");
    const { result } = renderHook(() => useAlliance(baseMemberships, null));
    expect(result.current.selectedAlliance).toBe("beta");
  });

  it("falls back to first allowed when selection is invalid", () => {
    window.localStorage.setItem("selectedAlliance", "missing");
    const { result } = renderHook(() => useAlliance(baseMemberships, null));
    expect(result.current.selectedAlliance).toBe("art");
  });

  it("updates localStorage on change", () => {
    const { result } = renderHook(() => useAlliance(baseMemberships, null));
    act(() => {
      result.current.setSelectedAlliance("beta");
    });
    expect(window.localStorage.getItem("selectedAlliance")).toBe("beta");
  });
});
