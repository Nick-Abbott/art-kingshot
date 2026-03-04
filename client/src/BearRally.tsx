import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "./apiClient";
import { lookupPlayer } from "./api/playerLookup";
import { useBear } from "./hooks/useBear";
import type { Profile } from "@shared/types";
import { updateProfile } from "./api/profile";

type Props = {
  profileId: string;
  profile: Profile | null;
  canManage: boolean;
  onProfileUpdated: (profile: Profile) => void;
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

function BearRally({ profileId, profile, canManage, onProfileUpdated }: Props) {
  const { t } = useTranslation();
  const {
    bear1Members,
    bear2Members,
    upsertMember,
    removeMember,
    resetGroup,
    refreshGroup
  } = useBear(profileId);
  const [form, setForm] = useState<BearForm>({
    rallySize: "",
    bearGroup: "bear1",
    playerName: ""
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [hostCount, setHostCount] = useState(15);
  const [rallyOrder, setRallyOrder] = useState("");
  const [selectedBearGroup, setSelectedBearGroup] = useState<"bear1" | "bear2">(
    "bear1"
  );
  const [editingMember, setEditingMember] = useState<{
    playerId: string;
    bearGroup: "bear1" | "bear2";
  } | null>(null);
  const [profileWarning, setProfileWarning] = useState("");

  useEffect(() => {
    if (!profileId) return;
    setEditingMember(null);
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

  async function lookupPlayerName(fid: string) {
    setLookupStatus(t("bear.lookup.looking"));
    try {
      const res = await lookupPlayer(fid);
      const name = extractPlayerName(res);
      if (!name) throw new Error(t("bear.errors.noPlayerName"));
      setLookupStatus(t("bear.lookup.found", { name }));
      return name;
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
      const fid = (editingMember?.playerId || profile.playerId).trim();
      const inferredSourceGroup =
        form.bearGroup === "bear1"
          ? bear2Members.some((member) => member.playerId === fid)
            ? "bear2"
            : null
          : bear1Members.some((member) => member.playerId === fid)
          ? "bear1"
          : null;
      let resolvedName = form.playerName;

      if (!editingMember) {
        resolvedName = await lookupPlayerName(fid);
      }

      await upsertMember(form.bearGroup, {
        playerId: fid,
        playerName: resolvedName,
        rallySize: parseNumber(form.rallySize)
      });

      if (!editingMember) {
        const updatedProfile = await updateProfile(profileId, {
          playerId: fid,
          playerName: resolvedName,
          rallySize: parseNumber(form.rallySize)
        });
        if (updatedProfile) {
          onProfileUpdated(updatedProfile);
        } else {
          setProfileWarning(t("profiles.errors.updateFailed"));
        }
      }

      const sourceGroup =
        editingMember && editingMember.bearGroup !== form.bearGroup
          ? editingMember.bearGroup
          : inferredSourceGroup;

      if (sourceGroup) {
        await refreshGroup(sourceGroup);
      }
      setForm({ rallySize: "", bearGroup: form.bearGroup, playerName: "" });
      setLookupStatus("");
      setEditingMember(null);
    } catch (submitError: any) {
      if (submitError instanceof ApiError && submitError.status === 403) {
        setError(t("auth.notAuthorizedAction"));
      } else {
        setError(submitError.message);
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
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t("auth.notAuthorizedAction"));
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeMemberHandler(bearGroup: "bear1" | "bear2", playerId: string) {
    setError("");
    setBusy(true);

    if (!canManage) {
      setError(t("auth.notAuthorizedAction"));
      setBusy(false);
      return;
    }

    try {
      await removeMember(bearGroup, playerId);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t("auth.notAuthorizedAction"));
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  function generateRallyOrder(bearGroup: "bear1" | "bear2") {
    const members = bearGroup === "bear1" ? sortedBear1 : sortedBear2;
    const selectedMembers = members.slice(0, hostCount);

    let order = "🐻Bear Rally Order🐻\n";
    for (let i = 0; i < selectedMembers.length; i += 2) {
      const member1 = selectedMembers[i];
      const member2 = selectedMembers[i + 1];

      const num1 = (i + 1).toString();
      const fullName1 = member1.playerName || member1.playerId;
      const name1 = fullName1.length > 10 ? fullName1.substring(0, 7) + "..." : fullName1;

      if (member2) {
        const num2 = (i + 2).toString();
        const fullName2 = member2.playerName || member2.playerId;
        const name2 = fullName2.length > 10 ? fullName2.substring(0, 7) + "..." : fullName2;
        order += `${num1}. ${name1.padEnd(10)} ${num2}. ${name2}\n`;
      } else {
        order += `${num1}. ${name1}\n`;
      }
    }

    setRallyOrder(order);
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(rallyOrder);
  }

  const sortedBear1 = [...bear1Members].sort((a, b) => b.rallySize - a.rallySize);
  const sortedBear2 = [...bear2Members].sort((a, b) => b.rallySize - a.rallySize);

  return (
    <>
      <div className="app">
        <header className="relative z-[1] mb-8 flex flex-col gap-6 nav:flex-row nav:items-start nav:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-accent-dark">
              {t("bear.eyebrow")}
            </p>
            <h1 className="mt-2 font-['DM Serif Display'] text-[clamp(2.4rem,3vw,3.5rem)]">
              {t("bear.title")}
            </h1>
            <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed text-muted">
              {t("bear.subtitle")}
            </p>
          </div>
          <div className="ui-card-compact grid gap-4 nav:min-w-[240px] nav:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-muted">
                {t("bear.bear1")}
              </p>
              <p className="text-2xl font-semibold" data-testid="bear1-count">
                {bear1Members.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-muted">
                {t("bear.bear2")}
              </p>
              <p className="text-2xl font-semibold" data-testid="bear2-count">
                {bear2Members.length}
              </p>
            </div>
          </div>
        </header>

        <main className="relative z-[1] grid gap-6">
          <section className="ui-card">
            <div className="ui-section-header">
              <h2 className="ui-section-title">
                {editingMember ? t("bear.editSignupTitle") : t("bear.signupTitle")}
              </h2>
              <p className="ui-section-subtitle">
                {editingMember ? t("bear.editSignupSubtitle") : t("bear.signupSubtitle")}
              </p>
            </div>
            <form
              className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(2,minmax(0,1fr))_auto] nav:items-end"
              onSubmit={submitSignup}
            >
              <label className="ui-field">
                {t("bear.rallySize")}
                <input
                  className="ui-input"
                  name="rallySize"
                  value={form.rallySize}
                  onChange={(e) =>
                    setForm({ ...form, rallySize: formatNumberInput(e.target.value) })
                  }
                  inputMode="numeric"
                  placeholder={formatNumber(500000)}
                  required
                />
              </label>
              <label className="ui-field">
                {t("bear.bearGroup")}
                <select
                  className="ui-select"
                  name="bearGroup"
                  value={form.bearGroup}
                  onChange={(e) =>
                    setForm({ ...form, bearGroup: e.target.value as "bear1" | "bear2" })
                  }
                  required
                >
                  <option value="bear1">{t("bear.bear1")}</option>
                  <option value="bear2">{t("bear.bear2")}</option>
                </select>
              </label>
              <button
                className="ui-button ui-button-wide mt-2 nav:mt-0 nav:justify-self-end"
                type="submit"
                disabled={busy}
              >
                {editingMember ? t("bear.update") : t("bear.register")}
              </button>
            </form>
            {lookupStatus && (
              <span className="ui-field-hint mt-3">{lookupStatus}</span>
            )}
            {editingMember && (
              <button className="ui-button-ghost mt-3" type="button" onClick={cancelEdit}>
                {t("bear.cancelEdit")}
              </button>
            )}
            {profileWarning && <p className="ui-error">{profileWarning}</p>}
            {error && <p className="ui-error">{error}</p>}
          </section>

          <section className="ui-card">
            <div className="flex flex-col gap-4 nav:flex-row nav:items-start nav:justify-between">
              <div className="ui-section-header">
                <h2 className="ui-section-title">{t("bear.bear1")}</h2>
                <p className="ui-section-subtitle">{t("bear.sortedByRally")}</p>
              </div>
              <button
                className="ui-button ui-button-wide"
                type="button"
                onClick={() => resetBearGroup("bear1")}
                disabled={busy || !canManage}
              >
                {t("bear.resetBear1")}
              </button>
            </div>
            <div className="mt-5 grid gap-3" data-testid="bear1-list">
              {sortedBear1.length === 0 ? (
                <p className="ui-empty-state">{t("bear.noSignups")}</p>
              ) : (
                sortedBear1.map((member) => (
                  <div
                    key={member.playerId}
                    className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{member.playerName || member.playerId}</p>
                      <p className="text-sm text-muted">
                        {t("bear.rallySizeMeta", { value: formatNumber(member.rallySize) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="ui-button-ghost ui-button-sm"
                        type="button"
                        onClick={() => startEdit(member, "bear1")}
                        disabled={
                          busy ||
                          (!canManage && member.playerId !== profile?.playerId)
                        }
                      >
                        {t("bear.edit")}
                      </button>
                      <button
                        className="ui-button-ghost ui-button-sm"
                        type="button"
                        onClick={() => removeMemberHandler("bear1", member.playerId)}
                        disabled={
                          busy ||
                          (!canManage && member.playerId !== profile?.playerId)
                        }
                      >
                        {t("bear.remove")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="ui-card">
            <div className="flex flex-col gap-4 nav:flex-row nav:items-start nav:justify-between">
              <div className="ui-section-header">
                <h2 className="ui-section-title">{t("bear.bear2")}</h2>
                <p className="ui-section-subtitle">{t("bear.sortedByRally")}</p>
              </div>
              <button
                className="ui-button ui-button-wide"
                type="button"
                onClick={() => resetBearGroup("bear2")}
                disabled={busy || !canManage}
              >
                {t("bear.resetBear2")}
              </button>
            </div>
            <div className="mt-5 grid gap-3" data-testid="bear2-list">
              {sortedBear2.length === 0 ? (
                <p className="ui-empty-state">{t("bear.noSignups")}</p>
              ) : (
                sortedBear2.map((member) => (
                  <div
                    key={member.playerId}
                    className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{member.playerName || member.playerId}</p>
                      <p className="text-sm text-muted">
                        {t("bear.rallySizeMeta", { value: formatNumber(member.rallySize) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="ui-button-ghost ui-button-sm"
                        type="button"
                        onClick={() => startEdit(member, "bear2")}
                        disabled={
                          busy ||
                          (!canManage && member.playerId !== profile?.playerId)
                        }
                      >
                        {t("bear.edit")}
                      </button>
                      <button
                        className="ui-button-ghost ui-button-sm"
                        type="button"
                        onClick={() => removeMemberHandler("bear2", member.playerId)}
                        disabled={
                          busy ||
                          (!canManage && member.playerId !== profile?.playerId)
                        }
                      >
                        {t("bear.remove")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="ui-card">
            <div className="ui-section-header">
              <h2 className="ui-section-title">{t("bear.generatorTitle")}</h2>
              <p className="ui-section-subtitle">{t("bear.generatorSubtitle")}</p>
            </div>
            <div className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(2,minmax(0,1fr))_auto] nav:items-end">
              <label className="ui-field">
                {t("bear.numberOfHosts")}
                <input
                  className="ui-input"
                  type="number"
                  value={hostCount}
                  onChange={(e) => setHostCount(Number(e.target.value))}
                  min="1"
                  max="50"
                />
              </label>
              <label className="ui-field">
                {t("bear.bearGroup")}
                <select
                  className="ui-select"
                  value={selectedBearGroup}
                  onChange={(e) => setSelectedBearGroup(e.target.value as "bear1" | "bear2")}
                >
                  <option value="bear1">{t("bear.bear1")}</option>
                  <option value="bear2">{t("bear.bear2")}</option>
                </select>
              </label>
              <button
                className="ui-button ui-button-wide nav:justify-self-end"
                type="button"
                onClick={() => generateRallyOrder(selectedBearGroup)}
                disabled={
                  (selectedBearGroup === "bear1" ? sortedBear1.length : sortedBear2.length) ===
                  0
                }
              >
                {t("bear.generateOrder")}
              </button>
            </div>
            {rallyOrder && (
              <div className="mt-5">
                <div className="ui-codeblock">
                  {rallyOrder}
                </div>
                <button className="ui-button-ghost mt-3" type="button" onClick={copyToClipboard}>
                  {t("bear.copyToClipboard")}
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

export default BearRally;
