import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import VikingVengeance from "../VikingVengeance";

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

let profile: any = { playerId: "PROFILE", troopCount: 5000, marchCount: 5, power: 3000000 };

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

vi.mock("../hooks/useProfileDefaults", () => ({
  useProfileDefaults: () => ({
    profile,
    loading: false,
    error: "",
    saveDefaults: vi.fn(),
    setProfile: vi.fn()
  })
}));

const lookupPlayer = vi.fn().mockResolvedValue({ data: { playerName: "Lookup" } });
vi.mock("../api/playerLookup", () => ({
  lookupPlayer: (...args: any[]) => lookupPlayer(...args)
}));

describe("VikingVengeance", () => {
  beforeEach(() => {
    saveMember.mockClear();
    lookupPlayer.mockClear();
    profile = { playerId: "PROFILE", troopCount: 5000, marchCount: 5, power: 3000000 };
  });

  it("keeps edit values even when profile defaults exist", async () => {
    render(<VikingVengeance allianceId="art" canManage={true} />);

    const editButton = await screen.findByText("viking.edit");
    fireEvent.click(editButton);

    const playerIdInput = screen.getByLabelText("viking.playerId") as HTMLInputElement;
    expect(playerIdInput.value).toBe(member.playerId);
  });

  it("submits update without triggering lookup", async () => {
    render(<VikingVengeance allianceId="art" canManage={true} />);

    fireEvent.click(screen.getByText("viking.edit"));

    const submitButton = screen.getByRole("button", { name: "viking.update" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(saveMember).toHaveBeenCalledTimes(1);
    });
    expect(lookupPlayer).not.toHaveBeenCalled();
  });

  it("runs player lookup on playerId change in create mode", async () => {
    render(<VikingVengeance allianceId="art" canManage={true} />);

    const playerIdInput = screen.getByLabelText("viking.playerId") as HTMLInputElement;
    fireEvent.change(playerIdInput, { target: { value: "FID2" } });

    const submitButton = screen.getByRole("button", { name: "viking.saveSignup" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(lookupPlayer).toHaveBeenCalled();
    });
  });

  it("clears edit mode on alliance switch", async () => {
    const { rerender } = render(
      <VikingVengeance allianceId="art" canManage={true} />
    );

    fireEvent.click(screen.getByText("viking.edit"));

    rerender(<VikingVengeance allianceId="beta" canManage={true} />);

    const playerIdInput = screen.getByLabelText("viking.playerId") as HTMLInputElement;
    expect(playerIdInput.disabled).toBe(false);
  });
});
