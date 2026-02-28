import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import VikingVengeance from "./VikingVengeance";
import BearRally from "./BearRally";

function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState(() => window.localStorage.getItem("currentPage") || "viking");
  const [authStatus, setAuthStatus] = useState("loading");
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [selectedAlliance, setSelectedAlliance] = useState(
    () => window.localStorage.getItem("selectedAlliance") || ""
  );

  function switchPage(newPage) {
    setPage(newPage);
    window.localStorage.setItem("currentPage", newPage);
  }

  useEffect(() => {
    async function loadSession() {
      setAuthStatus("loading");
      setAuthError("");
      try {
        const res = await fetch("/api/me");
        if (res.status === 401) {
          setUser(null);
          setMemberships([]);
          setAuthStatus("unauthenticated");
          return;
        }
        const data = await res.json();
        setUser(data.user || null);
        setMemberships(data.memberships || []);
        setAuthStatus("authenticated");
      } catch (error) {
        setAuthError(t("auth.loadFailed"));
        setAuthStatus("unauthenticated");
      }
    }

    loadSession();
  }, [t]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const allowed = memberships.map((item) => item.allianceId);
    if (selectedAlliance && allowed.includes(selectedAlliance)) return;
    const fallback = allowed[0] || "";
    setSelectedAlliance(fallback);
    if (fallback) {
      window.localStorage.setItem("selectedAlliance", fallback);
    }
  }, [authStatus, memberships, selectedAlliance]);

  const currentMembership = useMemo(
    () => memberships.find((item) => item.allianceId === selectedAlliance) || null,
    [memberships, selectedAlliance]
  );

  const canManage =
    Boolean(user?.isAppAdmin) || currentMembership?.role === "alliance_admin";

  function handleAllianceChange(event) {
    const next = event.target.value;
    setSelectedAlliance(next);
    window.localStorage.setItem("selectedAlliance", next);
  }

  function handleLogin() {
    window.location.href = "/api/auth/discord";
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMemberships([]);
    setAuthStatus("unauthenticated");
  }

  if (authStatus === "loading") {
    return (
      <div className="app-shell">
        <div className="auth-screen">
          <div className="auth-card">
            <p className="eyebrow">{t("auth.loading")}</p>
            <h1>{t("auth.loadingTitle")}</h1>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus !== "authenticated") {
    return (
      <div className="app-shell">
        <div className="auth-screen">
          <div className="auth-card">
            <p className="eyebrow">{t("auth.eyebrow")}</p>
            <h1>{t("auth.title")}</h1>
            <p className="hero-subtitle">{t("auth.subtitle")}</p>
            {authError && <p className="error">{authError}</p>}
            <div className="auth-actions">
              <button className="primary-button" type="button" onClick={handleLogin}>
                {t("auth.login")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-tabs">
          <button
            onClick={() => switchPage("viking")}
            className={`app-tab ${page === "viking" ? "is-active" : ""}`}
          >
            {t("app.tabs.viking")}
          </button>
          <button
            onClick={() => switchPage("bear")}
            className={`app-tab ${page === "bear" ? "is-active" : ""}`}
          >
            {t("app.tabs.bear")}
          </button>
        </div>
        <div className="app-controls">
          <label className="app-select">
            <span>{t("app.alliance")}</span>
            <select value={selectedAlliance} onChange={handleAllianceChange}>
              {memberships.map((membership) => (
                <option key={membership.allianceId} value={membership.allianceId}>
                  {membership.allianceName}
                </option>
              ))}
            </select>
          </label>
          <div className="user-chip">
            {user?.avatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              <span className="user-avatar-fallback">
                {(user?.displayName || "A").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span>{user?.displayName}</span>
          </div>
          <button className="ghost-button small" type="button" onClick={handleLogout}>
            {t("auth.logout")}
          </button>
        </div>
      </nav>
      {page === "viking" ? (
        <VikingVengeance allianceId={selectedAlliance} canManage={canManage} />
      ) : (
        <BearRally allianceId={selectedAlliance} canManage={canManage} />
      )}
    </div>
  );
}











export default App;
