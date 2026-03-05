import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMembers } from "../hooks/useMembers";
import * as membersApi from "../api/members";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const member = {
  playerId: "FID1",
  troopCount: 1000,
  marchCount: 4,
  power: 2000000,
  playerName: "Test"
};

describe("useMembers", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { wrapper };
  }

  it("clears error on saveMember success", async () => {
    vi.spyOn(membersApi, "fetchMembers")
      .mockResolvedValueOnce([])
      .mockResolvedValue([member]);
    vi.spyOn(membersApi, "signupMember").mockResolvedValue([member]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMembers("p1"), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.saveMember(member);
    });

    expect(result.current.error).toBe("");
    await waitFor(() => {
      expect(result.current.members).toEqual([member]);
    });
  });

  it("clears error on deleteMember success", async () => {
    vi.spyOn(membersApi, "fetchMembers")
      .mockResolvedValueOnce([member])
      .mockResolvedValue([]);
    vi.spyOn(membersApi, "removeMember").mockResolvedValue([]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMembers("p1"), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteMember("FID1");
    });

    expect(result.current.error).toBe("");
    await waitFor(() => {
      expect(result.current.members).toEqual([]);
    });
  });
});
