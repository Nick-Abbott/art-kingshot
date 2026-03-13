import React, { useCallback, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import type { Profile } from "@shared/types";

type Props = {
  t: TFunction;
  selectedProfile: Profile;
  adminProfiles: Profile[];
  loadingAdmin: boolean;
  addPlayerId: string;
  addLookupStatus: string;
  addPlayerBusy: boolean;
  addPlayerError: string;
  addPlayerSuccess: string;
  deleteError: string;
  showAllianceSettings: boolean;
  timeMode: "local" | "utc";
  settingsBear1NextTime: string;
  settingsBear2NextTime: string;
  settingsBusy: boolean;
  settingsError: string;
  settingsSuccess: string;
  onAddPlayerIdChange: (value: string) => void;
  onSubmitAdminAdd: (event: React.FormEvent<HTMLFormElement>) => void;
  onApproveProfile: (profile: Profile, status: "pending" | "active") => void;
  onRejectProfile: (profile: Profile) => void;
  onSetRole: (profile: Profile, role: "member" | "alliance_admin") => void;
  onDeleteAlliance: () => void;
  onTimeModeChange: (mode: "local" | "utc") => void;
  onSettingsBear1NextTimeChange: (value: string) => void;
  onSettingsBear2NextTimeChange: (value: string) => void;
  onSubmitAllianceSettings: (event: React.FormEvent<HTMLFormElement>) => void;
};

function normalize(value: string) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ProfilesAdminCard({
  t,
  selectedProfile,
  adminProfiles,
  loadingAdmin,
  addPlayerId,
  addLookupStatus,
  addPlayerBusy,
  addPlayerError,
  addPlayerSuccess,
  deleteError,
  showAllianceSettings,
  timeMode,
  settingsBear1NextTime,
  settingsBear2NextTime,
  settingsBusy,
  settingsError,
  settingsSuccess,
  onAddPlayerIdChange,
  onSubmitAdminAdd,
  onApproveProfile,
  onRejectProfile,
  onSetRole,
  onDeleteAlliance,
  onTimeModeChange,
  onSettingsBear1NextTimeChange,
  onSettingsBear2NextTimeChange,
  onSubmitAllianceSettings
}: Props) {
  const [memberSearch, setMemberSearch] = useState("");

  const fuzzyScore = useCallback((query: string, text: string) => {
    if (!query) return 0;
    const q = normalize(query);
    const tValue = normalize(text);
    if (!q || !tValue) return null;
    let qi = 0;
    let score = 0;
    let lastMatch = -1;
    for (let ti = 0; ti < tValue.length && qi < q.length; ti += 1) {
      if (tValue[ti] === q[qi]) {
        score += lastMatch === -1 ? 1 : Math.max(1, 5 - (ti - lastMatch));
        lastMatch = ti;
        qi += 1;
      }
    }
    if (qi < q.length) return null;
    return score;
  }, []);

  const activeMembers = useMemo(
    () => adminProfiles.filter((profile) => profile.status === "active"),
    [adminProfiles]
  );

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim();
    if (!query) return activeMembers;
    const scored = activeMembers
      .map((profile) => {
        const name = [
          profile.playerName,
          profile.playerId,
          profile.userDisplayName
        ]
          .filter(Boolean)
          .join(" ");
        const score = fuzzyScore(query, name);
        return score === null ? null : { profile, score };
      })
      .filter(
        (item): item is { profile: Profile; score: number } => item !== null
      )
      .sort((a, b) => b.score - a.score);
    return scored.map((item) => item.profile);
  }, [activeMembers, fuzzyScore, memberSearch]);
  return (
    <section className="ui-card">
      <div className="flex flex-col gap-4 nav:flex-row nav:items-start nav:justify-between">
        <div className="ui-section-header">
          <h2 className="ui-section-title">{t("profiles.adminTitle")}</h2>
          <p className="ui-section-subtitle">{t("profiles.adminSubtitle")}</p>
          {selectedProfile.allianceName && (
            <div className="mt-3 inline-flex items-center gap-3">
              <h3 className="text-lg font-semibold">{selectedProfile.allianceName}</h3>
              <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.14rem] text-accent">
                {(selectedProfile.allianceId || "").toUpperCase()}
              </span>
            </div>
          )}
        </div>
        {selectedProfile.role === "alliance_admin" && (
          <div className="flex flex-col gap-3 nav:items-end">
            <button className="ui-button-ghost" type="button" onClick={onDeleteAlliance}>
              {t("profiles.deleteAlliance")}
            </button>
            {deleteError && <p className="ui-error">{deleteError}</p>}
          </div>
        )}
      </div>
      {showAllianceSettings && (
        <div className="ui-card-muted mt-6">
          <div className="ui-section-header">
            <h3 className="ui-section-title">{t("profiles.allianceSettingsTitle")}</h3>
            <p className="ui-section-subtitle">{t("profiles.allianceSettingsSubtitle")}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-muted">
              {t("profiles.timeModeLabel")}
            </span>
            <div className="ui-pill ui-pill-muted gap-2 px-3">
              <span className="min-w-[3.75rem] text-center">
                {timeMode === "local" ? t("profiles.timeModeLocal") : t("profiles.timeModeUtc")}
              </span>
              <button
                className="ui-icon-button h-9 w-9"
                data-testid="profiles-time-mode-toggle"
                type="button"
                aria-label={t("profiles.timeModeToggle")}
                onClick={() => onTimeModeChange(timeMode === "local" ? "utc" : "local")}
              >
                <span className="text-lg leading-none" aria-hidden="true">⇄</span>
              </button>
            </div>
          </div>
          <form
            className="mt-4 grid gap-3 nav:grid-cols-[repeat(2,minmax(0,1fr))_auto] nav:items-end"
            onSubmit={onSubmitAllianceSettings}
          >
            <label className="ui-field">
              {t("profiles.bear1NextTimeLabel")}
              <input
                className="ui-input"
                type="datetime-local"
                value={settingsBear1NextTime}
                onChange={(event) => onSettingsBear1NextTimeChange(event.target.value)}
                required
              />
            </label>
            <label className="ui-field">
              {t("profiles.bear2NextTimeLabel")}
              <input
                className="ui-input"
                type="datetime-local"
                value={settingsBear2NextTime}
                onChange={(event) => onSettingsBear2NextTimeChange(event.target.value)}
                required
              />
            </label>
            <button className="ui-button" type="submit" disabled={settingsBusy}>
              {t("profiles.saveAllianceSettings")}
            </button>
          </form>
          {settingsError && <p className="ui-error">{settingsError}</p>}
          {settingsSuccess && <p className="ui-success">{settingsSuccess}</p>}
        </div>
      )}
      {selectedProfile.role === "alliance_admin" && (
        <form
          className="mt-5 flex flex-col gap-3 nav:grid nav:grid-cols-[minmax(0,1fr)_160px] nav:items-end"
          onSubmit={onSubmitAdminAdd}
        >
          <label className="ui-field">
            {t("profiles.adminAddPlayerId")}
            <input
              className="ui-input"
              value={addPlayerId}
              onChange={(event) => onAddPlayerIdChange(event.target.value)}
              placeholder="243656992"
              required
            />
          </label>
          {addLookupStatus && <span className="ui-field-hint">{addLookupStatus}</span>}
          <button className="ui-button" type="submit" disabled={addPlayerBusy}>
            {t("profiles.adminAddAction")}
          </button>
          {addPlayerError && <p className="ui-error">{addPlayerError}</p>}
          {addPlayerSuccess && <p className="ui-success">{addPlayerSuccess}</p>}
        </form>
      )}
      {loadingAdmin ? (
        <p className="ui-empty-state">{t("profiles.loading")}</p>
      ) : adminProfiles.length === 0 ? (
        <p className="ui-empty-state">{t("profiles.adminEmpty")}</p>
      ) : (
        <>
          {adminProfiles.some((profile) => profile.status !== "active") ? (
            <>
              <h3 className="mt-5 text-base font-semibold">
                {t("profiles.applicantsTitle")}
              </h3>
              <div className="mt-3 grid gap-3" data-testid="profiles-applicants-list">
                {adminProfiles
                  .filter((profile) => profile.status !== "active")
                  .map((profile) => (
                    <div
                      key={profile.id}
                      className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
                      data-testid={`profiles-applicant-${profile.id}`}
                    >
                      <div>
                        <p className="font-semibold">
                          {profile.playerName || profile.playerId}
                        </p>
                        <p className="text-sm text-muted">
                          {profile.userDisplayName || t("profiles.unclaimed")}
                        </p>
                      </div>
                      {profile.id !== selectedProfile.id && (
                        <div className="flex items-center gap-3">
                          <button
                            className="ui-button-ghost ui-button-sm"
                            data-testid={`profiles-approve-${profile.id}`}
                            type="button"
                            onClick={() => onApproveProfile(profile, "active")}
                          >
                            {t("profiles.approve")}
                          </button>
                          <button
                            className="ui-button-ghost ui-button-sm"
                            data-testid={`profiles-reject-${profile.id}`}
                            type="button"
                            onClick={() => onRejectProfile(profile)}
                          >
                            {t("profiles.reject")}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </>
          ) : null}

          <h3 className="mt-5 border-t border-black/10 pt-4 text-base font-semibold">
            {t("profiles.membersTitle", {
              count: activeMembers.length
            })}
          </h3>
          <div className="mt-3">
            <label className="ui-field">
              {t("profiles.membersSearchLabel")}
              <div className="flex flex-wrap items-center gap-2">
                <div className="ui-search flex-1">
                  <input
                    className="ui-input"
                    name="membersSearch"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder={t("profiles.membersSearchPlaceholder")}
                    autoComplete="off"
                  />
                </div>
                <button
                  className="ui-button-ghost ui-button-sm"
                  type="button"
                  onClick={() => setMemberSearch("")}
                  disabled={!memberSearch.trim()}
                >
                  {t("profiles.showAllMembers")}
                </button>
              </div>
            </label>
          </div>
          <div className="mt-3 grid gap-3" data-testid="profiles-members-list">
            {filteredMembers.map((profile) => (
                <div
                  key={profile.id}
                  className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
                  data-testid={`profiles-member-${profile.id}`}
                >
                  <div>
                    <p className="font-semibold">{profile.playerName || profile.playerId}</p>
                    <p className="text-sm text-muted">
                      {profile.userDisplayName || t("profiles.unclaimed")}
                    </p>
                    <p className="text-sm text-muted">
                      {t("profiles.role", { role: profile.role })}
                    </p>
                  </div>
                  {profile.id !== selectedProfile.id && (
                    <div className="flex items-center gap-3">
                      <button
                        className="ui-button-ghost ui-button-sm"
                        data-testid={`profiles-suspend-${profile.id}`}
                        type="button"
                        onClick={() => onApproveProfile(profile, "pending")}
                      >
                        {t("profiles.suspend")}
                      </button>
                      <button
                        className="ui-button-ghost ui-button-sm"
                        data-testid={
                          profile.role === "member"
                            ? `profiles-make-admin-${profile.id}`
                            : `profiles-make-member-${profile.id}`
                        }
                        type="button"
                        onClick={() =>
                          onSetRole(
                            profile,
                            profile.role === "member" ? "alliance_admin" : "member"
                          )
                        }
                      >
                        {profile.role === "member"
                          ? t("profiles.makeAdmin")
                          : t("profiles.makeMember")}
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </section>
  );
}

export default ProfilesAdminCard;
