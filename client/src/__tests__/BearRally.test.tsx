import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

vi.mock("../hooks/useBear", () => ({
  useBear: () => ({
    bear1Members: [bearMember],
    bear2Members: [],
    loading: false,
    error: "",
    upsertMember,
    removeMember,
    resetGroup
  })
}));

vi.mock("../hooks/useAllianceSettingsQuery", () => ({
  useAllianceSettingsQuery: () => ({
    data: {
      bearNextTimes: {
        bear1: "2026-01-01T01:00:00.000Z",
        bear2: "2026-01-01T12:00:00.000Z"
      }
    }
  })
}));

vi.mock("../api/profile", () => ({
  updateProfile: vi.fn().mockResolvedValue({
    id: "p1",
    userId: "u1",
    playerId: "FID9",
    playerName: "Bear",
    allianceId: "art",
    status: "active",
    role: "member"
  })
}));

vi.mock("../api/playerLookup", () => ({
  lookupPlayer: vi.fn().mockResolvedValue({
    data: { data: { nickname: "Lookup" } }
  })
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

  it("keeps edit values even when profile defaults exist", () => {
    renderWithClient(
      <BearRally
        profileId="p1"
        profile={baseProfile}
        canManage={true}
      />
    );

    fireEvent.click(screen.getAllByText("bear.edit")[0]);

    const rallyInput = screen.getByLabelText("bear.rallySize") as HTMLInputElement;
    expect(rallyInput.value).toBe(String(bearMember.rallySize));
  });

  it("clears edit mode on profile switch", () => {
    const { rerender, queryClient } = renderWithClient(
      <BearRally
        profileId="p1"
        profile={baseProfile}
        canManage={true}
      />
    );

    fireEvent.click(screen.getAllByText("bear.edit")[0]);

    rerender(
      <QueryClientProvider client={queryClient}>
        <BearRally
          profileId="p2"
          profile={{ ...baseProfile, id: "p2" }}
          canManage={true}
        />
      </QueryClientProvider>
    );

    const submitButton = screen.getByRole("button", { name: "bear.register" });
    expect(submitButton).toBeInTheDocument();
  });
});
