import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./apiClient";
import type { Profile } from "@shared/types";
import type { Member } from "./api/members";
import { lookupAndParsePlayer } from "./utils/playerLookup";
import { useAssignments } from "./hooks/useAssignments";
import { useMembers } from "./hooks/useMembers";
import { useUpdateProfileMutation } from "./hooks/useProfileMutations";
import {
  eligibleMembersQueryKey,
  useEligibleMembersQuery
} from "./hooks/useEligibleMembersQuery";
import { useVikingAssignmentSearch } from "./hooks/useVikingAssignmentSearch";
import VikingAssignmentsCard from "./components/viking/VikingAssignmentsCard";
import VikingHeader from "./components/viking/VikingHeader";
import VikingInstructionsCard from "./components/viking/VikingInstructionsCard";
import VikingRosterCard from "./components/viking/VikingRosterCard";
import VikingSearchCard from "./components/viking/VikingSearchCard";
import VikingSignupCard from "./components/viking/VikingSignupCard";

type VikingForm = {
  troopCount: string;
  playerName: string;
  marchCount: string;
  power: string;
};

const emptyForm: VikingForm = {
  troopCount: "",
  playerName: "",
  marchCount: "4",
  power: ""
};

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

type Props = {
  profileId: string;
  profile: Profile | null;
  canManage: boolean;
};

