import React from "react";
import type { TFunction } from "i18next";
import type { Profile } from "@shared/types";

type Props = {
  t: TFunction;
  profile: Profile;
  lookupStatus: string;
  error: string;
  success: string;
  onRefresh: () => void;
};

function ProfilesCurrentCard({
  t,
  profile,
  lookupStatus,
  error,
  success,
  onRefresh
}: Props) {
  return (
    <section className="ui-card">
      <div className="flex flex-col gap-4 nav:flex-row nav:items-start nav:justify-between">
        <div className="ui-section-header">
          <h2 className="ui-section-title">{t("profiles.currentTitle")}</h2>
          <p className="ui-section-subtitle">{t("profiles.currentSubtitle")}</p>
        </div>
        <button className="ui-button-ghost" type="button" onClick={onRefresh}>
          {t("profiles.refreshProfile", { defaultValue: "Refresh profile" })}
        </button>
      </div>
      <div className="mt-5 grid gap-3">
        <div className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between">
          <div>
            <p className="font-semibold">{profile.playerName || profile.playerId}</p>
            <p className="text-sm text-muted">
              {profile.allianceName || t("profiles.noAlliance")}
            </p>
            {profile.kingdomId ? (
              <p className="text-sm text-muted">
                {t("profiles.kingdom", {
                  id: profile.kingdomId,
                  defaultValue: "Kingdom {{id}}"
                })}
              </p>
            ) : null}
            <p className="text-sm text-muted">
              {t("profiles.role", { role: profile.role })}
            </p>
          </div>
          <span className="ui-badge">
            {profile.status === "active" ? t("profiles.active") : t("profiles.pending")}
          </span>
        </div>
        <div className="ui-card-muted">
          <div>
            <p className="font-semibold">
              {t("profiles.statsTitle", { defaultValue: "Profile stats" })}
            </p>
            <p className="text-sm text-muted">
              {t("profiles.stats.troopCount", {
                value:
                  profile.troopCount !== null && profile.troopCount !== undefined
                    ? new Intl.NumberFormat().format(profile.troopCount)
                    : t("profiles.stats.none", { defaultValue: "Not set" }),
                defaultValue: "Troop count: {{value}}"
              })}
            </p>
            <p className="text-sm text-muted">
              {t("profiles.stats.marchCount", {
                value:
                  profile.marchCount !== null && profile.marchCount !== undefined
                    ? new Intl.NumberFormat().format(profile.marchCount)
                    : t("profiles.stats.none", { defaultValue: "Not set" }),
                defaultValue: "March count: {{value}}"
              })}
            </p>
            <p className="text-sm text-muted">
              {t("profiles.stats.power", {
                value:
                  profile.power !== null && profile.power !== undefined
                    ? new Intl.NumberFormat().format(profile.power)
                    : t("profiles.stats.none", { defaultValue: "Not set" }),
                defaultValue: "Power: {{value}}"
              })}
            </p>
            <p className="text-sm text-muted">
              {t("profiles.stats.rallySize", {
                value:
                  profile.rallySize !== null && profile.rallySize !== undefined
                    ? new Intl.NumberFormat().format(profile.rallySize)
                    : t("profiles.stats.none", { defaultValue: "Not set" }),
                defaultValue: "Rally capacity: {{value}}"
              })}
            </p>
          </div>
        </div>
      </div>
      {lookupStatus && <p className="ui-field-hint">{lookupStatus}</p>}
      {error && <p className="ui-error">{error}</p>}
      {success && <p className="ui-success">{success}</p>}
    </section>
  );
}

export default ProfilesCurrentCard;
