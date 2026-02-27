import React, { useState } from "react";
import VikingVengeance from "./VikingVengeance";
import BearRally from "./BearRally";

function App() {
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
          Viking Vengeance
        </button>
        <button
          onClick={() => switchPage("bear")}
          className={`app-tab ${page === "bear" ? "is-active" : ""}`}
        >
          Bear Rally
        </button>
      </nav>
      {page === "viking" ? <VikingVengeance /> : <BearRally />}
    </div>
  );
}











export default App;
