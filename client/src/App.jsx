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
    <div style={{ background: "radial-gradient(circle at top, #fff4dc 0%, #f6f2ea 45%, #efe8df 100%)", minHeight: "100vh", padding: "32px 20px 64px" }}>
      <nav style={{
        display: "flex",
        gap: "16px",
        padding: "20px 24px",
        background: "var(--panel)",
        borderRadius: "20px",
        boxShadow: "0 16px 30px var(--shadow)",
        marginBottom: "24px",
        maxWidth: "1100px",
        margin: "0 auto 24px"
      }}>
        <button
          onClick={() => switchPage("viking")}
          style={{
            padding: "12px 20px",
            background: page === "viking" ? "var(--accent)" : "transparent",
            color: page === "viking" ? "white" : "var(--ink)",
            border: page === "viking" ? "none" : "1px solid rgba(28, 27, 34, 0.12)",
            borderRadius: "999px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: "600",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            boxShadow: page === "viking" ? "0 10px 20px rgba(217, 107, 63, 0.3)" : "none"
          }}
        >
          Viking Vengeance
        </button>
        <button
          onClick={() => switchPage("bear")}
          style={{
            padding: "12px 20px",
            background: page === "bear" ? "var(--accent)" : "transparent",
            color: page === "bear" ? "white" : "var(--ink)",
            border: page === "bear" ? "none" : "1px solid rgba(28, 27, 34, 0.12)",
            borderRadius: "999px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: "600",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            boxShadow: page === "bear" ? "0 10px 20px rgba(217, 107, 63, 0.3)" : "none"
          }}
        >
          Bear Rally
        </button>
      </nav>
      {page === "viking" ? <VikingVengeance /> : <BearRally />}
    </div>
  );
}











export default App;
