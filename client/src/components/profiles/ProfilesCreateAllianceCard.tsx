import React from "react";
import type { TFunction } from "i18next";
import type { Profile } from "@shared/types";

type Props = {
  t: TFunction;
  profile: Profile;
  createTag: string;
  createName: string;
  createError: string;
  createSuccess: string;
  onCreateTagChange: (value: string) => void;
  onCreateNameChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function ProfilesCreateAllianceCard({
  t,
  profile,
  createTag,
  createName,
  createError,
  createSuccess,
  onCreateTagChange,
  onCreateNameChange,
  onSubmit
}: Props) {
  return (
    <section className="ui-card">
      <div className="ui-section-header">
        <h2 className="ui-section-title">{t("profiles.createAllianceTitle")}</h2>
        <p className="ui-section-subtitle">{t("profiles.createAllianceSubtitle")}</p>
      </div>
      {!profile.kingdomId ? (
        <p className="ui-empty-state">{t("profiles.joinMissingKingdom")}</p>
      ) : (
        <form
          className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(4,minmax(0,1fr))_160px] nav:items-end"
          onSubmit={onSubmit}
        >
          <label className="ui-field">
            {t("profiles.allianceTag")}
            <input
              name="allianceTag"
              value={createTag}
              onChange={(e) => onCreateTagChange(e.target.value.toUpperCase())}
              placeholder="ART"
              maxLength={3}
              required
              className="ui-input"
            />
          </label>
          <label className="ui-field">
            {t("profiles.allianceName")}
            <input
              name="allianceName"
              value={createName}
              onChange={(e) => onCreateNameChange(e.target.value)}
              placeholder="ArtsOFwar"
              required
              className="ui-input"
            />
          </label>
          <button className="ui-button nav:col-start-5" type="submit">
            {t("profiles.createAlliance")}
          </button>
        </form>
      )}
      {createError && <p className="ui-error">{createError}</p>}
      {createSuccess && <p className="ui-success">{createSuccess}</p>}
    </section>
  );
}

export default ProfilesCreateAllianceCard;
