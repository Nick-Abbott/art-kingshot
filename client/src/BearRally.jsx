import React, { useEffect, useState } from "react";

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function BearRally() {
  const [bear1Members, setBear1Members] = useState([]);
  const [bear2Members, setBear2Members] = useState([]);
  const [form, setForm] = useState({ playerId: "", rallySize: "", bearGroup: "bear1" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [runCode, setRunCode] = useState(() => window.localStorage.getItem("runCode") || "");
  const [hostCount, setHostCount] = useState(15);
  const [rallyOrder, setRallyOrder] = useState("");
  const [selectedBearGroup, setSelectedBearGroup] = useState("bear1");
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({ message: "", onConfirm: null });
  const [modalInput, setModalInput] = useState("");
  const [modalError, setModalError] = useState("");
  const [editingMember, setEditingMember] = useState(null);

  useEffect(() => {
    async function load() {
      const res1 = await fetch("/api/bear/bear1");
      const data1 = await res1.json();
      setBear1Members(data1.members || []);

      const res2 = await fetch("/api/bear/bear2");
      const data2 = await res2.json();
      setBear2Members(data2.members || []);
    }
    load().catch(console.error);
  }, []);

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
      let resolvedName = form.playerName;
      
      // Only lookup player name if not editing (new signup)
      if (!editingMember) {
        resolvedName = await lookupPlayerName(fid);
      }
      
      // If editing and bear group changed, remove from old group first
      if (editingMember && editingMember.bearGroup !== form.bearGroup) {
        await fetch(`/api/bear/${editingMember.bearGroup}/${fid}`, {
          method: "DELETE",
          headers: { "x-run-code": runCode || "" },
        });
      }
      
      const res = await fetch(`/api/bear/${form.bearGroup}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: fid,
          playerName: resolvedName,
          rallySize: Number(form.rallySize),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Signup failed.");
      }
      
      // Refresh both bear groups if we moved between them
      if (editingMember && editingMember.bearGroup !== form.bearGroup) {
        const oldGroupRes = await fetch(`/api/bear/${editingMember.bearGroup}`);
        const oldGroupData = await oldGroupRes.json();
        if (editingMember.bearGroup === "bear1") {
          setBear1Members(oldGroupData.members || []);
        } else {
          setBear2Members(oldGroupData.members || []);
        }
      }
      
      if (form.bearGroup === "bear1") {
        setBear1Members(data.members || []);
      } else {
        setBear2Members(data.members || []);
      }
      setForm({ playerId: "", rallySize: "", bearGroup: form.bearGroup, playerName: "" });
      setLookupStatus("");
      setEditingMember(null);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(member, bearGroup) {
    setEditingMember({ playerId: member.playerId, bearGroup });
    setForm({
      playerId: member.playerId,
      rallySize: String(member.rallySize),
      bearGroup: bearGroup,
      playerName: member.playerName || "",
    });
    setLookupStatus("");
    setError("");
  }

  function cancelEdit() {
    setEditingMember(null);
    setForm({ playerId: "", rallySize: "", bearGroup: "bear1", playerName: "" });
    setLookupStatus("");
    setError("");
  }

  function promptForCode(message, callback) {
    setModalConfig({ message, onConfirm: callback });
    setModalInput("");
    setModalError("");
    setShowModal(true);
  }

  async function handleModalConfirm() {
    if (modalInput.trim()) {
      setModalError("");
      try {
        await modalConfig.onConfirm(modalInput.trim());
        setShowModal(false);
      } catch (err) {
        setModalError(err.message || "An error occurred");
      }
    }
  }

  function handleModalCancel() {
    setShowModal(false);
    setModalError("");
    setBusy(false);
  }

  async function resetBearGroup(bearGroup) {
    setError("");
    setBusy(true);
    
    promptForCode(
      `Enter the run code to reset ${bearGroup === "bear1" ? "Bear 1" : "Bear 2"}:`,
      async (code) => {
        try {
          setRunCode(code);
          window.localStorage.setItem("runCode", code);
          
          const res = await fetch(`/api/bear/${bearGroup}`, {
            method: "DELETE",
            headers: { "x-run-code": code },
          });
          if (!res.ok) {
            if (res.status === 403) {
              window.localStorage.removeItem("runCode");
              setRunCode("");
              throw new Error("Invalid code. Please try again.");
            }
            throw new Error("Reset failed.");
          }
          if (bearGroup === "bear1") {
            setBear1Members([]);
          } else {
            setBear2Members([]);
          }
          setBusy(false);
        } catch (err) {
          setBusy(false);
          throw err;
        }
      }
    );
  }

  async function removeMember(bearGroup, playerId) {
    setError("");
    setBusy(true);
    
    promptForCode(
      "Enter the run code to remove a member:",
      async (code) => {
        try {
          setRunCode(code);
          window.localStorage.setItem("runCode", code);
          
          const res = await fetch(`/api/bear/${bearGroup}/${playerId}`, {
            method: "DELETE",
            headers: { "x-run-code": code },
          });
          const data = await res.json();
          if (!res.ok) {
            if (res.status === 403) {
              window.localStorage.removeItem("runCode");
              setRunCode("");
              throw new Error("Invalid code. Please try again.");
            }
            throw new Error(data.error || "Failed to remove member.");
          }
          if (bearGroup === "bear1") {
            setBear1Members(data.members || []);
          } else {
            setBear2Members(data.members || []);
          }
          setBusy(false);
        } catch (err) {
          setBusy(false);
          throw err;
        }
      }
    );
  }

  function generateRallyOrder(bearGroup) {
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
      {showModal && (
        <div className="modal-overlay" onClick={handleModalCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{modalConfig.message}</h3>
            <input
              type="text"
              className="modal-input"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleModalConfirm();
                if (e.key === "Escape") handleModalCancel();
              }}
              autoFocus
              placeholder="Enter code"
            />
            {modalError && <p className="modal-error">{modalError}</p>}
            <div className="modal-actions">
              <button className="ghost-button" onClick={handleModalCancel}>
                Cancel
              </button>
              <button className="primary-button" onClick={handleModalConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="app">
      <header className="hero">
        <div className="hero-content">
          <p className="eyebrow">Kingshot • Bear Rally</p>
          <h1>Bear Rally Planner</h1>
          <p className="hero-subtitle">
            Track rally sizes for Bear 1 (01:00 UTC) and Bear 2 (12:00 UTC).
          </p>
        </div>
        <div className="hero-card">
          <div>
            <p className="hero-label">Bear 1 (01:00 UTC)</p>
            <p className="hero-value">{bear1Members.length}</p>
          </div>
          <div>
            <p className="hero-label">Bear 2 (12:00 UTC)</p>
            <p className="hero-value">{bear2Members.length}</p>
          </div>
        </div>
      </header>

      <main>
        <section className="panel">
          <div className="panel-header">
            <h2>{editingMember ? "Edit Signup" : "Signup"}</h2>
            <p>{editingMember ? "Update your rally size." : "Enter your player ID, rally size, and select your bear group."}</p>
          </div>
          <form className="signup-form" onSubmit={submitSignup}>
            <label>
              Player ID
              <input
                name="playerId"
                value={form.playerId}
                onChange={(e) => setForm({ ...form, playerId: e.target.value })}
                placeholder="Player ID"
                required
                disabled={editingMember !== null}
                className={editingMember !== null ? "read-only" : ""}
              />
            </label>
            {lookupStatus && <span className="lookup-status">{lookupStatus}</span>}
            <label>
              Rally Size
              <input
                name="rallySize"
                value={form.rallySize}
                onChange={(e) => setForm({ ...form, rallySize: e.target.value })}
                type="number"
                min="1"
                placeholder="500000"
                required
              />
            </label>
            <label>
              Bear Group
              <select
                name="bearGroup"
                value={form.bearGroup}
                onChange={(e) => setForm({ ...form, bearGroup: e.target.value })}
                required
              >
                <option value="bear1">Bear 1 (01:00 UTC)</option>
                <option value="bear2">Bear 2 (12:00 UTC)</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              {editingMember ? "Update" : "Register"}
            </button>
          </form>
          {editingMember && (
            <button 
              className="ghost-button" 
              type="button" 
              onClick={cancelEdit}
              style={{ marginTop: "12px" }}
            >
              Cancel Edit
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2>Bear 1 (01:00 UTC)</h2>
              <p>Sorted by rally size (largest first).</p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => resetBearGroup("bear1")}
              disabled={busy}
            >
              Reset Bear 1
            </button>
          </div>
          <div className="roster">
            {sortedBear1.length === 0 ? (
              <p className="empty">No signups yet.</p>
            ) : (
              sortedBear1.map((member) => (
                <div key={member.playerId} className="roster-card">
                  <div>
                    <p className="roster-name">
                      {member.playerName || member.playerId}
                    </p>
                    <p className="roster-meta">
                      Rally size: {formatNumber(member.rallySize)}
                    </p>
                  </div>
                  <div className="roster-actions">
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => startEdit(member, "bear1")}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => removeMember("bear1", member.playerId)}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2>Bear 2 (12:00 UTC)</h2>
              <p>Sorted by rally size (largest first).</p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => resetBearGroup("bear2")}
              disabled={busy}
            >
              Reset Bear 2
            </button>
          </div>
          <div className="roster">
            {sortedBear2.length === 0 ? (
              <p className="empty">No signups yet.</p>
            ) : (
              sortedBear2.map((member) => (
                <div key={member.playerId} className="roster-card">
                  <div>
                    <p className="roster-name">
                      {member.playerName || member.playerId}
                    </p>
                    <p className="roster-meta">
                      Rally size: {formatNumber(member.rallySize)}
                    </p>
                  </div>
                  <div className="roster-actions">
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => startEdit(member, "bear2")}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => removeMember("bear2", member.playerId)}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Rally Order Generator</h2>
            <p>Generate a formatted rally order for copying to chat.</p>
          </div>
          <div className="signup-form">
            <label>
              Number of Hosts
              <input
                type="number"
                value={hostCount}
                onChange={(e) => setHostCount(Number(e.target.value))}
                min="1"
                max="50"
              />
            </label>
            <label>
              Bear Group
              <select
                value={selectedBearGroup}
                onChange={(e) => setSelectedBearGroup(e.target.value)}
              >
                <option value="bear1">Bear 1 (01:00 UTC)</option>
                <option value="bear2">Bear 2 (12:00 UTC)</option>
              </select>
            </label>
            <button
              className="primary-button"
              type="button"
              onClick={() => generateRallyOrder(selectedBearGroup)}
              disabled={(selectedBearGroup === "bear1" ? sortedBear1.length : sortedBear2.length) === 0}
            >
              Generate Rally Order
            </button>
          </div>
          {rallyOrder && (
            <div style={{ marginTop: "20px" }}>
              <div style={{
                background: "#f9f4ec",
                padding: "16px",
                borderRadius: "10px",
                fontFamily: "monospace",
                whiteSpace: "pre",
                border: "1px solid rgba(28, 27, 34, 0.1)"
              }}>
                {rallyOrder}
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={copyToClipboard}
                style={{ marginTop: "12px" }}
              >
                Copy to Clipboard
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
