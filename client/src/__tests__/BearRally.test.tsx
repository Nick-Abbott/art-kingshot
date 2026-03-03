import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import BearRally from "../BearRally";
import type { Profile } from "@shared/types";

const bearMember = {
  playerId: "FID9",
  playerName: "Bear",
  rallySize: 500000,
  bearGroup: "bear1"
};

const upsertMember = vi.fn().mockResolvedValue([bearMember]);
const removeMember = vi.fn().mockResolvedValue([]);
const resetGroup = vi.fn().mockResolvedValue([]);
const refreshGroup = vi.fn().mockResolvedValue([]);
const setBear1Members = vi.fn();
const setBear2Members = vi.fn();

vi.mock("../hooks/useBear", () => ({
  useBear: () => ({
    bear1Members: [bearMember],
    bear2Members: [],
    setBear1Members,
    setBear2Members,
    loading: false,
    error: "",
    upsertMember,
    removeMember,
    resetGroup,
    refreshGroup
  })
}));

const updateProfile = vi.fn().mockResolvedValue({
  id: "p1",
  userId: "u1",
  playerId: "FID9",
  playerName: "Bear",
  allianceId: "art",
  status: "active",
  role: "member"
});

vi.mock("../api/profile", () => ({
  updateProfile: (...args: any[]) => updateProfile(...args)
}));

const lookupPlayer = vi.fn().mockResolvedValue({
  data: { data: { nickname: "Lookup" } }
});
vi.mock("../api/playerLookup", () => ({
  lookupPlayer: (...args: any[]) => lookupPlayer(...args)
}));

describe("BearRally", () => {
  const baseProfile: Profile = {
    id: "p1",
    userId: "u1",
    playerId: "FID9",
    playerName: "Bear",
    allianceId: "art",
    status: "active",
    role: "member",
    rallySize: 700000
  };

  beforeEach(() => {
    updateProfile.mockClear();
  });

  it("keeps edit values even when profile defaults exist", () => {
    render(
      <BearRally
        profileId="p1"
        profile={baseProfile}
        canManage={true}
        onProfileUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByText("bear.edit")[0]);

    const rallyInput = screen.getByLabelText("bear.rallySize") as HTMLInputElement;
    expect(rallyInput.value).toBe(String(bearMember.rallySize));
  });

  it("clears edit mode on profile switch", () => {
    const { rerender } = render(
      <BearRally
        profileId="p1"
        profile={baseProfile}
        canManage={true}
        onProfileUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByText("bear.edit")[0]);

    rerender(
      <BearRally
        profileId="p2"
        profile={{ ...baseProfile, id: "p2" }}
        canManage={true}
        onProfileUpdated={vi.fn()}
      />
    );

    const submitButton = screen.getByRole("button", { name: "bear.register" });
    expect(submitButton).toBeInTheDocument();
  });
});
