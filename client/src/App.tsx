import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProfileSelection } from "./hooks/useProfileSelection";
import { useSession } from "./hooks/useSession";
import { useProfilesQuery } from "./hooks/useProfilesQuery";
import VikingVengeance from "./VikingVengeance";
import BearRally from "./BearRally";
import Profiles from "./Profiles";
import Admin from "./Admin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./components/ui/dropdown-menu";

function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState(
    () => window.localStorage.getItem("currentPage") || "viking"
  );
  const [navOpen, setNavOpen] = useState(false);
  const { status, user, error, setError, logout } = useSession();
  const profilesQuery = useProfilesQuery(status === "authenticated");
  const profiles = profilesQuery.data || [];
  const {
    selectedProfileId,
    setSelectedProfileId,
    selectedProfile,
    canManage
  } = useProfileSelection(profiles, user);

  function switchPage(newPage: string) {
    setPage(newPage);
    window.localStorage.setItem("currentPage", newPage);
    setNavOpen(false);
  }

  useEffect(() => {
    if (error) {
      setError(t("auth.loadFailed"));
    }
  }, [error, setError, t]);

  function handleProfileSelect(profileId: string) {
    setSelectedProfileId(profileId);
    setNavOpen(false);
  }

  function handleLogin() {
    window.location.href = "/api/auth/discord";
  }

  const showProfilesOnly = profiles.length === 0 || !selectedProfile;
  const profilePending =
    selectedProfile &&
    (selectedProfile.status !== "active" || !selectedProfile.allianceId);
  const showAdmin = Boolean(user?.isAppAdmin);

  useEffect(() => {
    if (!showAdmin && page === "admin") {
      setPage("profiles");
      window.localStorage.setItem("currentPage", "profiles");
    }
  }, [page, showAdmin]);

  if (status === "loading") {
    return (
      <div className="app-shell">
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
          <div className="ui-card max-w-xl p-8 text-center">
            <p className="text-xs uppercase tracking-[0.15em] text-accent-dark">
              {t("auth.loading")}
            </p>
            <h1>{t("auth.loadingTitle")}</h1>
          </div>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="app-shell">
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
          <div className="ui-card max-w-xl p-8 text-center">
            <p className="text-xs uppercase tracking-[0.15em] text-accent-dark">
              {t("auth.eyebrow")}
            </p>
            <h1>{t("auth.title")}</h1>
            <p className="mt-3 text-muted">{t("auth.subtitle")}</p>
            {error && <p className="ui-error">{error}</p>}
            <div className="mt-6 flex justify-center">
              <button className="ui-button" type="button" onClick={handleLogin}>
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
      <nav className="ui-card-compact mx-auto mb-6 max-w-[1100px] px-4 py-3">
        <div className="flex items-center justify-between nav:hidden">
          <span className="text-sm font-semibold text-ink">
            {t(`app.tabs.${page}`)}
          </span>
          <button
            className="ui-icon-button"
            type="button"
            onClick={() => setNavOpen((prev) => !prev)}
            aria-expanded={navOpen}
            aria-label={t("app.menuToggle")}
            data-testid="nav-toggle"
          >
            <span className="relative h-3 w-5">
              <span className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-current" />
              <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-current" />
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-current" />
            </span>
          </button>
        </div>

        <div
          className={`flex flex-col gap-4 pt-4 nav:flex-row nav:items-center nav:justify-between nav:pt-0 ${
            navOpen ? "" : "hidden nav:flex"
          }`}
        >
          <div className="flex flex-col gap-2 nav:flex-row nav:items-center">
            <button
              onClick={() => switchPage("viking")}
              className={`ui-tab ${page === "viking" ? "ui-tab-active" : ""}`}
            >
              {t("app.tabs.viking")}
            </button>
            <button
              onClick={() => switchPage("bear")}
              className={`ui-tab ${page === "bear" ? "ui-tab-active" : ""}`}
            >
              {t("app.tabs.bear")}
            </button>
            <button
              onClick={() => switchPage("profiles")}
              className={`ui-tab ${page === "profiles" ? "ui-tab-active" : ""}`}
            >
              {t("app.tabs.profiles")}
            </button>
            {showAdmin && (
              <button
                onClick={() => switchPage("admin")}
                className={`ui-tab ${page === "admin" ? "ui-tab-active" : ""}`}
              >
                {t("app.tabs.admin")}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 nav:flex-row nav:items-center">
            <div className="relative flex flex-col gap-1 nav:flex-row nav:items-center nav:gap-2">
              <span className="text-[0.6rem] uppercase tracking-[0.18rem] text-muted leading-none nav:translate-y-[1px]">
                {t("app.profile")}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ui-pill ui-pill-outline min-w-[220px]"
                    type="button"
                    disabled={profiles.length === 0}
                    data-testid="profile-switcher"
                  >
                    {selectedProfile?.playerAvatar ? (
                      <img
                        src={selectedProfile.playerAvatar}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[0.7rem] font-bold text-white">
                        {(selectedProfile?.playerName || selectedProfile?.playerId || "P")
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-left">
                      {selectedProfile?.playerName ||
                        selectedProfile?.playerId ||
                        t("app.profileNone")}
                    </span>
                    <span className="text-xs opacity-60" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[min(320px,calc(100vw-2rem))]">
                  {profiles.map((profile) => (
                    <DropdownMenuItem
                      key={profile.id}
                      className={`flex items-center gap-3 ${
                        profile.id === selectedProfileId ? "bg-accent/10" : ""
                      }`}
                      onSelect={() => handleProfileSelect(profile.id)}
                    >
                      {profile.playerAvatar ? (
                        <img
                          src={profile.playerAvatar}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-white">
                          {(profile.playerName || profile.playerId || "P")
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        {profile.playerName ||
                          profile.playerId ||
                          t("app.profileFallback")}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="ui-pill ui-pill-muted">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[0.7rem] font-bold text-white">
                  {(user?.displayName || "A").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>{user?.displayName}</span>
            </div>

            <button className="ui-button-ghost" type="button" onClick={logout}>
              {t("auth.logout")}
            </button>
          </div>
        </div>
      </nav>
      {page === "admin" && showAdmin ? (
        <Admin isAppAdmin={showAdmin} />
      ) : showProfilesOnly || page === "profiles" || profilePending ? (
        <Profiles
          user={user}
          selectedProfile={selectedProfile}
          selectedProfileId={selectedProfileId}
        />
      ) : page === "viking" ? (
        <VikingVengeance
          profileId={selectedProfileId}
          profile={selectedProfile}
          canManage={canManage}
        />
      ) : (
        <BearRally
          profileId={selectedProfileId}
          profile={selectedProfile}
          canManage={canManage}
        />
      )}
    </div>
  );
}

export default App;
