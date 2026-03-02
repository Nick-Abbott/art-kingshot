import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProfileDefaults } from "../hooks/useProfileDefaults";
import * as profileApi from "../api/profile";

describe("useProfileDefaults", () => {
  it("clears profile when fetch returns null", async () => {
    vi.spyOn(profileApi, "fetchProfile")
      .mockResolvedValueOnce({ playerId: "FID1" })
      .mockResolvedValueOnce(null);

    const { result, rerender } = renderHook(
      ({ allianceId, editing }) => useProfileDefaults(allianceId, editing),
      { initialProps: { allianceId: "art", editing: false } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile?.playerId).toBe("FID1");

    rerender({ allianceId: "beta", editing: false });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBe(null);
  });

  it("does not overwrite profile when editing begins during in-flight load", async () => {
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    vi.spyOn(profileApi, "fetchProfile").mockReturnValue(fetchPromise as Promise<any>);

    const { result, rerender } = renderHook(
      ({ allianceId, editing }) => useProfileDefaults(allianceId, editing),
      { initialProps: { allianceId: "art", editing: false } }
    );

    rerender({ allianceId: "art", editing: true });

    act(() => {
      resolveFetch({ playerId: "FID2" });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBe(null);
  });
});
