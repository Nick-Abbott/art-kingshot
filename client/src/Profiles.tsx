import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, User } from "@shared/types";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { createAlliance, deleteAlliance } from "./api/alliances";
import { updateAllianceSettings } from "./api/allianceSettings";
import { lookupAndParsePlayer } from "./utils/playerLookup";
import { ApiError } from "./apiClient";
import { updateAssignmentDmOptIn } from "./api/user";
import {
  useCreateAllianceProfileMutation,
  useCreateProfileMutation,
  useUpdateProfileMutation
} from "./hooks/useProfileMutations";
import { profilesQueryKey } from "./hooks/useProfilesQuery";
import { useAllianceProfilesQuery } from "./hooks/useAllianceProfilesQuery";
import { useAlliancesQuery } from "./hooks/useAlliancesQuery";
import { useAllianceAdminActions } from "./hooks/useAllianceAdminActions";
import {
  useAllianceSettingsQuery,
  allianceSettingsQueryKey
} from "./hooks/useAllianceSettingsQuery";
import ProfilesAdminCard from "./components/profiles/ProfilesAdminCard";
import ProfilesCreateAllianceCard from "./components/profiles/ProfilesCreateAllianceCard";
import ProfilesCreateCard from "./components/profiles/ProfilesCreateCard";
import ProfilesCurrentCard from "./components/profiles/ProfilesCurrentCard";
import ProfilesHeader from "./components/profiles/ProfilesHeader";
import ProfilesJoinCard from "./components/profiles/ProfilesJoinCard";
import { parseDateTimeInputToUtcIso } from "./utils/time";
import { useAdminBearTimeSettings } from "./hooks/useAdminBearTimeSettings";

type Props = {
  user: User | null;
  selectedProfile: Profile | null;
  selectedProfileId: string;
};

const emptyForm = {
  playerId: ""
};

