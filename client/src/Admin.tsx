import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@shared/types";
import {
  deleteAdminProfile,
  fetchAdminProfile,
} from "./api/admin";
import {
  useAdminAllianceProfilesQuery,
  useAdminAlliancesQuery,
  useAdminKingdomsQuery
} from "./hooks/useAdminQueries";
import { useAdminAllianceProfileMutation } from "./hooks/useAdminAllianceProfileMutations";
import { useAdminDeleteAllianceMutation } from "./hooks/useAdminDeleteAllianceMutation";

type Props = {
  isAppAdmin: boolean;
};

function Admin({ isAppAdmin }: Props) {
  const { t } = useTranslation();
  const [selectedKingdom, setSelectedKingdom] = useState<number | null>(null);
  const [selectedAllianceId, setSelectedAllianceId] = useState("");
  const [profileLookupId, setProfileLookupId] = useState("");
  const [profileLookupResult, setProfileLookupResult] = useState<Profile | null>(null);
  const [profileLookupError, setProfileLookupError] = useState("");
  const [error, setError] = useState("");
  const kingdomsQuery = useAdminKingdomsQuery(isAppAdmin);
  const alliancesQuery = useAdminAlliancesQuery(selectedKingdom, isAppAdmin);
  const profilesQuery = useAdminAllianceProfilesQuery(selectedAllianceId, isAppAdmin);
  const allianceProfileMutation = useAdminAllianceProfileMutation(selectedAllianceId);
  const deleteAllianceMutation = useAdminDeleteAllianceMutation(selectedKingdom);
  const kingdoms = useMemo(() => kingdomsQuery.data ?? [], [kingdomsQuery.data]);
  const alliances = useMemo(() => alliancesQuery.data ?? [], [alliancesQuery.data]);
  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const loading = profilesQuery.isLoading;
  const profilesError =
    profilesQuery.isError && selectedAllianceId ? t("admin.loadFailed") : "";
  const activeError = profilesError || error;

  const selectedAlliance = useMemo(
    () => alliances.find((alliance) => alliance.id === selectedAllianceId) || null,
    [alliances, selectedAllianceId]
  );

  useEffect(() => {
    setSelectedAllianceId("");
  }, [selectedKingdom]);

  async function handleApprove(profile: Profile) {
    if (!selectedAllianceId) return;
    await allianceProfileMutation.mutateAsync({
      profileId: profile.id,
      payload: { status: "active" }
    });
  }

  async function handleReject(profile: Profile) {
    if (!selectedAllianceId) return;
    await allianceProfileMutation.mutateAsync({
      profileId: profile.id,
      payload: { action: "reject" }
    });
  }

  async function handleSuspend(profile: Profile) {
    if (!selectedAllianceId) return;
    await allianceProfileMutation.mutateAsync({
      profileId: profile.id,
      payload: { status: "pending" }
    });
  }

  async function handleRoleToggle(profile: Profile) {
    if (!selectedAllianceId) return;
    await allianceProfileMutation.mutateAsync({
      profileId: profile.id,
      payload: { role: profile.role === "member" ? "alliance_admin" : "member" }
    });
  }

  async function handleDeleteAlliance() {
    if (!selectedAllianceId || !selectedAlliance) return;
    const confirmed = window.confirm(
      t("admin.deleteAllianceConfirm", { name: selectedAlliance.name })
    );
    if (!confirmed) return;
    const ok = await deleteAllianceMutation.mutateAsync(selectedAllianceId);
    if (!ok) {
      setError(t("admin.deleteFailed"));
      return;
    }
    setSelectedAllianceId("");
    setError("");
  }

  async function handleLookupProfile() {
    const id = profileLookupId.trim();
    if (!id) return;
    setProfileLookupError("");
    try {
      const profile = await fetchAdminProfile(id);
      setProfileLookupResult(profile);
      if (!profile) {
        setProfileLookupError(t("admin.profileLookup.notFound"));
      }
    } catch {
      setProfileLookupError(t("admin.profileLookup.error"));
      setProfileLookupResult(null);
    }
  }

  async function handleDeleteProfile() {
    if (!profileLookupResult) return;
    const confirmed = window.confirm(t("admin.profileLookup.confirmDelete"));
    if (!confirmed) return;
    try {
      const ok = await deleteAdminProfile(profileLookupResult.id);
      if (ok) {
        setProfileLookupResult(null);
        setProfileLookupId("");
      } else {
        setProfileLookupError(t("admin.profileLookup.error"));
      }
    } catch {
      setProfileLookupError(t("admin.profileLookup.error"));
    }
  }

  if (!isAppAdmin) {
    return (
      <div className="app">
        <section className="ui-card">
          <div className="ui-section-header">
            <h2 className="ui-section-title">{t("admin.title")}</h2>
            <p className="ui-section-subtitle">{t("admin.notAuthorized")}</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="relative z-[1] mb-8">
        <p className="text-xs uppercase tracking-[0.15em] text-accent-dark">
          {t("admin.eyebrow")}
        </p>
        <h1 className="mt-2 font-['DM Serif Display'] text-[clamp(2.4rem,3vw,3.5rem)]">
          {t("admin.title")}
        </h1>
        <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed text-muted">
          {t("admin.subtitle")}
        </p>
      </header>

      <main className="relative z-[1] grid gap-6">
        <section className="ui-card">
          <div className="ui-section-header">
            <h2 className="ui-section-title">{t("admin.selectTitle")}</h2>
            <p className="ui-section-subtitle">{t("admin.selectSubtitle")}</p>
          </div>
          <div className="mt-5 grid gap-4 nav:grid-cols-2">
            <label className="ui-field">
              {t("admin.kingdom")}
              <select
                className="ui-select"
                data-testid="admin-kingdom-select"
                value={selectedKingdom ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedKingdom(value ? Number(value) : null);
                }}
              >
                <option value="">{t("admin.kingdomPlaceholder")}</option>
                {kingdoms.map((kingdom) => (
                  <option key={kingdom} value={kingdom}>
                    {t("admin.kingdomValue", { id: kingdom })}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              {t("admin.alliance")}
              <select
                className="ui-select"
                data-testid="admin-alliance-select"
                value={selectedAllianceId}
                onChange={(event) => setSelectedAllianceId(event.target.value)}
                disabled={!selectedKingdom}
              >
                <option value="">{t("admin.alliancePlaceholder")}</option>
                {alliances.map((alliance) => (
                  <option key={alliance.id} value={alliance.id}>
                    {alliance.name} ({alliance.id.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="ui-card">
          <div className="ui-section-header">
            <h2 className="ui-section-title">{t("admin.profileLookup.title")}</h2>
            <p className="ui-section-subtitle">{t("admin.profileLookup.subtitle")}</p>
          </div>
          <div className="mt-5 grid gap-4 nav:grid-cols-[minmax(0,1fr)_minmax(140px,200px)] nav:items-end">
            <label className="ui-field">
              {t("admin.profileLookup.label")}
              <input
                className="ui-input"
                value={profileLookupId}
                onChange={(event) => setProfileLookupId(event.target.value)}
                placeholder={t("admin.profileLookup.placeholder")}
              />
            </label>
            <button className="ui-button" type="button" onClick={handleLookupProfile}>
              {t("admin.profileLookup.cta")}
            </button>
          </div>
          {profileLookupError && <p className="ui-error mt-3">{profileLookupError}</p>}
          {profileLookupResult && (
            <div className="ui-card-muted mt-4 flex flex-col gap-3 p-3 nav:flex-row nav:items-center nav:justify-between">
              <div>
                <p className="font-semibold">
                  {profileLookupResult.playerName || profileLookupResult.playerId}
                </p>
                <p className="text-sm text-muted">
                  {t("admin.profileLookup.meta", {
                    id: profileLookupResult.id,
                    kingdomId: profileLookupResult.kingdomId || "—",
                  })}
                </p>
              </div>
              <button className="ui-button-ghost ui-button-sm" onClick={handleDeleteProfile}>
                {t("admin.profileLookup.delete")}
              </button>
            </div>
          )}
        </section>

        {selectedAlliance && (
          <section className="ui-card">
            <div className="flex flex-col gap-4 nav:flex-row nav:items-start nav:justify-between">
              <div className="ui-section-header">
                <h2 className="ui-section-title">{t("admin.allianceTitle")}</h2>
                <p className="ui-section-subtitle">
                  {t("admin.allianceSubtitle", {
                    name: selectedAlliance.name,
                    tag: selectedAlliance.id.toUpperCase(),
                  })}
                </p>
              </div>
              <button className="ui-button-ghost" type="button" onClick={handleDeleteAlliance}>
                {t("admin.deleteAlliance")}
              </button>
            </div>
            {activeError && <p className="ui-error">{activeError}</p>}
            {loading ? (
              <p className="ui-empty-state">{t("admin.loading")}</p>
            ) : (
              <>
                {profiles.some((profile) => profile.status !== "active") ? (
                  <>
                    <h3 className="mt-5 text-base font-semibold">
                      {t("admin.applicantsTitle")}
                    </h3>
                    <div className="mt-3 grid gap-3" data-testid="admin-applicants-list">
                      {profiles
                        .filter((profile) => profile.status !== "active")
                        .map((profile) => (
                          <div
                            key={profile.id}
                            className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
                            data-testid={`admin-applicant-${profile.id}`}
                          >
                            <div>
                              <p className="font-semibold">
                                {profile.playerName || profile.playerId}
                              </p>
                              <p className="text-sm text-muted">
                                {profile.userDisplayName || t("profiles.unclaimed")}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                className="ui-button-ghost ui-button-sm"
                                data-testid={`admin-approve-${profile.id}`}
                                type="button"
                                onClick={() => handleApprove(profile)}
                              >
                                {t("admin.approve")}
                              </button>
                              <button
                                className="ui-button-ghost ui-button-sm"
                                data-testid={`admin-reject-${profile.id}`}
                                type="button"
                                onClick={() => handleReject(profile)}
                              >
                                {t("admin.reject")}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <p className="ui-empty-state">{t("admin.noApplicants")}</p>
                )}

                <h3 className="mt-5 border-t border-black/10 pt-4 text-base font-semibold">
                  {t("admin.membersTitle")}
                </h3>
                <div className="mt-3 grid gap-3" data-testid="admin-members-list">
                  {profiles
                    .filter((profile) => profile.status === "active")
                    .map((profile) => (
                      <div
                        key={profile.id}
                        className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
                        data-testid={`admin-member-${profile.id}`}
                      >
                        <div>
                          <p className="font-semibold">
                            {profile.playerName || profile.playerId}
                          </p>
                          <p className="text-sm text-muted">
                            {profile.userDisplayName || t("profiles.unclaimed")}
                          </p>
                          <p className="text-sm text-muted">
                            {t("admin.role", { role: profile.role })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            className="ui-button-ghost ui-button-sm"
                            data-testid={`admin-suspend-${profile.id}`}
                            type="button"
                            onClick={() => handleSuspend(profile)}
                          >
                            {t("admin.suspend")}
                          </button>
                          <button
                            className="ui-button-ghost ui-button-sm"
                            data-testid={
                              profile.role === "member"
                                ? `admin-make-admin-${profile.id}`
                                : `admin-make-member-${profile.id}`
                            }
                            type="button"
                            onClick={() => handleRoleToggle(profile)}
                          >
                            {profile.role === "member"
                              ? t("admin.makeAdmin")
                              : t("admin.makeMember")}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default Admin;
