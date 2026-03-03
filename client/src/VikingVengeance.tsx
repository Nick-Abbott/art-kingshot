import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "./apiClient";
import { lookupPlayer } from "./api/playerLookup";
import type { AssignmentResult } from "./api/assignments";
import { useAssignments } from "./hooks/useAssignments";
import { useMembers } from "./hooks/useMembers";
import type { Member } from "./api/members";
import type { Profile } from "@shared/types";
import { updateProfile } from "./api/profile";

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
  onProfileUpdated: (profile: Profile) => void;
};

type AssignmentMember = AssignmentResult["members"][number];

function VikingVengeance({ profileId, profile, canManage, onProfileUpdated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<VikingForm>(emptyForm);
  const { members, setMembers, saveMember, deleteMember } = useMembers(profileId);
  const { results, run, reset } = useAssignments(profileId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [lastLookupId, setLastLookupId] = useState("");
  const [profileWarning, setProfileWarning] = useState("");

  const memberCount = members.length;

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.playerId.localeCompare(b.playerId));
  }, [members]);

  function normalize(value: string) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function fuzzyScore(query: string, text: string) {
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
  }

  const filteredResults = useMemo(() => {
    if (!results?.members) return [];
    const query = searchQuery.trim();
    if (!query) return results.members;
    const scored = results.members
      .map((member) => {
        const name = member.playerName || member.playerId || "";
        const score = fuzzyScore(query, name);
        return score === null ? null : { member, score };
      })
      .filter(
        (item): item is { member: AssignmentMember; score: number } => item !== null
      )
      .sort((a, b) => b.score - a.score);
    return scored.map((item) => item.member);
  }, [results, searchQuery]);

  const searchSuggestions = useMemo(() => {
    if (!results?.members) return [];
    const query = searchQuery.trim();
    if (!query) return [];
    const scored = results.members
      .map((member) => {
        const name = member.playerName || member.playerId || "";
        const score = fuzzyScore(query, name);
        return score === null ? null : { name, score };
      })
      .filter((item): item is { name: string; score: number } => item !== null)
      .sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const item of scored) {
      if (seen.has(item.name)) continue;
      seen.add(item.name);
      suggestions.push(item.name);
      if (suggestions.length >= 5) break;
    }
    return suggestions;
  }, [results, searchQuery]);

  const topSuggestion = searchSuggestions[0] || "";
  const suggestionTail =
    topSuggestion &&
    topSuggestion.toLowerCase().startsWith(searchQuery.trim().toLowerCase())
      ? topSuggestion.slice(searchQuery.trim().length)
      : "";

  useEffect(() => {
    if (!profileId) return;
    setEditingMember(null);
    setLookupStatus("");
  }, [profileId]);

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

  async function lookupPlayerProfile(fid: string) {
    setLookupStatus(t("viking.lookup.looking"));
    try {
      const res = await lookupPlayer(fid);
      const name = extractPlayerName(res);
      if (!name) throw new Error(t("viking.errors.noPlayerName"));
      setLookupStatus(t("viking.lookup.found", { name }));
      const avatar = extractPlayerAvatar(res);
      const kingdomId = extractKingdomId(res);
      return { name, avatar, kingdomId };
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
      const fid = profile.playerId.trim();
      let resolvedName = form.playerName;
      let resolvedAvatar = profile?.playerAvatar || "";
      let resolvedKingdomId = profile?.kingdomId ?? null;

      if (!editingMember && (!resolvedName || fid !== lastLookupId)) {
        const lookup = await lookupPlayerProfile(fid);
        resolvedName = lookup.name;
        resolvedAvatar = lookup.avatar;
        resolvedKingdomId = lookup.kingdomId ?? null;
        setLastLookupId(fid);
      }

      const updatedMembers = await saveMember({
        playerId: fid,
        troopCount: parseNumber(form.troopCount),
        playerName: resolvedName,
        marchCount: Number(form.marchCount),
        power: parseNumber(form.power)
      });
      setMembers(updatedMembers);
      setError("");
      if (!editingMember) {
        const updatedProfile = await updateProfile(profileId, {
          playerId: fid,
          troopCount: parseNumber(form.troopCount),
          playerName: resolvedName,
          marchCount: Number(form.marchCount),
          power: parseNumber(form.power),
          playerAvatar: resolvedAvatar || null,
          kingdomId: resolvedKingdomId
        });
        if (updatedProfile) {
          onProfileUpdated(updatedProfile);
        } else {
          setProfileWarning(t("profiles.errors.updateFailed"));
        }
      }
      setForm(emptyForm);
      setLookupStatus("");
      setEditingMember(null);
    } catch (submitError: any) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(member: Member) {
    if (member.playerId !== profile?.playerId) return;
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

      if (result?.warnings && result.warnings.length > 0) {
        const notEnoughMembers = result.warnings.some(
          (w) =>
            w.includes("Need at least 2 members") ||
            w.includes("Not enough valid members")
        );
        if (notEnoughMembers) {
          throw new Error(t("viking.errors.needMembers"));
        }
      }

      setError("");
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
      setMembers([]);
      setForm(emptyForm);
      setLookupStatus("");
      setSearchQuery("");
      setError("");
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

  async function removeSignup(playerId: string) {
    setError("");
    setBusy(true);

    if (!canManage) {
      setError(t("auth.notAuthorizedAction"));
      setBusy(false);
      return;
    }

    try {
      const updatedMembers = await deleteMember(playerId);
      setMembers(updatedMembers);
      setError("");
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

  return (
    <>
      <div className="app">
        <header className="relative z-[1] mb-8 flex flex-col gap-6 nav:flex-row nav:items-stretch nav:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-accent-dark">
              {t("viking.eyebrow")}
            </p>
            <h1 className="mt-2 font-['DM Serif Display'] text-[clamp(2.4rem,3vw,3.5rem)]">
              {t("viking.title")}
            </h1>
            <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed text-muted">
              {t("viking.subtitle")}
            </p>
          </div>
          <div className="ui-card-compact grid gap-4 nav:min-w-[240px] nav:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-muted">
                {t("viking.signedUp")}
              </p>
              <p className="text-2xl font-semibold">{memberCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-muted">
                {t("viking.minimumIncoming")}
              </p>
              <p className="text-2xl font-semibold">200k</p>
            </div>
            <button
              className="ui-button-ghost w-full text-xs uppercase tracking-[0.1em] nav:col-span-2"
              type="button"
              onClick={resetAll}
              disabled={busy || !canManage}
            >
              {t("viking.resetEvent")}
            </button>
          </div>
        </header>

        <main className="relative z-[1] grid gap-6">
          {!results ? (
            <section className="ui-card">
              <div className="ui-section-header">
                <h2 className="ui-section-title">
                  {editingMember ? t("viking.editSignupTitle") : t("viking.signupTitle")}
                </h2>
                <p className="ui-section-subtitle">
                  {editingMember
                    ? t("viking.editSignupSubtitle")
                    : t("viking.signupSubtitle")}
                </p>
              </div>
              <form
                className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(3,minmax(0,1fr))_auto] nav:items-end"
                onSubmit={submitSignup}
              >
                <label className="ui-field">
                  {t("viking.marchCount")}
                  <input
                    className="ui-input"
                    name="marchCount"
                    value={form.marchCount}
                    onChange={updateForm}
                    type="number"
                    min="4"
                    max="6"
                    required
                  />
                </label>
                <label className="ui-field">
                  {t("viking.power")}
                  <input
                    className="ui-input"
                    name="power"
                    value={form.power}
                    onChange={updatePower}
                    inputMode="numeric"
                    placeholder={formatNumber(33000000)}
                    required
                  />
                </label>
                <label className="ui-field">
                  {t("viking.troopCount")}
                  <input
                    className="ui-input"
                    name="troopCount"
                    value={form.troopCount}
                    onChange={updateTroopCount}
                    inputMode="numeric"
                    placeholder={formatNumber(450000)}
                    required
                  />
                </label>
                <button
                  className="ui-button ui-button-wide mt-2 nav:mt-0 nav:justify-self-end"
                  type="submit"
                  disabled={busy}
                >
                  {editingMember ? t("viking.update") : t("viking.saveSignup")}
                </button>
              </form>
              {lookupStatus && (
                <span className="ui-field-hint mt-3">{lookupStatus}</span>
              )}
              {editingMember && (
                <button
                  className="ui-button-ghost mt-3"
                  type="button"
                  onClick={cancelEdit}
                >
                  {t("viking.cancelEdit")}
                </button>
              )}
            </section>
          ) : (
            <section className="ui-card">
              <div className="ui-section-header">
                <h2 className="ui-section-title">{t("viking.findAssignmentsTitle")}</h2>
                <p className="ui-section-subtitle">
                  {t("viking.findAssignmentsSubtitle")}
                </p>
              </div>
              <div className="mt-5">
                <label className="ui-field">
                  {t("viking.playerName")}
                  <div className="ui-search">
                    <input
                      className="ui-input"
                      name="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (!suggestionTail) return;
                        if (event.key === "Tab" || event.key === "Enter") {
                          event.preventDefault();
                          setSearchQuery(topSuggestion);
                        }
                      }}
                      placeholder={t("viking.searchPlaceholder")}
                      autoComplete="off"
                    />
                    {suggestionTail && (
                      <div className="ui-search-hint" aria-hidden="true">
                        <span className="ui-search-hint-typed">{searchQuery}</span>
                        <span className="ui-search-hint-tail">{suggestionTail}</span>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </section>
          )}

          {!results && (
            <section className="ui-card">
              <div className="ui-section-header">
                <h2 className="ui-section-title">{t("viking.rosterTitle")}</h2>
                <p className="ui-section-subtitle">{t("viking.rosterSubtitle")}</p>
              </div>
              <div className="mt-5 grid gap-3">
                {sortedMembers.length === 0 ? (
                  <p className="ui-empty-state">{t("viking.noSignups")}</p>
                ) : (
                  sortedMembers.map((member) => (
                    <div
                      key={member.playerId}
                      className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
                    >
                      <div>
                        <p className="font-semibold">
                          {member.playerName ? member.playerName : member.playerId}
                        </p>
                        <p className="text-sm text-muted">
                          {t("viking.troopsMeta", {
                            value: formatNumber(member.troopCount)
                          })}
                        </p>
                        <p className="text-sm text-muted">
                          {t("viking.powerMeta", { value: formatNumber(member.power) })}
                        </p>
                        <p className="text-sm text-muted">
                          {t("viking.marchesMeta", { value: member.marchCount })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="ui-button-ghost ui-button-sm"
                          type="button"
                          onClick={() => startEdit(member)}
                          disabled={busy || member.playerId !== profile?.playerId}
                        >
                          {t("viking.edit")}
                        </button>
                        <button
                          className="ui-button-ghost ui-button-sm"
                          type="button"
                          onClick={() => removeSignup(member.playerId)}
                          disabled={
                            busy ||
                            member.playerId !== profile?.playerId ||
                            !canManage
                          }
                        >
                          {t("viking.remove")}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {profileWarning && <p className="ui-error">{profileWarning}</p>}
              {error && <p className="ui-error">{error}</p>}
              <button
                className="ui-button-run mt-4"
                type="button"
                onClick={runAssignments}
                disabled={busy || !canManage}
              >
                {t("viking.runAssignments")}
              </button>
            </section>
          )}

          <section className="ui-card">
            <div className="ui-section-header">
              <h2 className="ui-section-title">{t("viking.assignmentsTitle")}</h2>
              <p className="ui-section-subtitle">{t("viking.assignmentsSubtitle")}</p>
            </div>
            {!results ? (
              <p className="ui-empty-state">{t("viking.noAssignments")}</p>
            ) : (
              <div className="mt-5 grid gap-4 nav:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
                {filteredResults.map((member) => (
                  <article key={member.playerId} className="ui-card-muted">
                    <header className="space-y-1">
                      <h3 className="text-lg font-semibold">
                        {member.playerName ? member.playerName : member.playerId}
                      </h3>
                      <p className="text-sm text-muted">
                        {t("viking.troopsOutgoing", {
                          value: formatNumber(member.troopCount)
                        })}
                      </p>
                      <p className="font-semibold text-ink">
                        {t("viking.incoming", {
                          value: formatNumber(member.incomingTotal)
                        })}
                      </p>
                      <p className="font-semibold text-ink">
                        {t("viking.troopsRemaining", {
                          value: formatNumber(member.troopsRemaining || 0)
                        })}
                      </p>
                      {member.garrisonLeadId ? (
                        <p className="font-semibold text-accent-dark">
                          {t("viking.garrisonLead", { name: member.garrisonLeadName })}
                        </p>
                      ) : (
                        <p className="text-sm text-muted">{t("viking.garrisonNone")}</p>
                      )}
                    </header>
                    <div className="mt-3">
                      <h4 className="text-sm font-semibold">{t("viking.sendTroopsTo")}</h4>
                      <ul className="mt-2 grid gap-2 text-sm">
                        {member.outgoing.map((item, index) => (
                          <li key={`${member.playerId}-out-${index}`}>
                            {(item.toName || item.toId)} — {formatNumber(item.troops)}{" "}
                            {item.whaleLead ? (
                              <span className="ml-2 inline-flex rounded-md bg-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold text-accent-dark">
                                {t("viking.lead")}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3">
                      <h4 className="text-sm font-semibold">{t("viking.receivingFrom")}</h4>
                      <ul className="mt-2 grid gap-2 text-sm">
                        {member.incoming.map((item, index) => (
                          <li key={`${member.playerId}-in-${index}`}>
                            {(item.fromName || item.fromId)} — {formatNumber(item.troops)}{" "}
                            {item.whaleLead ? (
                              <span className="ml-2 inline-flex rounded-md bg-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold text-accent-dark">
                                {t("viking.lead")}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

export default VikingVengeance;
