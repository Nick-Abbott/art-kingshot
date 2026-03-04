export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type AllianceRole = "member" | "alliance_admin";
export type ProfileStatus = "pending" | "active";

export type User = {
  id: string;
  discordId: string;
  displayName: string;
  avatar?: string | null;
  isAppAdmin?: number | boolean;
};

export type Alliance = {
  id: string;
  name: string;
  kingdomId: number;
};

export type Profile = {
  id: string;
  userId: string;
  playerId?: string | null;
  playerName?: string | null;
  playerAvatar?: string | null;
  kingdomId?: number | null;
  allianceId?: string | null;
  allianceName?: string | null;
  userDisplayName?: string | null;
  status: ProfileStatus;
  role: AllianceRole;
  troopCount?: number | null;
  marchCount?: number | null;
  power?: number | null;
  rallySize?: number | null;
};

export type SessionPayload = {
  user: User | null;
  profiles: Profile[];
};

export type AlliancesPayload = {
  alliances: Alliance[];
};

export type AlliancePayload = {
  alliance: Alliance | null;
};

export type AllianceCreatePayload = {
  alliance: Alliance | null;
  profile: Profile | null;
};

export type Member = {
  playerId: string;
  troopCount: number;
  marchCount: number;
  power: number;
  playerName: string;
};

export type MembersPayload = {
  members: Member[];
};

export type EligibleMember = {
  playerId: string;
  playerName?: string;
  troopCount?: number | null;
  marchCount?: number | null;
  power?: number | null;
  rallySize?: number | null;
};

export type EligibleMembersPayload = {
  members: EligibleMember[];
};

export type ProfileDefaults = {
  playerId?: string | null;
  playerName?: string | null;
  troopCount?: number | null;
  marchCount?: number | null;
  power?: number | null;
  rallySize?: number | null;
};

export type ProfilesPayload = {
  profiles: Profile[];
};

export type ProfilePayload = {
  profile: Profile | null;
};

export type AllianceProfileUpdateRequest = {
  status?: ProfileStatus;
  role?: AllianceRole;
  action?: "reject";
};

export type AdminKingdomsPayload = {
  kingdoms: number[];
};

export type AdminAlliancesPayload = {
  alliances: Alliance[];
};

export type AdminProfileLookupPayload = {
  profile: Profile | null;
};

export type BearGroup = "bear1" | "bear2";

export type BearMember = {
  playerId: string;
  playerName: string;
  rallySize: number;
};

export type BearPayload = {
  members: BearMember[];
};

export type AssignmentTransfer = {
  toId?: string;
  toName?: string;
  troops: number;
  lead?: boolean;
};

export type AssignmentIncoming = {
  fromId?: string;
  fromName?: string;
  troops: number;
  lead?: boolean;
};

export type AssignmentMember = {
  playerId: string;
  playerName: string;
  troopCount: number;
  troopsRemaining?: number;
  outgoing: AssignmentTransfer[];
  incoming: AssignmentIncoming[];
  incomingTotal: number;
  garrisonLeadId?: string;
  garrisonLeadName?: string;
};

export type AssignmentResult = {
  members: AssignmentMember[];
  warnings: string[];
};

export type ResultsPayload = {
  results: AssignmentResult | null;
};

export type LookupPayload = {
  ok?: boolean;
  status?: number;
  data?: any;
};
