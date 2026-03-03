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
    if (!result.alliance || !result.profile) {
      setCreateError(t("profiles.errors.createAllianceFailed"));
      return;
    }
    setProfiles((prev) =>
      prev.map((item) => (item.id === result.profile.id ? result.profile : item))
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
      <header className="hero">
        <div className="hero-content">
          <p className="eyebrow">{t("profiles.eyebrow")}</p>
          <h1>{t("profiles.title")}</h1>
          <p className="hero-subtitle">{t("profiles.subtitle")}</p>
          {selectedProfile &&
            selectedProfile.status !== "active" &&
            selectedProfile.allianceId && (
            <p className="error">{t("profiles.pendingNotice")}</p>
          )}
        </div>
      </header>

      <main>
        <section className="panel">
          <div className="panel-header">
            <h2>{t("profiles.createTitle")}</h2>
            <p>{t("profiles.createSubtitle")}</p>
          </div>
          <form className="signup-form" onSubmit={submitProfile}>
            <label>
              {t("profiles.playerId")}
              <input
                name="playerId"
                value={form.playerId}
                onChange={(e) => setForm({ ...form, playerId: e.target.value })}
                placeholder="243656992"
                required
              />
            </label>
            {lookupStatus && <span className="lookup-status">{lookupStatus}</span>}
            <button className="primary-button" type="submit">
              {t("profiles.create")}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </section>

        {selectedProfile && (
          <section className="panel">
            <div className="panel-header">
              <h2>{t("profiles.currentTitle")}</h2>
              <p>{t("profiles.currentSubtitle")}</p>
            </div>
            <div className="roster">
              <div className="roster-card">
                <div>
                  <p className="roster-name">
                    {selectedProfile.playerName || selectedProfile.playerId}
                  </p>
                  <p className="roster-meta">
                    {selectedProfile.allianceName || t("profiles.noAlliance")}
                  </p>
                  {selectedProfile.kingdomId ? (
                    <p className="roster-meta">
                      {t("profiles.kingdom", {
                        id: selectedProfile.kingdomId,
                        defaultValue: "Kingdom {{id}}"
                      })}
                    </p>
                  ) : null}
                  <p className="roster-meta">
                    {t("profiles.role", { role: selectedProfile.role })}
                  </p>
                </div>
                <span className="badge">
                  {selectedProfile.status === "active"
                    ? t("profiles.active")
                    : t("profiles.pending")}
                </span>
              </div>
              <div className="roster-card">
                <div>
                  <p className="roster-name">
                    {t("profiles.statsTitle", { defaultValue: "Profile stats" })}
                  </p>
                  <p className="roster-meta">
                    {t("profiles.stats.troopCount", {
                      value:
                        selectedProfile.troopCount !== null &&
                        selectedProfile.troopCount !== undefined
                          ? new Intl.NumberFormat().format(selectedProfile.troopCount)
                          : t("profiles.stats.none", { defaultValue: "Not set" }),
                      defaultValue: "Troop count: {{value}}"
                    })}
                  </p>
                  <p className="roster-meta">
                    {t("profiles.stats.marchCount", {
                      value:
                        selectedProfile.marchCount !== null &&
                        selectedProfile.marchCount !== undefined
                          ? new Intl.NumberFormat().format(selectedProfile.marchCount)
                          : t("profiles.stats.none", { defaultValue: "Not set" }),
                      defaultValue: "March count: {{value}}"
                    })}
                  </p>
                  <p className="roster-meta">
                    {t("profiles.stats.power", {
                      value:
                        selectedProfile.power !== null &&
                        selectedProfile.power !== undefined
                          ? new Intl.NumberFormat().format(selectedProfile.power)
                          : t("profiles.stats.none", { defaultValue: "Not set" }),
                      defaultValue: "Power: {{value}}"
                    })}
                  </p>
                  <p className="roster-meta">
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
          </section>
        )}

        {selectedProfile && !selectedProfile.allianceId && (
          <section className="panel">
            <div className="panel-header">
              <h2>{t("profiles.joinTitle")}</h2>
              <p>{t("profiles.joinSubtitle")}</p>
            </div>
            {!selectedProfile.kingdomId ? (
              <p className="empty">{t("profiles.joinMissingKingdom")}</p>
            ) : (
              <form className="signup-form" onSubmit={submitJoinRequest}>
                <label>
                  {t("profiles.alliance")}
                  <select
                    name="allianceId"
                    value={joinAllianceId}
                    onChange={(e) => setJoinAllianceId(e.target.value)}
                  >
                    <option value="">{t("profiles.allianceNone")}</option>
                    {alliances.map((alliance) => (
                      <option key={alliance.id} value={alliance.id}>
                        {alliance.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary-button" type="submit">
                  {t("profiles.join")}
                </button>
              </form>
            )}
            {joinError && <p className="error">{joinError}</p>}
            {joinSuccess && <p className="success">{joinSuccess}</p>}
          </section>
        )}

        {selectedProfile && !selectedProfile.allianceId && (
          <section className="panel">
            <div className="panel-header">
              <h2>{t("profiles.createAllianceTitle")}</h2>
              <p>{t("profiles.createAllianceSubtitle")}</p>
            </div>
            {!selectedProfile.kingdomId ? (
              <p className="empty">{t("profiles.joinMissingKingdom")}</p>
            ) : (
              <form className="signup-form" onSubmit={submitCreateAlliance}>
                <label>
                  {t("profiles.allianceTag")}
                  <input
                    name="allianceTag"
                    value={createTag}
                    onChange={(e) => setCreateTag(e.target.value.toUpperCase())}
                    placeholder="ART"
                    maxLength={3}
                    required
                  />
                </label>
                <label>
                  {t("profiles.allianceName")}
                  <input
                    name="allianceName"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="ArtsOFwar"
                    required
                  />
                </label>
                <button className="primary-button" type="submit">
                  {t("profiles.createAlliance")}
                </button>
              </form>
            )}
            {createError && <p className="error">{createError}</p>}
            {createSuccess && <p className="success">{createSuccess}</p>}
          </section>
        )}

        {canManage && selectedProfile?.status === "active" && (
          <section className="panel">
            <div className="panel-header panel-header-split">
              <div>
                <h2>{t("profiles.adminTitle")}</h2>
                <p>{t("profiles.adminSubtitle")}</p>
                {selectedProfile.allianceName && (
                  <div className="alliance-header">
                    <h3 className="alliance-name">{selectedProfile.allianceName}</h3>
                    <span className="alliance-tag">
                      {(selectedProfile.allianceId || "").toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {selectedProfile?.role === "alliance_admin" && (
                <div className="panel-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={handleDeleteAlliance}
                  >
                    {t("profiles.deleteAlliance")}
                  </button>
                  {deleteError && <p className="error">{deleteError}</p>}
                </div>
              )}
            </div>
            {loadingAdmin ? (
              <p className="empty">{t("profiles.loading")}</p>
            ) : adminProfiles.length === 0 ? (
              <p className="empty">{t("profiles.adminEmpty")}</p>
            ) : (
              <>
                {adminProfiles.some((profile) => profile.status !== "active") ? (
                  <>
                    <h3 className="section-subtitle">
                      {t("profiles.applicantsTitle")}
                    </h3>
                    <div className="roster">
                      {adminProfiles
                        .filter((profile) => profile.status !== "active")
                        .map((profile) => (
                          <div key={profile.id} className="roster-card">
                            <div>
                              <p className="roster-name">
                                {profile.playerName || profile.playerId}
                              </p>
                              <p className="roster-meta">
                                {profile.userDisplayName || profile.allianceName}
                              </p>
                            </div>
                            {profile.id !== selectedProfile?.id && (
                              <div className="roster-actions">
                                <button
                                  className="ghost-button small"
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

                <h3 className="section-subtitle section-divider">
                  {t("profiles.membersTitle")}
                </h3>
                <div className="roster">
                  {adminProfiles
                    .filter((profile) => profile.status === "active")
                    .map((profile) => (
                      <div key={profile.id} className="roster-card">
                        <div>
                          <p className="roster-name">
                            {profile.playerName || profile.playerId}
                          </p>
                          <p className="roster-meta">
                            {profile.userDisplayName || profile.allianceName}
                          </p>
                          <p className="roster-meta">
                            {t("profiles.role", { role: profile.role })}
                          </p>
                        </div>
                        {profile.id !== selectedProfile?.id && (
                          <div className="roster-actions">
                            <button
                              className="ghost-button small"
                              type="button"
                              onClick={() => approveProfile(profile, "pending")}
                            >
                              {t("profiles.suspend")}
                            </button>
                            <button
                              className="ghost-button small"
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