function VikingVengeance({ profileId, profile, canManage }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<VikingForm>(emptyForm);
  const { members, saveMember, deleteMember } = useMembers(profileId);
  const { results, run, reset } = useAssignments(profileId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [lastLookupId, setLastLookupId] = useState("");
  const [profileWarning, setProfileWarning] = useState("");
  const [adminTargetId, setAdminTargetId] = useState("");
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const updateProfileMutation = useUpdateProfileMutation();
  const queryClient = useQueryClient();
  const eligibleMembersQuery = useEligibleMembersQuery(profileId, canManage);
  const eligibleMembers = useMemo(
    () => eligibleMembersQuery.data ?? [],
    [eligibleMembersQuery.data]
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

  const defaultAssignmentQuery = profile?.playerName || profile?.playerId || "";
  const { searchQuery, setSearchQuery, filteredResults, suggestionTail, topSuggestion } =
    useVikingAssignmentSearch(results, {
      profileId,
      defaultQuery: defaultAssignmentQuery
    });

  const memberCount = members.length;

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.playerId.localeCompare(b.playerId));
  }, [members]);

  useEffect(() => {
    if (!profileId) return;
    setEditingMember(null);
    setAdminTargetId("");
    setLookupStatus("");
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    const storageKey = `vikingAdvancedDetails:${profileId}`;
    const stored = window.localStorage.getItem(storageKey);
    setShowAdvancedDetails(stored === "true");
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    const storageKey = `vikingAdvancedDetails:${profileId}`;
    window.localStorage.setItem(storageKey, String(showAdvancedDetails));
  }, [profileId, showAdvancedDetails]);

  useEffect(() => {
    if (profile || editingMember) return;
    setForm(emptyForm);
  }, [profile, editingMember]);

  useEffect(() => {
    if (!profile || editingMember) return;
    setForm({
      troopCount: profile.troopCount ? formatNumber(profile.troopCount) : "",
      playerName: profile.playerName || "",
      marchCount: profile.marchCount ? String(profile.marchCount) : "4",
      power: profile.power ? formatNumber(profile.power) : ""
    });
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

  useEffect(() => {
    if (!canManage) return;
    if (!adminTargetId || !profile?.playerId) return;
    if (!adminOptions.some((member) => member.playerId === adminTargetId)) {
      setAdminTargetId(profile.playerId);
    }
  }, [adminOptions, adminTargetId, canManage, profile?.playerId]);

  function updateForm(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value, type } = event.target;
    const checked =
      type === "checkbox" && event.target instanceof HTMLInputElement
        ? event.target.checked
        : false;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function formatNumberInput(value: string) {
    const digits = value.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString();
  }

  function updatePower(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({
      ...prev,
      power: formatNumberInput(event.target.value)
    }));
  }

  function updateTroopCount(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({
      ...prev,
      troopCount: formatNumberInput(event.target.value)
    }));
  }

  function parseNumber(value: string) {
    const digits = String(value).replace(/[^0-9]/g, "");
    return digits ? Number(digits) : 0;
  }

  async function lookupPlayerProfile(fid: string) {
    try {
      const parsed = await lookupAndParsePlayer(fid, {
        onStart: () => setLookupStatus(t("viking.lookup.looking")),
        onSuccess: (name) => setLookupStatus(t("viking.lookup.found", { name })),
        onError: () => setLookupStatus(""),
        noPlayerNameError: new Error(t("viking.errors.noPlayerName"))
      });
      return {
        name: parsed.playerName,
        avatar: parsed.avatar || "",
        kingdomId: parsed.kingdomId ?? null
      };
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
        editingMember || (usingAdminTarget ? adminTarget : profile.playerId)
      ).trim();
      let resolvedName = form.playerName;
      let resolvedAvatar = profile?.playerAvatar || "";
      let resolvedKingdomId = profile?.kingdomId ?? null;

      if (!editingMember && (!resolvedName || (!usingAdminTarget && fid !== lastLookupId))) {
        const lookup = await lookupPlayerProfile(fid);
        resolvedName = lookup.name;
        resolvedAvatar = lookup.avatar;
        resolvedKingdomId = lookup.kingdomId ?? null;
        setLastLookupId(fid);
      }

      await saveMember({
        playerId: fid,
        troopCount: parseNumber(form.troopCount),
        playerName: resolvedName,
        marchCount: Number(form.marchCount),
        power: parseNumber(form.power)
      });
      setError("");
      if (!editingMember && !usingAdminTarget) {
        const updatedProfile = await updateProfileMutation.mutateAsync({
          profileId,
          payload: {
            playerId: fid,
            troopCount: parseNumber(form.troopCount),
            playerName: resolvedName,
            marchCount: Number(form.marchCount),
            power: parseNumber(form.power),
            playerAvatar: resolvedAvatar || null,
            kingdomId: resolvedKingdomId
          }
        });
        if (!updatedProfile) {
          setProfileWarning(t("profiles.errors.updateFailed"));
        }
      }
      if (usingAdminTarget) {
        await queryClient.invalidateQueries({
          queryKey: eligibleMembersQueryKey(profileId)
        });
      }
      setForm(emptyForm);
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

  function startEdit(member: Member) {
    if (member.playerId !== profile?.playerId && !canManage) return;
    setAdminTargetId("");
    setEditingMember(member.playerId);
    setForm({
      troopCount: String(member.troopCount),
      playerName: member.playerName || "",
      marchCount: String(member.marchCount),
      power: formatNumber(member.power)
    });
    setLookupStatus("");
    setError("");
  }

  function cancelEdit() {
    setEditingMember(null);
    setForm(emptyForm);
    setLookupStatus("");
    setError("");
  }

  function handleAdminTargetChange(value: string) {
    setAdminTargetId(value);
    if (!value || value === profile?.playerId) {
      setForm((prev) => ({
        ...prev,
        playerName: profile?.playerName || "",
        troopCount: profile?.troopCount ? formatNumber(profile.troopCount) : "",
        marchCount: profile?.marchCount ? String(profile.marchCount) : "4",
        power: profile?.power ? formatNumber(profile.power) : ""
      }));
      return;
    }
    const selected = eligibleMembers.find((member) => member.playerId === value);
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      troopCount:
        selected.troopCount !== null && selected.troopCount !== undefined
          ? formatNumber(selected.troopCount)
          : "",
      marchCount:
        selected.marchCount !== null && selected.marchCount !== undefined
          ? String(selected.marchCount)
          : prev.marchCount,
      power:
        selected.power !== null && selected.power !== undefined
          ? formatNumber(selected.power)
          : "",
      playerName: selected.playerName || prev.playerName
    }));
    setLookupStatus("");
    setEditingMember(null);
  }

  async function runAssignments() {
    setError("");

    if (!canManage) {
      setError(t("auth.notAuthorizedAction"));
      return;
    }

    if (members.length < 2) {
      setError(t("viking.errors.needMembers"));
      return;
    }

    setBusy(true);
    try {
      const result = await run();

      if (result?.warningCodes && result.warningCodes.length > 0) {
        const notEnoughMembers = result.warningCodes.some(
          (code) =>
            code === "assignments_need_members" ||
            code === "assignments_not_enough_valid"
        );
        if (notEnoughMembers) {
          throw new Error(t("viking.errors.needMembers"));
        }
      }

      setError("");
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

  async function resetAll() {
    setError("");
    setBusy(true);

    if (!canManage) {
      setError(t("auth.notAuthorizedAction"));
      setBusy(false);
      return;
    }

    try {
      await reset();
      await queryClient.invalidateQueries({
        queryKey: eligibleMembersQueryKey(profileId)
      });
      setForm(emptyForm);
      setLookupStatus("");
      setError("");
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

  async function removeSignup(playerId: string) {
    setError("");
    setBusy(true);

    if (!canManage && profile?.playerId !== playerId) {
      setError(t("auth.notAuthorizedAction"));
      setBusy(false);
      return;
    }

    try {
      await deleteMember(playerId);
      await queryClient.invalidateQueries({
        queryKey: eligibleMembersQueryKey(profileId)
      });
      setError("");
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

  return (
    <div className="app">
      <VikingHeader
        t={t}
        memberCount={memberCount}
        onReset={resetAll}
        busy={busy}
        canManage={canManage}
      />

      <main className="relative z-[1] grid gap-6">
        <VikingInstructionsCard t={t} />
        {!results ? (
          <VikingSignupCard
            t={t}
            canManage={canManage}
            editingMember={editingMember}
            adminOptions={adminOptions}
            adminTargetId={adminTargetId}
            form={form}
            busy={busy}
            lookupStatus={lookupStatus}
            onSubmit={submitSignup}
            onAdminTargetChange={handleAdminTargetChange}
            onUpdateForm={updateForm}
            onUpdatePower={updatePower}
            onUpdateTroopCount={updateTroopCount}
            onCancelEdit={cancelEdit}
            formatNumber={formatNumber}
          />
        ) : (
          <VikingSearchCard
            t={t}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            suggestionTail={suggestionTail}
            topSuggestion={topSuggestion}
          />
        )}

        {!results && (
          <VikingRosterCard
            t={t}
            members={sortedMembers}
            profile={profile}
            canManage={canManage}
            busy={busy}
            profileWarning={profileWarning}
            error={error}
            onEdit={startEdit}
            onRemove={removeSignup}
            onRunAssignments={runAssignments}
            formatNumber={formatNumber}
          />
        )}

        <VikingAssignmentsCard
          t={t}
          results={results}
          members={filteredResults}
          formatNumber={formatNumber}
          showAdvancedDetails={showAdvancedDetails}
          onToggleAdvancedDetails={() =>
            setShowAdvancedDetails((prev) => !prev)
          }
        />
      </main>
    </div>
  );
}

export default VikingVengeance;
