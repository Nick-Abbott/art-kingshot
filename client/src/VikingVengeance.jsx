import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const emptyForm = {
  playerId: "",
  troopCount: "",
  playerName: "",
  marchCount: "4",
  power: "",
};

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function VikingVengeance({ allianceId, canManage }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [members, setMembers] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMember, setEditingMember] = useState(null);
  const [saveDefaults, setSaveDefaults] = useState(true);

  const memberCount = members.length;

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.playerId.localeCompare(b.playerId));
  }, [members]);

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function fuzzyScore(query, text) {
    if (!query) return 0;
    const q = normalize(query);
    const t = normalize(text);
    if (!q || !t) return null;
    let qi = 0;
    let score = 0;
    let lastMatch = -1;
    for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
      if (t[ti] === q[qi]) {
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
      .filter(Boolean)
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
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const seen = new Set();
    const suggestions = [];
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
    if (!allianceId) return;
    async function load() {
      const membersRes = await fetch("/api/members", {
        headers: { "x-alliance-id": allianceId },
      });
      const membersJson = await membersRes.json();
      setMembers(membersJson.members || []);

      const resultsRes = await fetch("/api/results", {
        headers: { "x-alliance-id": allianceId },
      });
      const resultsJson = await resultsRes.json();
      setResults(resultsJson.results || null);

      const profileRes = await fetch("/api/me/profile", {
        headers: { "x-alliance-id": allianceId },
      });
      const profileJson = await profileRes.json();
      if (profileJson.profile && !editingMember) {
        const profile = profileJson.profile;
        setForm({
          playerId: profile.playerId || "",
          troopCount: profile.troopCount ? String(profile.troopCount) : "",
          playerName: profile.playerName || "",
          marchCount: profile.marchCount ? String(profile.marchCount) : "4",
          power: profile.power ? formatNumber(profile.power) : "",
        });
      } else if (!editingMember) {
        setForm(emptyForm);
      }
    }

    load().catch((loadError) => {
      console.error(loadError);
      setError(t("viking.errors.loadFailed"));
    });
  }, [allianceId, editingMember, t]);

  function updateForm(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function formatNumberInput(value) {
    const digits = value.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString();
  }

  function updatePower(event) {
    setForm((prev) => ({
      ...prev,
      power: formatNumberInput(event.target.value),
    }));
  }

  function parseNumber(value) {
    const digits = String(value).replace(/[^0-9]/g, "");
    return digits ? Number(digits) : 0;
  }

  function extractPlayerName(payload) {
    const data = payload?.data ?? payload;
    return (
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

  async function lookupPlayerName(fid) {
    setLookupStatus(t("viking.lookup.looking"));
    try {
      const res = await fetch("/api/player-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || t("viking.errors.lookupFailed"));
      }
      const name = extractPlayerName(data);
      if (!name) throw new Error(t("viking.errors.noPlayerName"));
      setLookupStatus(t("viking.lookup.found", { name }));
      return name;
    } catch (lookupErr) {
      setLookupStatus("");
      throw lookupErr;
    }
  }

  async function saveProfileDefaults(payload) {
    if (!allianceId) return;
    await fetch("/api/me/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-alliance-id": allianceId,
      },
      body: JSON.stringify(payload),
    });
  }

  async function submitSignup(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!allianceId) {
        throw new Error(t("auth.notAuthorizedAction"));
      }
      const fid = form.playerId.trim();
      let resolvedName = form.playerName;
      
      // Only lookup player name if not editing and no name is set.
      if (!editingMember && !resolvedName) {
        resolvedName = await lookupPlayerName(fid);
      }
      
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-alliance-id": allianceId },
        body: JSON.stringify({
          playerId: fid,
          troopCount: Number(form.troopCount),
          playerName: resolvedName,
          marchCount: Number(form.marchCount),
          power: parseNumber(form.power),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(t("auth.notAuthorizedAction"));
        }
        throw new Error(data.error || t("viking.errors.signupFailed"));
      }
      setMembers(data.members || []);
      if (saveDefaults) {
        await saveProfileDefaults({
          playerId: fid,
          troopCount: Number(form.troopCount),
          playerName: resolvedName,
          marchCount: Number(form.marchCount),
          power: parseNumber(form.power),
        });
      }
      setForm(emptyForm);
      setLookupStatus("");
      setEditingMember(null);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(member) {
    setEditingMember(member.playerId);
    setForm({
      playerId: member.playerId,
      troopCount: String(member.troopCount),
      playerName: member.playerName || "",
      marchCount: String(member.marchCount),
      power: formatNumber(member.power),
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

    // Check if there are enough members before running
    if (members.length < 2) {
      setError(t("viking.errors.needMembers"));
      return;
    }
    
    setBusy(true);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "x-alliance-id": allianceId },
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(t("auth.notAuthorizedAction"));
        }
        throw new Error(data.error || t("viking.errors.runFailed"));
      }

      if (data.warnings && data.warnings.length > 0) {
        const notEnoughMembers = data.warnings.some((w) =>
          w.includes("Need at least 2 members") ||
          w.includes("Not enough valid members")
        );
        if (notEnoughMembers) {
          throw new Error(t("viking.errors.needMembers"));
        }
      }

      setResults(data);
    } catch (err) {
      setError(err.message);
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
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "x-alliance-id": allianceId },
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403) {
          throw new Error(t("auth.notAuthorizedAction"));
        }
        throw new Error(data.error || t("viking.errors.resetFailed"));
      }
      setMembers([]);
      setResults(null);
      setForm(emptyForm);
      setLookupStatus("");
      setSearchQuery("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSignup(playerId) {
    setError("");
    setBusy(true);

    if (!canManage) {
      setError(t("auth.notAuthorizedAction"));
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`/api/members/${playerId}`, {
        method: "DELETE",
        headers: { "x-alliance-id": allianceId },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(t("auth.notAuthorizedAction"));
        }
        throw new Error(data.error || t("viking.errors.removeFailed"));
      }
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="app">
      <header className="hero">
        <div className="hero-content">
          <p className="eyebrow">{t("viking.eyebrow")}</p>
          <h1>{t("viking.title")}</h1>
          <p className="hero-subtitle">
            {t("viking.subtitle")}
          </p>
        </div>
        <div className="hero-card">
          <div>
            <p className="hero-label">{t("viking.signedUp")}</p>
            <p className="hero-value">{memberCount}</p>
          </div>
          <div>
            <p className="hero-label">{t("viking.minimumIncoming")}</p>
            <p className="hero-value">200k</p>
          </div>
          <button className="ghost-button" type="button" onClick={resetAll} disabled={busy || !canManage}>
            {t("viking.resetEvent")}
          </button>
        </div>
      </header>

      <main>
        {!results ? (
          <section className="panel">
            <div className="panel-header">
              <h2>{editingMember ? t("viking.editSignupTitle") : t("viking.signupTitle")}</h2>
              <p>{editingMember ? t("viking.editSignupSubtitle") : t("viking.signupSubtitle")}</p>
            </div>
            <form className="signup-form" onSubmit={submitSignup}>
              <label>
                {t("viking.playerId")}
                <input
                  name="playerId"
                  value={form.playerId}
                  onChange={updateForm}
                  placeholder={t("viking.playerId")}
                  required
                  disabled={editingMember !== null}
                  className={editingMember !== null ? "read-only" : ""}
                />
              </label>
              {lookupStatus && <span className="lookup-status">{lookupStatus}</span>}
              <label>
                {t("viking.marchCount")}
                <input
                  name="marchCount"
                  value={form.marchCount}
                  onChange={updateForm}
                  type="number"
                  min="4"
                  max="6"
                  required
                />
              </label>
              <label>
                {t("viking.power")}
                <input
                  name="power"
                  value={form.power}
                  onChange={updatePower}
                  inputMode="numeric"
                  placeholder="33,000,000"
                  required
                />
              </label>
              <label>
                {t("viking.troopCount")}
                <input
                  name="troopCount"
                  value={form.troopCount}
                  onChange={updateForm}
                  type="number"
                  min="1"
                  placeholder="450000"
                  required
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={saveDefaults}
                  onChange={(event) => setSaveDefaults(event.target.checked)}
                />
                <span>{t("viking.saveDefaults")}</span>
              </label>
              <button className="primary-button" type="submit" disabled={busy}>
                {editingMember ? t("viking.update") : t("viking.saveSignup")}
              </button>
            </form>
            {editingMember && (
              <button
                className="ghost-button button-spacer"
                type="button"
                onClick={cancelEdit}
              >
                {t("viking.cancelEdit")}
              </button>
            )}
          </section>
        ) : (
          <section className="panel">
            <div className="panel-header">
              <h2>{t("viking.findAssignmentsTitle")}</h2>
              <p>{t("viking.findAssignmentsSubtitle")}</p>
            </div>
            <div className="signup-form">
              <label>
                {t("viking.playerName")}
                <div className="search-field">
                  <input
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
                    <div className="autocomplete-hint" aria-hidden="true">
                      <span className="hint-typed">{searchQuery}</span>
                      <span className="hint-tail">{suggestionTail}</span>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </section>
        )}

        {!results && (
          <section className="panel">
            <div className="panel-header">
              <h2>{t("viking.rosterTitle")}</h2>
              <p>{t("viking.rosterSubtitle")}</p>
            </div>
            <div className="roster">
              {sortedMembers.length === 0 ? (
                <p className="empty">{t("viking.noSignups")}</p>
              ) : (
                sortedMembers.map((member) => (
                  <div key={member.playerId} className="roster-card">
                    <div>
                      <p className="roster-name">
                        {member.playerName ? member.playerName : member.playerId}
                      </p>
                      <p className="roster-meta">
                        {t("viking.troopsMeta", { value: formatNumber(member.troopCount) })}
                      </p>
                      <p className="roster-meta">
                        {t("viking.powerMeta", { value: formatNumber(member.power) })}
                      </p>
                      <p className="roster-meta">
                        {t("viking.marchesMeta", { value: member.marchCount })}
                      </p>
                    </div>
                    <div className="roster-actions">
                      {member.whale && <span className="badge">{t("viking.whale")}</span>}
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={() => startEdit(member)}
                        disabled={busy}
                      >
                        {t("viking.edit")}
                      </button>
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={() => removeSignup(member.playerId)}
                        disabled={busy || !canManage}
                      >
                        {t("viking.remove")}
                      </button>
                    </div>
                  </div>
                ))
            )}
            </div>
            {error && <p className="error">{error}</p>}
            <button className="run-button" type="button" onClick={runAssignments} disabled={busy || !canManage}>
              {t("viking.runAssignments")}
            </button>
          </section>
        )}

        <section className="panel results">
          <div className="panel-header">
            <h2>{t("viking.assignmentsTitle")}</h2>
            <p>{t("viking.assignmentsSubtitle")}</p>
          </div>
          {!results ? (
            <p className="empty">{t("viking.noAssignments")}</p>
          ) : (
            <div className="results-grid">
              {filteredResults.map((member) => (
                <article key={member.playerId} className="result-card">
                  <header>
                    <h3>{member.playerName ? member.playerName : member.playerId}</h3>
                    <p>{t("viking.troopsOutgoing", { value: formatNumber(member.troopCount) })}</p>
                    <p className="incoming">
                      {t("viking.incoming", { value: formatNumber(member.incomingTotal) })}
                    </p>
                    <p className="incoming">
                      {t("viking.troopsRemaining", { value: formatNumber(member.troopsRemaining || 0) })}
                    </p>
                    {member.garrisonLeadId ? (
                      <p className="garrison">
                        {t("viking.garrisonLead", { name: member.garrisonLeadName })}
                      </p>
                    ) : (
                      <p className="garrison muted">{t("viking.garrisonNone")}</p>
                    )}
                  </header>
                  <div className="assignment-section">
                    <h4>{t("viking.sendTroopsTo")}</h4>
                    <ul>
                      {member.outgoing.map((item, index) => (
                        <li key={`${member.playerId}-out-${index}`}>
                          {(item.toName || item.toId)} — {formatNumber(item.troops)}{" "}
                          {item.whaleLead ? <span className="tiny">{t("viking.lead")}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="assignment-section">
                    <h4>{t("viking.receivingFrom")}</h4>
                    <ul>
                      {member.incoming.map((item, index) => (
                        <li key={`${member.playerId}-in-${index}`}>
                          {(item.fromName || item.fromId)} — {formatNumber(item.troops)}{" "}
                          {item.whaleLead ? <span className="tiny">{t("viking.lead")}</span> : null}
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
