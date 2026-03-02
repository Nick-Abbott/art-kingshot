import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAlliance } from "./hooks/useAlliance";
import { useSession } from "./hooks/useSession";
import VikingVengeance from "./VikingVengeance";
import BearRally from "./BearRally";

function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState(
    () => window.localStorage.getItem("currentPage") || "viking"
  );
  const { status, user, memberships, error, setError, logout } = useSession();
  const { selectedAlliance, setSelectedAlliance, canManage } = useAlliance(
    memberships,
    user
  );

  function switchPage(newPage: string) {
    setPage(newPage);
    window.localStorage.setItem("currentPage", newPage);
  }

  useEffect(() => {
    if (error) {
      setError(t("auth.loadFailed"));
    }
  }, [error, setError, t]);

  function handleAllianceChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    setSelectedAlliance(next);
  }

  function handleLogin() {
    window.location.href = "/api/auth/discord";
  }

  if (status === "loading") {
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

  if (status !== "authenticated") {
    return (
      <div className="app-shell">
        <div className="auth-screen">
          <div className="auth-card">
            <p className="eyebrow">{t("auth.eyebrow")}</p>
            <h1>{t("auth.title")}</h1>
            <p className="hero-subtitle">{t("auth.subtitle")}</p>
            {error && <p className="error">{error}</p>}
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
          <button className="ghost-button small" type="button" onClick={logout}>
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
