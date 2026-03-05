import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBear } from "../hooks/useBear";
import * as bearApi from "../api/bear";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const memberA = { playerId: "A", playerName: "Alpha", rallySize: 1000 };
const memberB = { playerId: "B", playerName: "Beta", rallySize: 2000 };

describe("useBear", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { wrapper, queryClient };
  }

  it("removes member from other group when moved", async () => {
    vi.spyOn(bearApi, "fetchBearGroup")
      .mockResolvedValueOnce([memberA])
      .mockResolvedValueOnce([]);
    vi.spyOn(bearApi, "upsertBearMember").mockResolvedValue([memberA]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBear("p1"), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.bear1Members).toEqual([memberA]);
    expect(result.current.bear2Members).toEqual([]);

    await act(async () => {
      await result.current.upsertMember("bear2", memberA);
    });

    await waitFor(() => {
      expect(result.current.bear2Members).toEqual([memberA]);
      expect(result.current.bear1Members).toEqual([]);
    });
  });

  it("clears lists on profile change", async () => {
    vi.spyOn(bearApi, "fetchBearGroup")
      .mockResolvedValueOnce([memberA])
      .mockResolvedValueOnce([memberB])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(({ profileId }) => useBear(profileId), {
      initialProps: { profileId: "p1" },
      wrapper
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.bear1Members).toEqual([memberA]);
    expect(result.current.bear2Members).toEqual([memberB]);

    rerender({ profileId: "p2" });

    expect(result.current.bear1Members).toEqual([]);
    expect(result.current.bear2Members).toEqual([]);
  });
});
