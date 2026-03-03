import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Alliance, Profile, User } from "@shared/types";
import { createAlliance, deleteAlliance, fetchAlliances } from "./api/alliances";
import { createProfile, fetchAllianceProfiles, updateAllianceProfile, updateProfile } from "./api/profile";
import { lookupPlayer } from "./api/playerLookup";
import { ApiError } from "./apiClient";

type Props = {
  user: User | null;
  profiles: Profile[];
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
  selectedProfile: Profile | null;
  selectedProfileId: string;
};

const emptyForm = {
  playerId: ""
};

function Profiles({
  user,
  profiles,
  setProfiles,
  selectedProfile,
  selectedProfileId
}: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lookupStatus, setLookupStatus] = useState("");
  const [joinAllianceId, setJoinAllianceId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");
  const [createTag, setCreateTag] = useState("");
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  const canManage =
    Boolean(user?.isAppAdmin) || selectedProfile?.role === "alliance_admin";

  useEffect(() => {
    if (!selectedProfileId || !canManage) {
      setAdminProfiles([]);
      return;
    }
    setLoadingAdmin(true);
    fetchAllianceProfiles(selectedProfileId)
      .then((data) => setAdminProfiles(data))
      .catch(() => setAdminProfiles([]))
      .finally(() => setLoadingAdmin(false));
  }, [selectedProfileId, canManage]);

  useEffect(() => {
    setJoinError("");
    setJoinSuccess("");
    setJoinAllianceId("");
    setCreateError("");
    setCreateSuccess("");
    setCreateTag("");
    setCreateName("");
    if (!selectedProfile || selectedProfile.allianceId) {
      setAlliances([]);
      return;
    }
    fetchAlliances(selectedProfile.kingdomId)
      .then(setAlliances)
      .catch(() => setAlliances([]));
  }, [selectedProfile]);

  function extractPlayerName(payload: any) {
    const data = payload?.data ?? payload;
    return (
      data?.data?.data?.name ??
      data?.data?.data?.nickname ??
      data?.data?.data?.player_name ??
      data?.data?.data?.role_name ??
      data?.data?.name ??
      data?.data?.nickname ??
      data?.data?.player_name ??
      data?.data?.role_name ??
      data?.data?.info?.name ??
      data?.data?.info?.nickname ??
      data?.data?.info?.player_name ??
      data?.data?.info?.role_name ??
      data?.info?.name ??
      data?.info?.nickname ??
      data?.info?.player_name ??
      data?.info?.role_name ??
      ""
    );
  }

  function extractPlayerAvatar(payload: any) {
    const data = payload?.data ?? payload;
    return (
      data?.data?.data?.avatar ??
      data?.data?.data?.avatar_url ??
      data?.data?.data?.avatar_image ??
      data?.data?.data?.headimg ??
      data?.data?.data?.headimgurl ??
      data?.data?.data?.icon ??
      data?.data?.data?.profile?.avatar ??
      data?.data?.avatar ??
      data?.data?.avatar_url ??
      data?.data?.avatar_image ??
      data?.data?.headimg ??
      data?.data?.headimgurl ??
      data?.data?.icon ??
      data?.data?.profile?.avatar ??
      data?.avatar ??
      data?.avatar_url ??
      data?.headimg ??
      data?.headimgurl ??
      data?.icon ??
      data?.profile?.avatar ??
      ""
    );
  }

  function extractKingdomId(payload: any) {
    const data = payload?.data ?? payload;
    const kingdom =
      data?.data?.data?.kid ??
      data?.data?.kid ??
      data?.kid ??
      null;
    return Number.isFinite(Number(kingdom)) ? Number(kingdom) : null;
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLookupStatus("");

    if (!form.playerId.trim()) {
      setError(t("profiles.errors.playerIdRequired"));
      return;
    }

    let playerName = "";
    let playerAvatar = "";
    let kingdomId: number | null = null;
    try {
      setLookupStatus(t("profiles.lookupStatus"));
      const lookup = await lookupPlayer(form.playerId.trim());
      playerName = extractPlayerName(lookup);
      playerAvatar = extractPlayerAvatar(lookup);
      kingdomId = extractKingdomId(lookup);
      if (!playerName) {
        throw new Error(t("profiles.errors.lookupFailed"));
      }
      setLookupStatus(t("profiles.lookupFound", { name: playerName }));
    } catch (lookupError) {
      setLookupStatus("");
      setError(t("profiles.errors.lookupFailed"));
      return;
    }

    const payload = {
      playerId: form.playerId.trim(),
      playerName: playerName || null,
      playerAvatar: playerAvatar || null,
      kingdomId
    };

    try {
      const profile = await createProfile(payload);
      if (!profile) {
        setError(t("profiles.errors.createFailed"));
        return;
      }
      setProfiles((prev) => [...prev, profile]);
      setForm(emptyForm);
      setSuccess(t("profiles.created"));
    } catch (createError) {
      if (createError instanceof ApiError) {
        if (createError.status === 409) {
          setError(t("profiles.errors.duplicate"));
          return;
        }
        if (createError.status === 400) {
          const message = createError.message.toLowerCase();
          if (message.includes("alliance")) {
            setError(t("profiles.errors.invalidAlliance"));
            return;
          }
          if (message.includes("playerid")) {
            setError(t("profiles.errors.playerIdRequired"));
            return;
          }
        }
      }
      setError(t("profiles.errors.createFailed"));
    }
  }

  async function refreshProfileData() {
    if (!selectedProfile?.playerId) return;
    setError("");
    setSuccess("");
    setLookupStatus("");
    try {
      setLookupStatus(t("profiles.lookupStatus"));
      const lookup = await lookupPlayer(selectedProfile.playerId);
      const playerName = extractPlayerName(lookup);
      const rawAvatar = extractPlayerAvatar(lookup);
      const playerAvatar = rawAvatar
        ? `${rawAvatar}${rawAvatar.includes("?") ? "&" : "?"}v=${Date.now()}`
        : "";
      const kingdomId = extractKingdomId(lookup);
      if (!playerName) {
        throw new Error(t("profiles.errors.lookupFailed"));
      }
      const updated = await updateProfile(selectedProfile.id, {
        playerName: playerName || null,
        playerAvatar: playerAvatar || null,
        kingdomId
      });
      if (updated) {
        setProfiles((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setSuccess(t("profiles.refreshed"));
      } else {
        setError(t("profiles.errors.updateFailed"));
      }
    } catch {
      setError(t("profiles.errors.lookupFailed"));
    } finally {
      setLookupStatus("");
    }
  }

  async function approveProfile(target: Profile, status: "pending" | "active") {
    if (!selectedProfileId) return;
    const updated = await updateAllianceProfile(selectedProfileId, target.id, {
      status
    });
    if (!updated) return;
    setAdminProfiles((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  async function setRole(target: Profile, role: "member" | "alliance_admin") {
    if (!selectedProfileId) return;
    const updated = await updateAllianceProfile(selectedProfileId, target.id, { role });
    if (!updated) return;
    setAdminProfiles((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  async function submitJoinRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoinError("");
    setJoinSuccess("");

    if (!selectedProfile) return;
    if (!selectedProfile.kingdomId) {
      setJoinError(t("profiles.errors.kingdomRequired"));
      return;
    }
    if (!joinAllianceId) {
      setJoinError(t("profiles.errors.allianceRequired"));
      return;
    }

    const updated = await updateProfile(selectedProfile.id, {
      allianceId: joinAllianceId
    });
    if (!updated) {
      setJoinError(t("profiles.errors.joinFailed"));
      return;
    }
    setProfiles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setJoinSuccess(t("profiles.joinRequested"));
  }

  async function submitCreateAlliance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!selectedProfile) return;
    if (!selectedProfile.kingdomId) {
      setCreateError(t("profiles.errors.kingdomRequired"));
      return;
    }
    const tag = createTag.trim().toUpperCase();
    if (tag.length !== 3) {
      setCreateError(t("profiles.errors.tagRequired"));
      return;
    }
    const name = createName.trim();
    if (!name) {
      setCreateError(t("profiles.errors.nameRequired"));
      return;
    }

    const result = await createAlliance({
      tag,
      name,
      profileId: selectedProfile.id,
    });
    const updatedProfile = result.profile;
    if (!result.alliance || !updatedProfile) {
      setCreateError(t("profiles.errors.createAllianceFailed"));
      return;
    }
    setProfiles((prev) =>
      prev.map((item) => (item.id === updatedProfile.id ? updatedProfile : item))
    );
    setCreateSuccess(t("profiles.createdAlliance"));
  }

  async function handleDeleteAlliance() {
    if (!selectedProfile || !selectedProfile.allianceId) return;
    setDeleteError("");
    const confirmed = window.confirm(t("profiles.deleteConfirm"));
    if (!confirmed) return;
    const ok = await deleteAlliance({
      allianceId: selectedProfile.allianceId,
      profileId: selectedProfile.id,
    });
    if (!ok) {
      setDeleteError(t("profiles.errors.deleteAllianceFailed"));
      return;
    }
    setProfiles((prev) =>
      prev.map((item) =>
        item.allianceId === selectedProfile.allianceId
          ? {
              ...item,
              allianceId: null,
              allianceName: null,
              role: "member",
              status: "pending",
            }
          : item
      )
    );
  }

  return (
    <div className="app">
      <header className="relative z-[1] mb-8 flex flex-col gap-4 nav:flex-row nav:items-stretch nav:justify-between">
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

      <main className="relative z-[1] grid gap-6">
        <section className="ui-card">
          <div className="ui-section-header">
            <h2 className="ui-section-title">{t("profiles.createTitle")}</h2>
            <p className="ui-section-subtitle">{t("profiles.createSubtitle")}</p>
          </div>
          <form
            className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(4,minmax(0,1fr))_160px] nav:items-end"
            onSubmit={submitProfile}
          >
            <label className="ui-field">
              {t("profiles.playerId")}
              <input
                name="playerId"
                value={form.playerId}
                onChange={(e) => setForm({ ...form, playerId: e.target.value })}
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

        {selectedProfile && (
          <section className="ui-card">
            <div className="flex flex-col gap-4 nav:flex-row nav:items-start nav:justify-between">
              <div className="ui-section-header">
                <h2 className="ui-section-title">{t("profiles.currentTitle")}</h2>
                <p className="ui-section-subtitle">{t("profiles.currentSubtitle")}</p>
              </div>
              <button className="ui-button-ghost" type="button" onClick={refreshProfileData}>
                {t("profiles.refreshProfile", { defaultValue: "Refresh profile" })}
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between">
                <div>
                  <p className="font-semibold">
                    {selectedProfile.playerName || selectedProfile.playerId}
                  </p>
                  <p className="text-sm text-muted">
                    {selectedProfile.allianceName || t("profiles.noAlliance")}
                  </p>
                  {selectedProfile.kingdomId ? (
                    <p className="text-sm text-muted">
                      {t("profiles.kingdom", {
                        id: selectedProfile.kingdomId,
                        defaultValue: "Kingdom {{id}}"
                      })}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted">
                    {t("profiles.role", { role: selectedProfile.role })}
                  </p>
                </div>
                <span className="ui-badge">
                  {selectedProfile.status === "active"
                    ? t("profiles.active")
                    : t("profiles.pending")}
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
                        selectedProfile.troopCount !== null &&
                        selectedProfile.troopCount !== undefined
                          ? new Intl.NumberFormat().format(selectedProfile.troopCount)
                          : t("profiles.stats.none", { defaultValue: "Not set" }),
                      defaultValue: "Troop count: {{value}}"
                    })}
                  </p>
                  <p className="text-sm text-muted">
                    {t("profiles.stats.marchCount", {
                      value:
                        selectedProfile.marchCount !== null &&
                        selectedProfile.marchCount !== undefined
                          ? new Intl.NumberFormat().format(selectedProfile.marchCount)
                          : t("profiles.stats.none", { defaultValue: "Not set" }),
                      defaultValue: "March count: {{value}}"
                    })}
                  </p>
                  <p className="text-sm text-muted">
                    {t("profiles.stats.power", {
                      value:
                        selectedProfile.power !== null &&
                        selectedProfile.power !== undefined
                          ? new Intl.NumberFormat().format(selectedProfile.power)
                          : t("profiles.stats.none", { defaultValue: "Not set" }),
                      defaultValue: "Power: {{value}}"
                    })}
                  </p>
                  <p className="text-sm text-muted">
                    {t("profiles.stats.rallySize", {
                      value:
                        selectedProfile.rallySize !== null &&
                        selectedProfile.rallySize !== undefined
                          ? new Intl.NumberFormat().format(selectedProfile.rallySize)
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
        )}

        {selectedProfile && !selectedProfile.allianceId && (
          <section className="ui-card">
            <div className="ui-section-header">
              <h2 className="ui-section-title">{t("profiles.joinTitle")}</h2>
              <p className="ui-section-subtitle">{t("profiles.joinSubtitle")}</p>
            </div>
            {!selectedProfile.kingdomId ? (
              <p className="ui-empty-state">{t("profiles.joinMissingKingdom")}</p>
            ) : (
              <form
                className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(4,minmax(0,1fr))_160px] nav:items-end"
                onSubmit={submitJoinRequest}
              >
                <label className="ui-field">
                  {t("profiles.alliance")}
                  <select
                    name="allianceId"
                    value={joinAllianceId}
                    onChange={(e) => setJoinAllianceId(e.target.value)}
                    className="ui-input"
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
        )}

        {selectedProfile && !selectedProfile.allianceId && (
          <section className="ui-card">
            <div className="ui-section-header">
              <h2 className="ui-section-title">
                {t("profiles.createAllianceTitle")}
              </h2>
              <p className="ui-section-subtitle">{t("profiles.createAllianceSubtitle")}</p>
            </div>
            {!selectedProfile.kingdomId ? (
              <p className="ui-empty-state">{t("profiles.joinMissingKingdom")}</p>
            ) : (
              <form
                className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(4,minmax(0,1fr))_160px] nav:items-end"
                onSubmit={submitCreateAlliance}
              >
                <label className="ui-field">
                  {t("profiles.allianceTag")}
                  <input
                    name="allianceTag"
                    value={createTag}
                    onChange={(e) => setCreateTag(e.target.value.toUpperCase())}
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
                    onChange={(e) => setCreateName(e.target.value)}
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
        )}

        {canManage && selectedProfile?.status === "active" && (
          <section className="ui-card">
            <div className="flex flex-col gap-4 nav:flex-row nav:items-start nav:justify-between">
              <div className="ui-section-header">
                <h2 className="ui-section-title">{t("profiles.adminTitle")}</h2>
                <p className="ui-section-subtitle">{t("profiles.adminSubtitle")}</p>
                {selectedProfile.allianceName && (
                  <div className="mt-3 inline-flex items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      {selectedProfile.allianceName}
                    </h3>
                    <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.14rem] text-accent">
                      {(selectedProfile.allianceId || "").toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {selectedProfile?.role === "alliance_admin" && (
                <div className="flex flex-col gap-3 nav:items-end">
                  <button className="ui-button-ghost" type="button" onClick={handleDeleteAlliance}>
                    {t("profiles.deleteAlliance")}
                  </button>
                  {deleteError && <p className="ui-error">{deleteError}</p>}
                </div>
              )}
            </div>
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
                                {profile.userDisplayName || profile.allianceName}
                              </p>
                            </div>
                            {profile.id !== selectedProfile?.id && (
                              <div className="flex items-center gap-3">
                                <button
                                  className="ui-button-ghost ui-button-sm"
                                  type="button"
                                  onClick={() => approveProfile(profile, "active")}
                                >
                                  {t("profiles.approve")}
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
                          <p className="font-semibold">
                            {profile.playerName || profile.playerId}
                          </p>
                          <p className="text-sm text-muted">
                            {profile.userDisplayName || profile.allianceName}
                          </p>
                          <p className="text-sm text-muted">
                            {t("profiles.role", { role: profile.role })}
                          </p>
                        </div>
                        {profile.id !== selectedProfile?.id && (
                          <div className="flex items-center gap-3">
                            <button
                              className="ui-button-ghost ui-button-sm"
                              type="button"
                              onClick={() => approveProfile(profile, "pending")}
                            >
                              {t("profiles.suspend")}
                            </button>
                            <button
                              className="ui-button-ghost ui-button-sm"
                              type="button"
                              onClick={() =>
                                setRole(
                                  profile,
                                  profile.role === "member"
                                    ? "alliance_admin"
                                    : "member"
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
        )}
      </main>
    </div>
  );
}

export default Profiles;
