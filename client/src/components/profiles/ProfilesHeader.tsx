import React from "react";
import type { TFunction } from "i18next";
import type { Profile } from "@shared/types";

type Props = {
  t: TFunction;
  selectedProfile: Profile | null;
};

function ProfilesHeader({ t, selectedProfile }: Props) {
  return (
    <header className="relative z-[1] mb-8 flex flex-col gap-4 nav:flex-row nav:items-start nav:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-accent-dark">
          {t("profiles.eyebrow")}
        </p>
        <h1 className="mt-2 font-['DM Serif Display'] text-[clamp(2.4rem,3vw,3.5rem)]">
          {t("profiles.title")}
        </h1>
        <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed text-muted">
          {t("profiles.subtitle")}
        </p>
        {selectedProfile &&
          selectedProfile.status !== "active" &&
          selectedProfile.allianceId && (
          <p className="mt-3 font-semibold text-[#9e2a2b]">
            {t("profiles.pendingNotice")}
          </p>
        )}
      </div>
    </header>
  );
}

export default ProfilesHeader;