function Profiles({ user, selectedProfile, selectedProfileId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const createProfileMutation = useCreateProfileMutation();
  const updateProfileMutation = useUpdateProfileMutation();
  const createAllianceProfileMutation = useCreateAllianceProfileMutation();
  const assignmentOptInMutation = useMutation({
    mutationFn: (payload: { profileId: string; enabled: boolean }) =>
      updateAssignmentDmOptIn(payload.profileId, payload.enabled)
  });
  const settingsMutation = useMutation({
    mutationFn: (settings: { bearNextTimes: { bear1: string; bear2: string } }) =>
      updateAllianceSettings(selectedProfileId, settings)
  });
  const [form, setForm] = useState(emptyForm);
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
  const [dmOptIn, setDmOptIn] = useState(
    Boolean(selectedProfile?.botOptInAssignments)
  );
  const [dmOptInError, setDmOptInError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const canManage =
    Boolean(user?.isAppAdmin) || selectedProfile?.role === "alliance_admin";
  const canManageSettings = canManage && Boolean(selectedProfile?.allianceId);
  const allianceProfilesQuery = useAllianceProfilesQuery(
    selectedProfileId,
    canManage
  );
  const allianceSettingsQuery = useAllianceSettingsQuery(
    selectedProfileId,
    canManageSettings
  );
  const alliancesQuery = useAlliancesQuery(
    selectedProfile?.kingdomId ?? null,
    Boolean(selectedProfile && !selectedProfile.allianceId)
  );
  const { approveProfile, rejectProfile, setRole } = useAllianceAdminActions(
    selectedProfileId,
    selectedProfile?.allianceId || null
  );
  const [addPlayerId, setAddPlayerId] = useState("");
  const [addPlayerError, setAddPlayerError] = useState("");
  const [addPlayerSuccess, setAddPlayerSuccess] = useState("");
  const [addPlayerBusy, setAddPlayerBusy] = useState(false);
  const [addLookupStatus, setAddLookupStatus] = useState("");
  const alliances = alliancesQuery.data || [];
  const adminProfiles = allianceProfilesQuery.data || [];
  const loadingAdmin = allianceProfilesQuery.isLoading;
  const dmOptInBusy = assignmentOptInMutation.isPending;
  const settingsBusy = settingsMutation.isPending;
  const {
    timeMode,
    setTimeMode,
    bear1Input: settingsBear1NextTime,
    bear2Input: settingsBear2NextTime,
    setBear1Input: setSettingsBear1NextTime,
    setBear2Input: setSettingsBear2NextTime,
    markClean: markSettingsClean
  } = useAdminBearTimeSettings({
    enabled: canManageSettings,
    settings: allianceSettingsQuery.data,
    onChange: () => {
      setSettingsError("");
      setSettingsSuccess("");
    }
  });

  useEffect(() => {
    setJoinError("");
    setJoinSuccess("");
    setJoinAllianceId("");
    setCreateError("");
    setCreateSuccess("");
    setCreateTag("");
    setCreateName("");
    setAddPlayerId("");
    setAddPlayerError("");
    setAddPlayerSuccess("");
    setAddLookupStatus("");
    setSettingsError("");
    setSettingsSuccess("");
    markSettingsClean();
    if (!selectedProfile || selectedProfile.allianceId) {
      return;
    }
  }, [
    markSettingsClean,
    selectedProfile
  ]);

  useEffect(() => {
    setDmOptIn(Boolean(selectedProfile?.botOptInAssignments));
  }, [selectedProfile?.botOptInAssignments]);

  function handleDmOptInChange(nextValue: boolean) {
    if (!selectedProfile) return;
    setDmOptIn(nextValue);
    setDmOptInError("");
    assignmentOptInMutation.mutate(
      { profileId: selectedProfile.id, enabled: nextValue },
      {
        onSuccess: (updatedProfile) => {
          if (updatedProfile) {
            setDmOptIn(Boolean(updatedProfile.botOptInAssignments));
            queryClient.setQueryData<Profile[]>(profilesQueryKey, (prev) => {
              const current = prev || [];
              return current.map((item) =>
                item.id === updatedProfile.id ? updatedProfile : item
              );
            });
          }
        },
        onError: () => {
          setDmOptIn(Boolean(selectedProfile.botOptInAssignments));
          setDmOptInError(t("profiles.errors.dmOptInUpdateFailed"));
        }
      }
    );
  }

  const handleSettingsBear1NextTimeChange = setSettingsBear1NextTime;
  const handleSettingsBear2NextTimeChange = setSettingsBear2NextTime;

  function submitAllianceSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId) return;
    setSettingsError("");
    setSettingsSuccess("");

    const bear1NextUtc = parseDateTimeInputToUtcIso(settingsBear1NextTime, timeMode);
    const bear2NextUtc = parseDateTimeInputToUtcIso(settingsBear2NextTime, timeMode);
    if (!bear1NextUtc || !bear2NextUtc) {
      setSettingsError(t("profiles.errors.nextTimeInvalid"));
      return;
    }
    settingsMutation.mutate(
      {
        bearNextTimes: { bear1: bear1NextUtc, bear2: bear2NextUtc }
      },
      {
        onSuccess: (settings) => {
          if (!settings) {
            setSettingsError(t("profiles.errors.settingsUpdateFailed"));
            return;
          }
          queryClient.setQueryData(
            allianceSettingsQueryKey(selectedProfileId),
            settings
          );
          markSettingsClean();
          setSettingsSuccess(t("profiles.settingsSaved"));
        },
        onError: () => {
          setSettingsError(t("profiles.errors.settingsUpdateFailed"));
        }
      }
    );
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
      const parsed = await lookupAndParsePlayer(form.playerId.trim(), {
        onStart: () => setLookupStatus(t("profiles.lookupStatus")),
        onSuccess: (name) => setLookupStatus(t("profiles.lookupFound", { name })),
        onError: () => setLookupStatus("")
      });
      playerName = parsed.playerName;
      playerAvatar = parsed.avatar || "";
      kingdomId = parsed.kingdomId;
    } catch {
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
      const profile = await createProfileMutation.mutateAsync(payload);
      if (!profile) {
        setError(t("profiles.errors.createFailed"));
        return;
      }
      setForm(emptyForm);
      setSuccess(t("profiles.created"));
    } catch (createError) {
      if (createError instanceof ApiError) {
        if (createError.status === 409) {
          setError(t("profiles.errors.duplicate"));
          return;
        }
        if (createError.status === 400) {
          if (createError.code === "profile_invalid_alliance") {
            setError(t("profiles.errors.invalidAlliance"));
            return;
          }
          if (createError.code === "profile_player_id_required") {
            setError(t("profiles.errors.playerIdRequired"));
            return;
          }
        }
      }
      setError(t("profiles.errors.createFailed"));
    }
  }

  async function submitAdminAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId) return;
    setAddPlayerError("");
    setAddPlayerSuccess("");
    setAddLookupStatus("");

    const value = addPlayerId.trim();
    if (!value) {
      setAddPlayerError(t("profiles.errors.playerIdRequired"));
      return;
    }
    let playerName = "";
    let kingdomId: number | null = null;
    try {
      const parsed = await lookupAndParsePlayer(value, {
        onStart: () => setAddLookupStatus(t("profiles.lookupStatus")),
        onSuccess: (name) => setAddLookupStatus(t("profiles.lookupFound", { name })),
        onError: () => setAddLookupStatus("")
      });
      playerName = parsed.playerName;
      kingdomId = parsed.kingdomId;
    } catch {
      setAddLookupStatus("");
      setAddPlayerError(t("profiles.errors.lookupFailed"));
      return;
    }
    if (
      selectedProfile?.kingdomId &&
      kingdomId &&
      selectedProfile.kingdomId !== kingdomId
    ) {
      setAddPlayerError(t("profiles.errors.kingdomMismatch"));
      return;
    }
    setAddPlayerBusy(true);
    try {
      const profile = await createAllianceProfileMutation.mutateAsync({
        profileId: selectedProfileId,
        payload: {
          playerId: value,
          playerName: playerName || null,
          kingdomId
        }
      });
      if (!profile) {
        setAddPlayerError(t("profiles.errors.addProfileFailed"));
        return;
      }
      setAddPlayerSuccess(t("profiles.adminAddSuccess"));
      setAddPlayerId("");
    } finally {
      setAddPlayerBusy(false);
    }
  }

  async function refreshProfileData() {
    if (!selectedProfile?.playerId) return;
    setError("");
    setSuccess("");
    setLookupStatus("");
    try {
      const parsed = await lookupAndParsePlayer(selectedProfile.playerId, {
        onStart: () => setLookupStatus(t("profiles.lookupStatus"))
      });
      const playerName = parsed.playerName;
      const rawAvatar = parsed.avatar || "";
      const playerAvatar = rawAvatar
        ? `${rawAvatar}${rawAvatar.includes("?") ? "&" : "?"}v=${Date.now()}`
        : "";
      const updated = await updateProfileMutation.mutateAsync({
        profileId: selectedProfile.id,
        payload: {
          playerName: playerName || null,
          playerAvatar: playerAvatar || null,
          kingdomId: parsed.kingdomId
        }
      });
      if (updated) {
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

    const updated = await updateProfileMutation.mutateAsync({
      profileId: selectedProfile.id,
      payload: { allianceId: joinAllianceId }
    });
    if (!updated) {
      setJoinError(t("profiles.errors.joinFailed"));
      return;
    }
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
      profileId: selectedProfile.id
    });
    const updatedProfile = result.profile;
    if (!result.alliance || !updatedProfile) {
      setCreateError(t("profiles.errors.createAllianceFailed"));
      return;
    }
    setCreateSuccess(t("profiles.createdAlliance"));
  }

  async function handleDeleteAlliance() {
    if (!selectedProfile || !selectedProfile.allianceId) return;
    setDeleteError("");
    const confirmed = window.confirm(t("profiles.deleteConfirm"));
    if (!confirmed) return;
    const ok = await deleteAlliance({
      allianceId: selectedProfile.allianceId,
      profileId: selectedProfile.id
    });
    if (!ok) {
      setDeleteError(t("profiles.errors.deleteAllianceFailed"));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: profilesQueryKey });
  }

  return (
    <div className="app" data-testid="profiles-page">
      <ProfilesHeader t={t} selectedProfile={selectedProfile} />

      <main className="relative z-[1] grid gap-6">
        <ProfilesCreateCard
          t={t}
          playerId={form.playerId}
          lookupStatus={lookupStatus}
          error={error}
          success={success}
          onPlayerIdChange={(value) => setForm({ ...form, playerId: value })}
          onSubmit={submitProfile}
        />

        {selectedProfile && (
          <ProfilesCurrentCard
            t={t}
            profile={selectedProfile}
            lookupStatus={lookupStatus}
            error={error}
            success={success}
            onRefresh={refreshProfileData}
            dmOptIn={dmOptIn}
            dmOptInBusy={dmOptInBusy}
            dmOptInError={dmOptInError}
            onDmOptInChange={handleDmOptInChange}
          />
        )}

        {selectedProfile && !selectedProfile.allianceId && (
          <ProfilesJoinCard
            t={t}
            profile={selectedProfile}
            alliances={alliances}
            joinAllianceId={joinAllianceId}
            joinError={joinError}
            joinSuccess={joinSuccess}
            onJoinAllianceChange={setJoinAllianceId}
            onSubmit={submitJoinRequest}
          />
        )}

        {selectedProfile && !selectedProfile.allianceId && (
          <ProfilesCreateAllianceCard
            t={t}
            profile={selectedProfile}
            createTag={createTag}
            createName={createName}
            createError={createError}
            createSuccess={createSuccess}
            onCreateTagChange={setCreateTag}
            onCreateNameChange={setCreateName}
            onSubmit={submitCreateAlliance}
          />
        )}

        {canManage && selectedProfile?.status === "active" && selectedProfile && (
          <ProfilesAdminCard
            t={t}
            selectedProfile={selectedProfile}
            adminProfiles={adminProfiles}
            loadingAdmin={loadingAdmin}
            addPlayerId={addPlayerId}
            addLookupStatus={addLookupStatus}
            addPlayerBusy={addPlayerBusy}
            addPlayerError={addPlayerError}
            addPlayerSuccess={addPlayerSuccess}
            deleteError={deleteError}
            showAllianceSettings={canManageSettings}
            timeMode={timeMode}
            settingsBear1NextTime={settingsBear1NextTime}
            settingsBear2NextTime={settingsBear2NextTime}
            settingsBusy={settingsBusy}
            settingsError={settingsError}
            settingsSuccess={settingsSuccess}
            onAddPlayerIdChange={setAddPlayerId}
            onSubmitAdminAdd={submitAdminAdd}
            onApproveProfile={approveProfile}
            onRejectProfile={rejectProfile}
            onSetRole={setRole}
            onDeleteAlliance={handleDeleteAlliance}
            onTimeModeChange={setTimeMode}
            onSettingsBear1NextTimeChange={handleSettingsBear1NextTimeChange}
            onSettingsBear2NextTimeChange={handleSettingsBear2NextTimeChange}
            onSubmitAllianceSettings={submitAllianceSettings}
          />
        )}
      </main>
    </div>
  );
}

export default Profiles;
