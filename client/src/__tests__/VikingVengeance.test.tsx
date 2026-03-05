import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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


vi.mock("../hooks/useMembers", () => ({
  useMembers: () => ({
    members: [member],
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

const { updateProfileMock, lookupPlayerMock } = vi.hoisted(() => ({
  updateProfileMock: vi.fn().mockResolvedValue({
    id: "p1",
    userId: "u1",
    playerId: "FID1",
    playerName: "Alpha",
    allianceId: "art",
    status: "active",
    role: "member"
  }),
  lookupPlayerMock: vi.fn().mockResolvedValue({
    data: { data: { nickname: "Lookup" } }
  })
}));

vi.mock("../api/profile", () => ({
  updateProfile: updateProfileMock
}));

vi.mock("../api/playerLookup", () => ({
  lookupPlayer: lookupPlayerMock
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
    vi.clearAllMocks();
  });

  function renderWithClient(ui: React.ReactElement) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    return {
      queryClient,
      ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
    };
  }

  it("keeps edit values even when profile defaults exist", async () => {
    renderWithClient(
      <VikingVengeance
        profileId="p1"
        profile={baseProfile}
        canManage={true}
      />
    );

    const editButton = await screen.findByText("viking.edit");
    fireEvent.click(editButton);

    const troopInput = screen.getByLabelText("viking.troopCount") as HTMLInputElement;
    expect(troopInput.value).toBe(String(member.troopCount));
  });

  it("submits update without triggering lookup", async () => {
    renderWithClient(
      <VikingVengeance
        profileId="p1"
        profile={baseProfile}
        canManage={true}
      />
    );

    fireEvent.click(screen.getByText("viking.edit"));

    const submitButton = screen.getByRole("button", { name: "viking.update" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(saveMember).toHaveBeenCalledTimes(1);
    });
    expect(lookupPlayerMock).not.toHaveBeenCalled();
  });

  it("runs player lookup when profile name is missing", async () => {
    renderWithClient(
      <VikingVengeance
        profileId="p1"
        profile={{ ...baseProfile, playerName: "", playerId: "PROFILE" }}
        canManage={true}
      />
    );

    const submitButton = screen.getByRole("button", { name: "viking.saveSignup" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(lookupPlayerMock).toHaveBeenCalled();
    });
  });

  it("clears edit mode on profile switch", async () => {
    const { rerender, queryClient } = renderWithClient(
      <VikingVengeance
        profileId="p1"
        profile={baseProfile}
        canManage={true}
      />
    );

    fireEvent.click(screen.getByText("viking.edit"));

    rerender(
      <QueryClientProvider client={queryClient}>
        <VikingVengeance
          profileId="p2"
          profile={{ ...baseProfile, id: "p2" }}
          canManage={true}
        />
      </QueryClientProvider>
    );

    const submitButton = screen.getByRole("button", { name: "viking.saveSignup" });
    expect(submitButton).toBeInTheDocument();
  });
});
