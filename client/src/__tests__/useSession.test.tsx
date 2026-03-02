import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSession } from "../hooks/useSession";
import * as sessionApi from "../api/session";

describe("useSession", () => {
  it("sets unauthenticated on 401", async () => {
    vi.spyOn(sessionApi, "fetchSession").mockResolvedValue({ status: 401 });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.status).toBe("unauthenticated");
    });
    expect(result.current.user).toBe(null);
    expect(result.current.memberships).toEqual([]);
  });

  it("sets authenticated on success", async () => {
    vi.spyOn(sessionApi, "fetchSession").mockResolvedValue({
      status: 200,
      data: {
        user: {
          id: "u1",
          discordId: "d1",
          displayName: "Test",
          isAppAdmin: 0
        },
        memberships: [
          {
            userId: "u1",
            allianceId: "art",
            role: "alliance_admin",
            allianceName: "ART"
          }
        ]
      }
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });
    expect(result.current.user?.displayName).toBe("Test");
    expect(result.current.memberships).toHaveLength(1);
  });

  it("surfaces error on fetch error", async () => {
    vi.spyOn(sessionApi, "fetchSession").mockResolvedValue({
      status: 500,
      error: "Boom"
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.status).toBe("unauthenticated");
    });
    expect(result.current.error).toBe("Boom");
  });
});
