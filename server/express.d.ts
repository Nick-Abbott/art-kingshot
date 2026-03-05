import type { AllianceRole, Profile, User } from "../shared/types";

declare global {
  namespace Express {
    interface Request {
      user: User | null;
      profiles: Profile[];
      profile?: Profile | null;
      profileRole?: AllianceRole | null;
      sessionToken?: string | null;
      allianceId?: string | null;
    }
  }
}

export {};
