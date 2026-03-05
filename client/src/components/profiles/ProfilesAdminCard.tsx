import React from "react";
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
  onAddPlayerIdChange: (value: string) => void;
  onSubmitAdminAdd: (event: React.FormEvent<HTMLFormElement>) => void;
  onApproveProfile: (profile: Profile, status: "pending" | "active") => void;
  onRejectProfile: (profile: Profile) => void;
  onSetRole: (profile: Profile, role: "member" | "alliance_admin") => void;
  onDeleteAlliance: () => void;
};

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
  onAddPlayerIdChange,
  onSubmitAdminAdd,
  onApproveProfile,
  onRejectProfile,
  onSetRole,
  onDeleteAlliance
}: Props) {
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
              <div className="mt-3 grid gap-3">
                {adminProfiles
                  .filter((profile) => profile.status !== "active")
                  .map((profile) => (
                    <div
                      key={profile.id}
                      className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
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
                            type="button"
                            onClick={() => onApproveProfile(profile, "active")}
                          >
                            {t("profiles.approve")}
                          </button>
                          <button
                            className="ui-button-ghost ui-button-sm"
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
            {t("profiles.membersTitle")}
          </h3>
          <div className="mt-3 grid gap-3">
            {adminProfiles
              .filter((profile) => profile.status === "active")
              .map((profile) => (
                <div
                  key={profile.id}
                  className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
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
                        type="button"
                        onClick={() => onApproveProfile(profile, "pending")}
                      >
                        {t("profiles.suspend")}
                      </button>
                      <button
                        className="ui-button-ghost ui-button-sm"
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
