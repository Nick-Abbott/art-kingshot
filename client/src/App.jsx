import React, { useEffect, useMemo, useState } from "react";

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

function App() {
  const [form, setForm] = useState(emptyForm);
  const [members, setMembers] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [runCode, setRunCode] = useState(
    () => window.localStorage.getItem("runCode") || ""
  );

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
    async function load() {
      const membersRes = await fetch("/api/members");
      const membersJson = await membersRes.json();
      setMembers(membersJson.members || []);

      const resultsRes = await fetch("/api/results");
      const resultsJson = await resultsRes.json();
      setResults(resultsJson.results || null);
    }

    load().catch((loadError) => {
      console.error(loadError);
      setError("Failed to load data.");
    });
  }, []);

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
    setLookupStatus("Looking up player name...");
    try {
      const res = await fetch("/api/player-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Lookup failed.");
      }
      const name = extractPlayerName(data);
      if (!name) throw new Error("No player name found for that ID.");
      setLookupStatus(`Found: ${name}`);
      return name;
    } catch (lookupErr) {
      setLookupStatus("");
      throw lookupErr;
    }
  }

  async function submitSignup(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const fid = form.playerId.trim();
      const resolvedName = await lookupPlayerName(fid);
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        throw new Error(data.error || "Signup failed.");
      }
      setMembers(data.members || []);
      setForm(emptyForm);
      setLookupStatus("");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function runAssignments() {
    setError("");
    setBusy(true);
    try {
      let code = runCode;
      if (!code) {
        code = window.prompt("Enter the run code to generate assignments:");
        if (!code) {
          setBusy(false);
          return;
        }
        setRunCode(code);
        window.localStorage.setItem("runCode", code);
      }
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "x-run-code": code },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          window.localStorage.removeItem("runCode");
          setRunCode("");
        }
        throw new Error(data.error || "Failed to run assignments.");
      }
      setResults(data);
    } catch (runError) {
      setError(runError.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetAll() {
    setError("");
    setBusy(true);
    try {
      let code = runCode;
      if (!code) {
        code = window.prompt("Enter the run code to reset the event:");
        if (!code) {
          setBusy(false);
          return;
        }
        setRunCode(code);
        window.localStorage.setItem("runCode", code);
      }
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "x-run-code": code },
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403) {
          window.localStorage.removeItem("runCode");
          setRunCode("");
        }
        throw new Error(data.error || "Reset failed.");
      }
      setMembers([]);
      setResults(null);
      setForm(emptyForm);
      setLookupStatus("");
      setSearchQuery("");
    } catch (resetError) {
      setError(resetError.message || "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-content">
          <p className="eyebrow">Kingshot • Viking Vengeance</p>
          <h1>Viking Reinforcement Planner</h1>
          <p className="hero-subtitle">
            Everyone sends troops out, everyone gets covered, whales lead the garrison.
          </p>
        </div>
        <div className="hero-card">
          <div>
            <p className="hero-label">Signed up</p>
            <p className="hero-value">{memberCount}</p>
          </div>
          <div>
            <p className="hero-label">Minimum incoming</p>
            <p className="hero-value">200k</p>
          </div>
          <button className="ghost-button" type="button" onClick={resetAll} disabled={busy}>
            Reset event
          </button>
        </div>
      </header>

      <main>
        {!results ? (
          <section className="panel">
            <div className="panel-header">
              <h2>Signup</h2>
              <p>Enter your player ID and troop count for this event.</p>
            </div>
            <form className="signup-form" onSubmit={submitSignup}>
              <label>
                Player ID
                <input
                  name="playerId"
                  value={form.playerId}
                  onChange={updateForm}
                  placeholder="Player ID"
                  required
                />
              </label>
              {lookupStatus && <span className="lookup-status">{lookupStatus}</span>}
              <label>
                March count
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
                Power
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
                Troop count
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
              <button className="primary-button" type="submit" disabled={busy}>
                Save signup
              </button>
            </form>
            {error && <p className="error">{error}</p>}
          </section>
        ) : (
          <section className="panel">
            <div className="panel-header">
              <h2>Find your assignments</h2>
              <p>Search by player name to jump to your card.</p>
            </div>
            <div className="signup-form">
              <label>
                Player name
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
                    placeholder="Start typing a name..."
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
              <h2>Roster</h2>
              <p>Tap Run to calculate who reinforces who.</p>
            </div>
            <div className="roster">
              {sortedMembers.length === 0 ? (
                <p className="empty">No signups yet.</p>
              ) : (
                sortedMembers.map((member) => (
                  <div key={member.playerId} className="roster-card">
                    <div>
                      <p className="roster-name">
                        {member.playerName ? member.playerName : member.playerId}
                      </p>
                      <p className="roster-meta">
                        {formatNumber(member.troopCount)} troops
                      </p>
                      <p className="roster-meta">
                        {formatNumber(member.power)} power
                      </p>
                    </div>
                    {member.whale && <span className="badge">Whale</span>}
                  </div>
                ))
              )}
            </div>
            <button className="run-button" type="button" onClick={runAssignments} disabled={busy}>
              Run assignments
            </button>
          </section>
        )}

        <section className="panel results">
          <div className="panel-header">
            <h2>Assignments</h2>
            <p>Share the outgoing list so everyone sends all troops away.</p>
          </div>
          {!results ? (
            <p className="empty">No assignments yet.</p>
          ) : (
            <div className="results-grid">
              {filteredResults.map((member) => (
                <article key={member.playerId} className="result-card">
                  <header>
                    <h3>{member.playerName ? member.playerName : member.playerId}</h3>
                    <p>{formatNumber(member.troopCount)} troops outgoing</p>
                    <p className="incoming">
                      Incoming: {formatNumber(member.incomingTotal)}
                    </p>
                    <p className="incoming">
                      Troops remaining: {formatNumber(member.troopsRemaining || 0)}
                    </p>
                    {member.garrisonLeadId ? (
                      <p className="garrison">
                        Garrison lead: {member.garrisonLeadName}
                      </p>
                    ) : (
                      <p className="garrison muted">No whale garrison lead.</p>
                    )}
                  </header>
                  <div className="assignment-section">
                    <h4>Send troops to</h4>
                    <ul>
                      {member.outgoing.map((item, index) => (
                        <li key={`${member.playerId}-out-${index}`}>
                          {(item.toName || item.toId)} — {formatNumber(item.troops)}{" "}
                          {item.whaleLead ? <span className="tiny">Lead</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="assignment-section">
                    <h4>Receiving from</h4>
                    <ul>
                      {member.incoming.map((item, index) => (
                        <li key={`${member.playerId}-in-${index}`}>
                          {(item.fromName || item.fromId)} — {formatNumber(item.troops)}{" "}
                          {item.whaleLead ? <span className="tiny">Lead</span> : null}
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
  );
}

export default App;
