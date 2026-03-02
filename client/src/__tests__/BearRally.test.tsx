import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import BearRally from "../BearRally";

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

let profile: any = { playerId: "PROFILE", rallySize: 700000 };

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

describe("BearRally", () => {
  beforeEach(() => {
    profile = { playerId: "PROFILE", rallySize: 700000 };
  });

  it("keeps edit values even when profile defaults exist", () => {
    render(<BearRally allianceId="art" canManage={true} />);

    fireEvent.click(screen.getAllByText("bear.edit")[0]);

    const playerIdInput = screen.getByLabelText("bear.playerId") as HTMLInputElement;
    expect(playerIdInput.value).toBe(bearMember.playerId);
  });

  it("clears edit mode on alliance switch", () => {
    const { rerender } = render(<BearRally allianceId="art" canManage={true} />);

    fireEvent.click(screen.getAllByText("bear.edit")[0]);

    rerender(<BearRally allianceId="beta" canManage={true} />);

    const playerIdInput = screen.getByLabelText("bear.playerId") as HTMLInputElement;
    expect(playerIdInput.disabled).toBe(false);
  });
});
