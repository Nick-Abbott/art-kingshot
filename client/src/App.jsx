import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import VikingVengeance from "./VikingVengeance";
import BearRally from "./BearRally";

function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState(() => window.localStorage.getItem("currentPage") || "viking");

  function switchPage(newPage) {
    setPage(newPage);
    window.localStorage.setItem("currentPage", newPage);
  }

  return (
    <div className="app-shell">
      <nav className="app-nav">
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
      </nav>
      {page === "viking" ? <VikingVengeance /> : <BearRally />}
    </div>
  );
}











export default App;
