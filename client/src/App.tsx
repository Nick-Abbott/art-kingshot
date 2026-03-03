import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProfileSelection } from "./hooks/useProfileSelection";
import { useSession } from "./hooks/useSession";
import VikingVengeance from "./VikingVengeance";
import BearRally from "./BearRally";
import Profiles from "./Profiles";

function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState(
    () => window.localStorage.getItem("currentPage") || "viking"
  );
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const { status, user, profiles, setProfiles, error, setError, logout } =
    useSession();
  const {
    selectedProfileId,
    setSelectedProfileId,
    selectedProfile,
    canManage
  } = useProfileSelection(profiles, user);

  function switchPage(newPage: string) {
    setPage(newPage);
    window.localStorage.setItem("currentPage", newPage);
  }

  useEffect(() => {
    if (error) {
      setError(t("auth.loadFailed"));
    }
  }, [error, setError, t]);

  function handleProfileSelect(profileId: string) {
    setSelectedProfileId(profileId);
    setProfileMenuOpen(false);
  }

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

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

  const showProfilesOnly = profiles.length === 0 || !selectedProfile;
  const profilePending =
    selectedProfile &&
    (selectedProfile.status !== "active" || !selectedProfile.allianceId);

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
          <button
            onClick={() => switchPage("profiles")}
            className={`app-tab ${page === "profiles" ? "is-active" : ""}`}
          >
            {t("app.tabs.profiles")}
          </button>
        </div>
        <div className="app-controls">
          <div className="profile-select" ref={profileMenuRef}>
            <span className="profile-label">{t("app.profile")}</span>
            <button
              className="profile-trigger"
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              disabled={profiles.length === 0}
            >
              {selectedProfile?.playerAvatar ? (
                <img src={selectedProfile.playerAvatar} alt="" />
              ) : (
                <span className="profile-avatar-fallback">
                  {(selectedProfile?.playerName || selectedProfile?.playerId || "P")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
              <span>
                {selectedProfile?.playerName ||
                  selectedProfile?.playerId ||
                  t("app.profileNone")}
              </span>
              <span className="profile-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            {profileMenuOpen && profiles.length > 0 && (
              <div className="profile-menu" role="listbox">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={`profile-option${
                      profile.id === selectedProfileId ? " is-selected" : ""
                    }`}
                    onClick={() => handleProfileSelect(profile.id)}
                  >
                    {profile.playerAvatar ? (
                      <img src={profile.playerAvatar} alt="" />
                    ) : (
                      <span className="profile-avatar-fallback">
                        {(profile.playerName || profile.playerId || "P")
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                    <span>
                      {profile.playerName ||
                        profile.playerId ||
                        t("app.profileFallback")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
      {showProfilesOnly || page === "profiles" || profilePending ? (
        <Profiles
          user={user}
          profiles={profiles}
          setProfiles={setProfiles}
          selectedProfile={selectedProfile}
          selectedProfileId={selectedProfileId}
        />
      ) : page === "viking" ? (
        <VikingVengeance
          profileId={selectedProfileId}
          profile={selectedProfile}
          canManage={canManage}
          onProfileUpdated={(updated) =>
            setProfiles((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item))
            )
          }
        />
      ) : (
        <BearRally
          profileId={selectedProfileId}
          profile={selectedProfile}
          canManage={canManage}
          onProfileUpdated={(updated) =>
            setProfiles((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item))
            )
          }
        />
      )}
    </div>
  );
}

export default App;
