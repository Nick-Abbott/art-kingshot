import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function BearRally() {
  const { t } = useTranslation();
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
    setLookupStatus(t("bear.lookup.looking"));
    try {
      const res = await fetch("/api/player-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || t("bear.errors.lookupFailed"));
      }
      const name = extractPlayerName(data);
      if (!name) throw new Error(t("bear.errors.noPlayerName"));
      setLookupStatus(t("bear.lookup.found", { name }));
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
        throw new Error(data.error || t("bear.errors.signupFailed"));
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
        setModalError(err.message || t("modal.errorOccurred"));
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
      t("bear.prompts.resetBear", { bear: bearGroup === "bear1" ? t("bear.bear1") : t("bear.bear2") }),
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
              throw new Error(t("bear.errors.invalidCode"));
            }
            throw new Error(t("bear.errors.resetFailed"));
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
      t("bear.prompts.removeMember"),
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
              throw new Error(t("bear.errors.invalidCode"));
            }
            throw new Error(data.error || t("bear.errors.removeFailed"));
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
              placeholder={t("modal.placeholder")}
            />
            {modalError && <p className="modal-error">{modalError}</p>}
            <div className="modal-actions">
              <button className="ghost-button" onClick={handleModalCancel}>
                {t("modal.cancel")}
              </button>
              <button className="primary-button" onClick={handleModalConfirm}>
                {t("modal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="app">
      <header className="hero">
        <div className="hero-content">
          <p className="eyebrow">{t("bear.eyebrow")}</p>
          <h1>{t("bear.title")}</h1>
          <p className="hero-subtitle">
            {t("bear.subtitle")}
          </p>
        </div>
        <div className="hero-card">
          <div>
            <p className="hero-label">{t("bear.bear1")}</p>
            <p className="hero-value">{bear1Members.length}</p>
          </div>
          <div>
            <p className="hero-label">{t("bear.bear2")}</p>
            <p className="hero-value">{bear2Members.length}</p>
          </div>
        </div>
      </header>

      <main>
        <section className="panel">
          <div className="panel-header">
            <h2>{editingMember ? t("bear.editSignupTitle") : t("bear.signupTitle")}</h2>
            <p>{editingMember ? t("bear.editSignupSubtitle") : t("bear.signupSubtitle")}</p>
          </div>
          <form className="signup-form" onSubmit={submitSignup}>
            <label>
              {t("bear.playerId")}
              <input
                name="playerId"
                value={form.playerId}
                onChange={(e) => setForm({ ...form, playerId: e.target.value })}
                placeholder={t("bear.playerId")}
                required
                disabled={editingMember !== null}
                className={editingMember !== null ? "read-only" : ""}
              />
            </label>
            {lookupStatus && <span className="lookup-status">{lookupStatus}</span>}
            <label>
              {t("bear.rallySize")}
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
              {t("bear.bearGroup")}
              <select
                name="bearGroup"
                value={form.bearGroup}
                onChange={(e) => setForm({ ...form, bearGroup: e.target.value })}
                required
              >
                <option value="bear1">{t("bear.bear1")}</option>
                <option value="bear2">{t("bear.bear2")}</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              {editingMember ? t("bear.update") : t("bear.register")}
            </button>
          </form>
          {editingMember && (
            <button
              className="ghost-button button-spacer"
              type="button"
              onClick={cancelEdit}
            >
              {t("bear.cancelEdit")}
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel">
          <div className="panel-header panel-header-split">
            <div>
              <h2>{t("bear.bear1")}</h2>
              <p>{t("bear.sortedByRally")}</p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => resetBearGroup("bear1")}
              disabled={busy}
            >
              {t("bear.resetBear1")}
            </button>
          </div>
          <div className="roster">
            {sortedBear1.length === 0 ? (
              <p className="empty">{t("bear.noSignups")}</p>
            ) : (
              sortedBear1.map((member) => (
                <div key={member.playerId} className="roster-card">
                  <div>
                    <p className="roster-name">
                      {member.playerName || member.playerId}
                    </p>
                    <p className="roster-meta">
                      {t("bear.rallySizeMeta", { value: formatNumber(member.rallySize) })}
                    </p>
                  </div>
                  <div className="roster-actions">
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => startEdit(member, "bear1")}
                      disabled={busy}
                    >
                      {t("bear.edit")}
                    </button>
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => removeMember("bear1", member.playerId)}
                      disabled={busy}
                    >
                      {t("bear.remove")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header panel-header-split">
            <div>
              <h2>{t("bear.bear2")}</h2>
              <p>{t("bear.sortedByRally")}</p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => resetBearGroup("bear2")}
              disabled={busy}
            >
              {t("bear.resetBear2")}
            </button>
          </div>
          <div className="roster">
            {sortedBear2.length === 0 ? (
              <p className="empty">{t("bear.noSignups")}</p>
            ) : (
              sortedBear2.map((member) => (
                <div key={member.playerId} className="roster-card">
                  <div>
                    <p className="roster-name">
                      {member.playerName || member.playerId}
                    </p>
                    <p className="roster-meta">
                      {t("bear.rallySizeMeta", { value: formatNumber(member.rallySize) })}
                    </p>
                  </div>
                  <div className="roster-actions">
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => startEdit(member, "bear2")}
                      disabled={busy}
                    >
                      {t("bear.edit")}
                    </button>
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => removeMember("bear2", member.playerId)}
                      disabled={busy}
                    >
                      {t("bear.remove")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>{t("bear.generatorTitle")}</h2>
            <p>{t("bear.generatorSubtitle")}</p>
          </div>
          <div className="signup-form">
            <label>
              {t("bear.numberOfHosts")}
              <input
                type="number"
                value={hostCount}
                onChange={(e) => setHostCount(Number(e.target.value))}
                min="1"
                max="50"
              />
            </label>
            <label>
              {t("bear.bearGroup")}
              <select
                value={selectedBearGroup}
                onChange={(e) => setSelectedBearGroup(e.target.value)}
              >
                <option value="bear1">{t("bear.bear1")}</option>
                <option value="bear2">{t("bear.bear2")}</option>
              </select>
            </label>
            <button
              className="primary-button"
              type="button"
              onClick={() => generateRallyOrder(selectedBearGroup)}
              disabled={(selectedBearGroup === "bear1" ? sortedBear1.length : sortedBear2.length) === 0}
            >
              {t("bear.generateOrder")}
            </button>
          </div>
          {rallyOrder && (
            <div className="rally-order">
              <div className="rally-order-output">
                {rallyOrder}
              </div>
              <button
                className="ghost-button rally-order-copy"
                type="button"
                onClick={copyToClipboard}
              >
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
