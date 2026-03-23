import React from "react";
import type { TFunction } from "i18next";
import type { Profile } from "@shared/types";
import { FileInput } from "../ui/file-input";

type Props = {
  t: TFunction;
  profile: Profile;
  lookupStatus: string;
  error: string;
  success: string;
  onRefresh: () => void;
  troopsUploadError: string;
  troopsUploadSuccess: string;
  troopsUploadBusy: boolean;
  troopsUploadCanSubmit: boolean;
  troopsUploadResetKey: number;
  onTroopsFileSelect: (file: File | null) => void;
  onTroopsUploadSubmit: () => void;
  dmOptIn: boolean;
  dmOptInBusy: boolean;
  dmOptInError: string;
  onDmOptInChange: (nextValue: boolean) => void;
};

function ProfilesCurrentCard({
  t,
  profile,
  lookupStatus,
  error,
  success,
  onRefresh,
  troopsUploadError,
  troopsUploadSuccess,
  troopsUploadBusy,
  troopsUploadCanSubmit,
  troopsUploadResetKey,
  onTroopsFileSelect,
  onTroopsUploadSubmit,
  dmOptIn,
  dmOptInBusy,
  dmOptInError,
  onDmOptInChange
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
            {profile.status === "active"
              ? t("profiles.active")
              : profile.allianceId
                ? t("profiles.pending")
                : t("profiles.selectAllianceBadge")}
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
        <div className="ui-card-muted">
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-semibold">
                {t("profiles.troopsUploadTitle", {
                  defaultValue: "Update troops from screenshot"
                })}
              </p>
              <p className="text-sm text-muted">
                {t("profiles.troopsUploadHint", {
                  defaultValue: "Upload a full troop overview screenshot."
                })}
              </p>
            </div>
            <div className="flex flex-col gap-2 nav:flex-row nav:items-center">
              <FileInput
                buttonLabel={t("profiles.troopsUploadButton", {
                  defaultValue: "Choose file"
                })}
                placeholder={t("profiles.troopsUploadPlaceholder", {
                  defaultValue: "No file selected"
                })}
                accept="image/*"
                onFileSelect={onTroopsFileSelect}
                resetKey={troopsUploadResetKey}
                className="flex-1"
              />
              <button
                className="ui-button ui-button-sm"
                type="button"
                onClick={onTroopsUploadSubmit}
                disabled={!troopsUploadCanSubmit || troopsUploadBusy}
              >
                {troopsUploadBusy
                  ? t("profiles.troopsUploadSubmitting", {
                      defaultValue: "Processing..."
                    })
                  : t("profiles.troopsUploadSubmit", {
                      defaultValue: "Process screenshot"
                    })}
              </button>
            </div>
            {troopsUploadSuccess ? (
              <span className="ui-success text-sm">{troopsUploadSuccess}</span>
            ) : null}
            {troopsUploadError ? (
              <p className="ui-error">{troopsUploadError}</p>
            ) : null}
          </div>
        </div>
        <div className="ui-card-muted">
          <div className="flex flex-col gap-3">
            <p className="font-semibold">
              {t("profiles.notificationsTitle", {
                defaultValue: "Notifications"
              })}
            </p>
            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-accent"
                checked={dmOptIn}
                onChange={(event) => onDmOptInChange(event.target.checked)}
                disabled={dmOptInBusy}
              />
              <span>
                {t("profiles.discordDmOptInLabel")}
                <span className="block text-xs text-muted">
                  {t("profiles.discordDmOptInHint")}
                </span>
              </span>
            </label>
            {dmOptInError && <p className="ui-error">{dmOptInError}</p>}
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
