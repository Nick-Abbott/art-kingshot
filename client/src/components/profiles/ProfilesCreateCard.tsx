import React from "react";
import type { TFunction } from "i18next";

type Props = {
  t: TFunction;
  playerId: string;
  lookupStatus: string;
  error: string;
  success: string;
  onPlayerIdChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function ProfilesCreateCard({
  t,
  playerId,
  lookupStatus,
  error,
  success,
  onPlayerIdChange,
  onSubmit
}: Props) {
  return (
    <section className="ui-card">
      <div className="ui-section-header">
        <h2 className="ui-section-title">{t("profiles.createTitle")}</h2>
        <p className="ui-section-subtitle">{t("profiles.createSubtitle")}</p>
      </div>
      <form
        className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(4,minmax(0,1fr))_160px] nav:items-end"
        onSubmit={onSubmit}
      >
        <label className="ui-field">
          {t("profiles.playerId")}
          <input
            name="playerId"
            value={playerId}
            onChange={(e) => onPlayerIdChange(e.target.value)}
            placeholder="243656992"
            required
            className="ui-input"
          />
        </label>
        {lookupStatus && <span className="ui-field-hint">{lookupStatus}</span>}
        <button className="ui-button nav:col-start-5" type="submit">
          {t("profiles.create")}
        </button>
      </form>
      {error && <p className="ui-error">{error}</p>}
      {success && <p className="ui-success">{success}</p>}
    </section>
  );
}

export default ProfilesCreateCard;
