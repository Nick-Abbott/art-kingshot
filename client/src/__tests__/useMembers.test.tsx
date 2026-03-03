import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMembers } from "../hooks/useMembers";
import * as membersApi from "../api/members";

const member = {
  playerId: "FID1",
  troopCount: 1000,
  marchCount: 4,
  power: 2000000,
  playerName: "Test"
};

describe("useMembers", () => {
  it("clears error on saveMember success", async () => {
    vi.spyOn(membersApi, "fetchMembers").mockResolvedValue([]);
    vi.spyOn(membersApi, "signupMember").mockResolvedValue([member]);

    const { result } = renderHook(() => useMembers("p1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setMembers([]);
    });

    await act(async () => {
      await result.current.saveMember(member);
    });

    expect(result.current.error).toBe("");
    expect(result.current.members).toEqual([member]);
  });

  it("clears error on deleteMember success", async () => {
    vi.spyOn(membersApi, "fetchMembers").mockResolvedValue([member]);
    vi.spyOn(membersApi, "removeMember").mockResolvedValue([]);

    const { result } = renderHook(() => useMembers("p1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteMember("FID1");
    });

    expect(result.current.error).toBe("");
    expect(result.current.members).toEqual([]);
  });
});
