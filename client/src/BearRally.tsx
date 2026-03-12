import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { Profile } from "@shared/types";
import { ApiError } from "./apiClient";
import { useBear } from "./hooks/useBear";
import { useUpdateProfileMutation } from "./hooks/useProfileMutations";
import { lookupAndParsePlayer } from "./utils/playerLookup";
import {
  useEligibleBearMembersQuery,
  eligibleBearMembersQueryKey
} from "./hooks/useEligibleBearMembersQuery";
import { useBearRallyOrder } from "./hooks/useBearRallyOrder";
import { useAllianceSettingsQuery } from "./hooks/useAllianceSettingsQuery";
import BearGeneratorCard from "./components/bear/BearGeneratorCard";
import BearGroupCard from "./components/bear/BearGroupCard";
import BearHeader from "./components/bear/BearHeader";
import BearSignupCard from "./components/bear/BearSignupCard";
import { DEFAULT_ALLIANCE_SETTINGS } from "@shared/allianceConfig";
import { utcTimeToLocalLabel } from "./utils/time";

type Props = {
  profileId: string;
  profile: Profile | null;
  canManage: boolean;
};

type BearForm = {
  rallySize: string;
  bearGroup: "bear1" | "bear2";
  playerName: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatNumberInput(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString();
}

function parseNumber(value: string) {
  const digits = String(value).replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

function BearRally({ profileId, profile, canManage }: Props) {
  const { t } = useTranslation();
  const {
    bear1Members,
    bear2Members,
    upsertMember,
    removeMember,
    resetGroup
  } = useBear(profileId);
  const [form, setForm] = useState<BearForm>({
    rallySize: "",
    bearGroup: "bear1",
    playerName: ""
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [editingMember, setEditingMember] = useState<{
    playerId: string;
    bearGroup: "bear1" | "bear2";
  } | null>(null);
  const [profileWarning, setProfileWarning] = useState("");
  const [adminTargetId, setAdminTargetId] = useState("");
  const updateProfileMutation = useUpdateProfileMutation();
  const queryClient = useQueryClient();
  const eligibleMembersQuery = useEligibleBearMembersQuery(profileId, canManage);
  const allianceSettingsQuery = useAllianceSettingsQuery(profileId, Boolean(profileId));
  const eligibleMembers = useMemo(
    () => eligibleMembersQuery.data ?? [],
    [eligibleMembersQuery.data]
  );
  const bearTimes = allianceSettingsQuery.data?.bearTimes ?? DEFAULT_ALLIANCE_SETTINGS.bearTimes;
  const bear1Label = useMemo(
    () => t("bear.bear1", { time: utcTimeToLocalLabel(bearTimes.bear1) }),
    [bearTimes.bear1, t]
  );
  const bear2Label = useMemo(
    () => t("bear.bear2", { time: utcTimeToLocalLabel(bearTimes.bear2) }),
    [bearTimes.bear2, t]
  );
  const adminOptions = useMemo(() => {
    const options: { playerId: string; playerName: string }[] = [];
    if (profile?.playerId) {
      options.push({
        playerId: profile.playerId,
        playerName: profile.playerName || profile.playerId
      });
    }
    for (const member of eligibleMembers) {
      if (!member.playerId || member.playerId === profile?.playerId) continue;
      options.push({
        playerId: member.playerId,
        playerName: member.playerName || member.playerId
      });
    }
    return options;
  }, [eligibleMembers, profile]);
  const {
    hostCount,
    setHostCount,
    selectedBearGroup,
    setSelectedBearGroup,
    rallyOrder,
    generateRallyOrder,
    copyToClipboard,
    sortedBear1,
    sortedBear2
  } = useBearRallyOrder(bear1Members, bear2Members);

  useEffect(() => {
    if (!profileId) return;
    setEditingMember(null);
    setAdminTargetId("");
    setLookupStatus("");
  }, [profileId]);

  useEffect(() => {
    if (profile || editingMember) return;
    setForm((prev) => ({
      ...prev,
      playerName: ""
    }));
  }, [profile, editingMember]);

  useEffect(() => {
    if (!canManage) return;
    if (!adminTargetId || !profile?.playerId) return;
    if (!adminOptions.some((member) => member.playerId === adminTargetId)) {
      setAdminTargetId(profile.playerId);
    }
  }, [adminOptions, adminTargetId, canManage, profile?.playerId]);

  useEffect(() => {
    if (!profile || editingMember) return;
    setForm((prev) => ({
      ...prev,
      playerName: profile.playerName || "",
      rallySize: profile.rallySize ? formatNumber(profile.rallySize) : prev.rallySize
    }));
  }, [profile, editingMember]);

  useEffect(() => {
    if (profile) {
      setProfileWarning("");
    }
  }, [profile]);

  useEffect(() => {
    if (!canManage) {
      setAdminTargetId("");
      return;
    }
    if (profile?.playerId && !editingMember) {
      setAdminTargetId(profile.playerId);
    }
  }, [canManage, profile?.playerId, editingMember]);

  async function lookupPlayerName(fid: string) {
    try {
      const parsed = await lookupAndParsePlayer(fid, {
        onStart: () => setLookupStatus(t("bear.lookup.looking")),
        onSuccess: (name) => setLookupStatus(t("bear.lookup.found", { name })),
        onError: () => setLookupStatus(""),
        noPlayerNameError: new Error(t("bear.errors.noPlayerName"))
      });
      return parsed.playerName;
    } catch (lookupErr) {
      setLookupStatus("");
      throw lookupErr;
    }
  }

  async function submitSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!profileId || !profile?.playerId) {
        throw new Error(t("auth.notAuthorizedAction"));
      }
      const adminTarget = canManage ? adminTargetId : "";
      const usingAdminTarget = Boolean(adminTarget && adminTarget !== profile.playerId);
      const fid = (
        editingMember?.playerId ||
        (usingAdminTarget ? adminTarget : profile.playerId)
      ).trim();
      let resolvedName = form.playerName;

      if (!editingMember && !resolvedName) {
        resolvedName = await lookupPlayerName(fid);
      }

      await upsertMember(form.bearGroup, {
        playerId: fid,
        playerName: resolvedName,
        rallySize: parseNumber(form.rallySize)
      });

      if (!editingMember && !usingAdminTarget) {
        const updatedProfile = await updateProfileMutation.mutateAsync({
          profileId,
          payload: {
            playerId: fid,
            playerName: resolvedName,
            rallySize: parseNumber(form.rallySize)
          }
        });
        if (!updatedProfile) {
          setProfileWarning(t("profiles.errors.updateFailed"));
        }
      }
      if (usingAdminTarget) {
        await queryClient.invalidateQueries({
          queryKey: eligibleBearMembersQueryKey(profileId)
        });
      }

      setForm({ rallySize: "", bearGroup: form.bearGroup, playerName: "" });
      setLookupStatus("");
      setEditingMember(null);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 403) {
        setError(t("auth.notAuthorizedAction"));
      } else if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError(String(submitError));
      }
    } finally {
      setBusy(false);
    }
  }

  function startEdit(
    member: { playerId: string; playerName: string; rallySize: number },
    bearGroup: "bear1" | "bear2"
  ) {
    if (member.playerId !== profile?.playerId && !canManage) return;
    setAdminTargetId("");
    setEditingMember({ playerId: member.playerId, bearGroup });
    setForm({
      rallySize: String(member.rallySize),
      bearGroup: bearGroup,
      playerName: member.playerName || ""
    });
    setLookupStatus("");
    setError("");
  }

  function cancelEdit() {
    setEditingMember(null);
    setForm({ rallySize: "", bearGroup: "bear1", playerName: "" });
    setLookupStatus("");
    setError("");
  }

  function handleAdminTargetChange(value: string) {
    setAdminTargetId(value);
    if (!value || value === profile?.playerId) {
      setForm((prev) => ({
        ...prev,
        playerName: profile?.playerName || "",
        rallySize: profile?.rallySize ? formatNumber(profile.rallySize) : prev.rallySize
      }));
      return;
    }
    const selected = eligibleMembers.find((member) => member.playerId === value);
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      rallySize:
        selected.rallySize !== null && selected.rallySize !== undefined
          ? formatNumber(selected.rallySize)
          : "",
      playerName: selected.playerName || prev.playerName
    }));
    setLookupStatus("");
    setEditingMember(null);
  }

  async function resetBearGroup(bearGroup: "bear1" | "bear2") {
    setError("");
    setBusy(true);

    if (!canManage) {
      setError(t("auth.notAuthorizedAction"));
      setBusy(false);
      return;
    }

    try {
      await resetGroup(bearGroup);
      if (canManage && profileId) {
        await queryClient.invalidateQueries({
          queryKey: eligibleBearMembersQueryKey(profileId)
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t("auth.notAuthorizedAction"));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeMemberHandler(bearGroup: "bear1" | "bear2", playerId: string) {
    setError("");
    setBusy(true);

    if (!canManage && profile?.playerId !== playerId) {
      setError(t("auth.notAuthorizedAction"));
      setBusy(false);
      return;
    }

    try {
      await removeMember(bearGroup, playerId);
      if (canManage && profileId) {
        await queryClient.invalidateQueries({
          queryKey: eligibleBearMembersQueryKey(profileId)
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t("auth.notAuthorizedAction"));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const canGenerateOrder =
    (selectedBearGroup === "bear1" ? sortedBear1.length : sortedBear2.length) !== 0;

  return (
    <div className="app">
      <BearHeader
        t={t}
        bear1Count={bear1Members.length}
        bear2Count={bear2Members.length}
        bear1Label={bear1Label}
        bear2Label={bear2Label}
      />

      <main className="relative z-[1] grid gap-6">
        <BearSignupCard
          t={t}
          canManage={canManage}
          editingMember={editingMember}
          adminOptions={adminOptions}
          adminTargetId={adminTargetId}
          form={form}
          busy={busy}
          lookupStatus={lookupStatus}
          profileWarning={profileWarning}
          error={error}
          bear1Label={bear1Label}
          bear2Label={bear2Label}
          onSubmit={submitSignup}
          onAdminTargetChange={handleAdminTargetChange}
          onSetForm={setForm}
          onCancelEdit={cancelEdit}
          formatNumber={formatNumber}
          formatNumberInput={formatNumberInput}
        />

        <BearGroupCard
          t={t}
          title={bear1Label}
          members={sortedBear1}
          group="bear1"
          busy={busy}
          canManage={canManage}
          profile={profile}
          onReset={resetBearGroup}
          onEdit={startEdit}
          onRemove={removeMemberHandler}
          formatNumber={formatNumber}
          resetLabel={t("bear.resetBear1")}
        />

        <BearGroupCard
          t={t}
          title={bear2Label}
          members={sortedBear2}
          group="bear2"
          busy={busy}
          canManage={canManage}
          profile={profile}
          onReset={resetBearGroup}
          onEdit={startEdit}
          onRemove={removeMemberHandler}
          formatNumber={formatNumber}
          resetLabel={t("bear.resetBear2")}
        />

        <BearGeneratorCard
          t={t}
          hostCount={hostCount}
          selectedBearGroup={selectedBearGroup}
          rallyOrder={rallyOrder}
          onHostCountChange={setHostCount}
          onSelectedBearGroupChange={setSelectedBearGroup}
          onGenerate={generateRallyOrder}
          onCopy={copyToClipboard}
          canGenerate={canGenerateOrder}
          bear1Label={bear1Label}
          bear2Label={bear2Label}
        />
      </main>
    </div>
  );
}

export default BearRally;
