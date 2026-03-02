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

export type User = {
  id: string;
  discordId: string;
  displayName: string;
  avatar?: string | null;
  isAppAdmin?: number | boolean;
};

export type Membership = {
  userId: string;
  allianceId: string;
  role: AllianceRole;
  allianceName?: string;
};

export type SessionPayload = {
  user: User | null;
  memberships: Membership[];
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

export type ProfileDefaults = {
  playerId?: string | null;
  playerName?: string | null;
  troopCount?: number | null;
  marchCount?: number | null;
  power?: number | null;
};

export type ProfilePayload = {
  profile: ProfileDefaults | null;
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
  whaleLead?: boolean;
};

export type AssignmentIncoming = {
  fromId?: string;
  fromName?: string;
  troops: number;
  whaleLead?: boolean;
};

export type AssignmentMember = {
  playerId: string;
  playerName: string;
  troopCount: number;
  troopsRemaining?: number;
  power: number;
  marchCount: number;
  whale?: boolean;
  outgoing: AssignmentTransfer[];
  incoming: AssignmentIncoming[];
  incomingTotal: number;
  garrisonLeadId?: string;
  garrisonLeadName?: string;
};

export type AssignmentResult = {
  needPerCity: number;
  medianPower: number;
  whaleThreshold: number;
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
