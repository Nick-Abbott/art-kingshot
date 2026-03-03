import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import VikingVengeance from "../VikingVengeance";
import type { Profile } from "@shared/types";

const member = {
  playerId: "FID1",
  troopCount: 1000,
  marchCount: 4,
  power: 2000000,
  playerName: "Alpha"
};

const saveMember = vi.fn().mockResolvedValue([member]);
const deleteMember = vi.fn().mockResolvedValue([]);
const setMembers = vi.fn();

const updateProfile = vi.fn().mockResolvedValue({
  id: "p1",
  userId: "u1",
  playerId: "FID1",
  playerName: "Alpha",
  allianceId: "art",
  status: "active",
  role: "member"
});

vi.mock("../hooks/useMembers", () => ({
  useMembers: () => ({
    members: [member],
    setMembers,
    saveMember,
    deleteMember,
    loading: false,
    error: ""
  })
}));

vi.mock("../hooks/useAssignments", () => ({
  useAssignments: () => ({
    results: null,
    loading: false,
    error: "",
    run: vi.fn(),
    reset: vi.fn()
  })
}));

vi.mock("../api/profile", () => ({
  updateProfile: (...args: any[]) => updateProfile(...args)
}));

const lookupPlayer = vi.fn().mockResolvedValue({
  data: { data: { nickname: "Lookup" } }
});
vi.mock("../api/playerLookup", () => ({
  lookupPlayer: (...args: any[]) => lookupPlayer(...args)
}));

describe("VikingVengeance", () => {
  const baseProfile: Profile = {
    id: "p1",
    userId: "u1",
    playerId: "FID1",
    playerName: "Alpha",
    allianceId: "art",
    status: "active",
    role: "member",
    troopCount: 5000,
    marchCount: 5,
    power: 3000000
  };

  beforeEach(() => {
    saveMember.mockClear();
    lookupPlayer.mockClear();
    updateProfile.mockClear();
  });

  it("keeps edit values even when profile defaults exist", async () => {
    render(
      <VikingVengeance
        profileId="p1"
        profile={baseProfile}
        canManage={true}
        onProfileUpdated={vi.fn()}
      />
    );

    const editButton = await screen.findByText("viking.edit");
    fireEvent.click(editButton);

    const troopInput = screen.getByLabelText("viking.troopCount") as HTMLInputElement;
    expect(troopInput.value).toBe(String(member.troopCount));
  });

  it("submits update without triggering lookup", async () => {
    render(
      <VikingVengeance
        profileId="p1"
        profile={baseProfile}
        canManage={true}
        onProfileUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("viking.edit"));

    const submitButton = screen.getByRole("button", { name: "viking.update" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(saveMember).toHaveBeenCalledTimes(1);
    });
    expect(lookupPlayer).not.toHaveBeenCalled();
  });

  it("runs player lookup when profile name is missing", async () => {
    render(
      <VikingVengeance
        profileId="p1"
        profile={{ ...baseProfile, playerName: "", playerId: "PROFILE" }}
        canManage={true}
        onProfileUpdated={vi.fn()}
      />
    );

    const submitButton = screen.getByRole("button", { name: "viking.saveSignup" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(lookupPlayer).toHaveBeenCalled();
    });
  });

  it("clears edit mode on profile switch", async () => {
    const { rerender } = render(
      <VikingVengeance
        profileId="p1"
        profile={baseProfile}
        canManage={true}
        onProfileUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("viking.edit"));

    rerender(
      <VikingVengeance
        profileId="p2"
        profile={{ ...baseProfile, id: "p2" }}
        canManage={true}
        onProfileUpdated={vi.fn()}
      />
    );

    const submitButton = screen.getByRole("button", { name: "viking.saveSignup" });
    expect(submitButton).toBeInTheDocument();
  });
});
