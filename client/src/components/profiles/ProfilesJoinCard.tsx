import React from "react";
import type { TFunction } from "i18next";
import type { Alliance, Profile } from "@shared/types";

type Props = {
  t: TFunction;
  profile: Profile;
  alliances: Alliance[];
  joinAllianceId: string;
  joinError: string;
  joinSuccess: string;
  onJoinAllianceChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function ProfilesJoinCard({
  t,
  profile,
  alliances,
  joinAllianceId,
  joinError,
  joinSuccess,
  onJoinAllianceChange,
  onSubmit
}: Props) {
  return (
    <section className="ui-card">
      <div className="ui-section-header">
        <h2 className="ui-section-title">{t("profiles.joinTitle")}</h2>
        <p className="ui-section-subtitle">{t("profiles.joinSubtitle")}</p>
      </div>
      {!profile.kingdomId ? (
        <p className="ui-empty-state">{t("profiles.joinMissingKingdom")}</p>
      ) : (
        <form
          className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(4,minmax(0,1fr))_160px] nav:items-end"
          onSubmit={onSubmit}
        >
          <label className="ui-field">
            {t("profiles.alliance")}
            <select
              name="allianceId"
              value={joinAllianceId}
              onChange={(e) => onJoinAllianceChange(e.target.value)}
              className="ui-select"
            >
              <option value="">{t("profiles.allianceNone")}</option>
              {alliances.map((alliance) => (
                <option key={alliance.id} value={alliance.id}>
                  {alliance.name}
                </option>
              ))}
            </select>
          </label>
          <button className="ui-button nav:col-start-5" type="submit">
            {t("profiles.join")}
          </button>
        </form>
      )}
      {joinError && <p className="ui-error">{joinError}</p>}
      {joinSuccess && <p className="ui-success">{joinSuccess}</p>}
    </section>
  );
}

export default ProfilesJoinCard;
