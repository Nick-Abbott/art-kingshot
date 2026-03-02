import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBear } from "../hooks/useBear";
import * as bearApi from "../api/bear";

const memberA = { playerId: "A", playerName: "Alpha", rallySize: 1000 };
const memberB = { playerId: "B", playerName: "Beta", rallySize: 2000 };

describe("useBear", () => {
  it("removes member from other group when moved", async () => {
    vi.spyOn(bearApi, "fetchBearGroup")
      .mockResolvedValueOnce([memberA])
      .mockResolvedValueOnce([]);
    vi.spyOn(bearApi, "upsertBearMember").mockResolvedValue([memberA]);

    const { result } = renderHook(() => useBear("art"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.bear1Members).toEqual([memberA]);
    expect(result.current.bear2Members).toEqual([]);

    await act(async () => {
      await result.current.upsertMember("bear2", memberA);
    });

    expect(result.current.bear2Members).toEqual([memberA]);
    expect(result.current.bear1Members).toEqual([]);
  });

  it("clears lists on alliance change", async () => {
    vi.spyOn(bearApi, "fetchBearGroup")
      .mockResolvedValueOnce([memberA])
      .mockResolvedValueOnce([memberB])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { result, rerender } = renderHook(({ allianceId }) => useBear(allianceId), {
      initialProps: { allianceId: "art" }
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.bear1Members).toEqual([memberA]);
    expect(result.current.bear2Members).toEqual([memberB]);

    rerender({ allianceId: "beta" });

    expect(result.current.bear1Members).toEqual([]);
    expect(result.current.bear2Members).toEqual([]);
  });
});
