import React, { useEffect, useState } from "react";

// Theme: Chrome Terminal — black canvas, neon-red display, mocked telemetry UI.

export default function App() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;700&family=Share+Tech+Mono&display=optional";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const [draft, setDraft] = useState("");

  const palette = {
    bg: "#000",
    surface: "#0e0508",
    panel: "#1a050c",
    panelHi: "#2a0a18",
    border: "rgba(255, 0, 60, 0.45)",
    borderDim: "#3d1326",
    text: "#fff",
    textDim: "#d1d1d1",
    muted: "#a3a3a3",
    neonRed: "#ff003c",
    neonYellow: "#fcee0a",
    neonCyan: "#00f0ff",
  };

  const c = {
    page: {
      minHeight: "100vh",
      background: `radial-gradient(ellipse at top, ${palette.panelHi} 0%, ${palette.bg} 65%)`,
      color: palette.text,
      fontFamily: "'Rajdhani', sans-serif",
      padding: "3rem 2rem 4rem",
    },
    container: { maxWidth: "60rem", margin: "0 auto" },
    header: { display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2.5rem" },
    eyebrow: {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.78rem",
      letterSpacing: "0.35em",
      textTransform: "uppercase",
      color: palette.neonYellow,
    },
    title: {
      fontFamily: "'Orbitron', sans-serif",
      fontSize: "clamp(2.6rem, 11vw, 8.5rem)",
      fontWeight: 900,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: palette.neonRed,
      textShadow: "0 0 28px rgba(255,0,60,0.55), 0 0 6px rgba(255,0,60,0.9)",
      margin: 0,
      lineHeight: 0.9,
    },
    subtitle: {
      fontSize: "0.95rem",
      color: palette.textDim,
      maxWidth: "32rem",
      lineHeight: 1.5,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
      gap: "1.25rem",
      marginTop: "2.5rem",
    },
    card: {
      background: palette.panel,
      border: `1px solid ${palette.border}`,
      borderRadius: 6,
      padding: "1.4rem",
      boxShadow: "inset 0 0 0 1px rgba(255,0,60,0.08)",
    },
    cardTitle: {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.7rem",
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: palette.neonCyan,
      margin: "0 0 1rem",
    },
    list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" },
    listItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.75rem",
      padding: "0.6rem 0.75rem",
      border: `1px solid ${palette.borderDim}`,
      background: palette.surface,
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.85rem",
    },
    pill: {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.65rem",
      padding: "0.15rem 0.5rem",
      border: `1px solid ${palette.neonRed}`,
      color: palette.neonRed,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
    },
    pillOk: {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.65rem",
      padding: "0.15rem 0.5rem",
      border: `1px solid ${palette.neonCyan}`,
      color: palette.neonCyan,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
    },
    formRow: { display: "flex", gap: "0.5rem", marginTop: "0.4rem" },
    input: {
      flex: 1,
      background: palette.bg,
      color: palette.text,
      border: `1px solid ${palette.borderDim}`,
      borderRadius: 4,
      padding: "0.65rem 0.85rem",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.85rem",
      outline: "none",
    },
    button: {
      background: palette.neonRed,
      color: palette.bg,
      border: `1px solid ${palette.neonRed}`,
      borderRadius: 4,
      padding: "0.65rem 1.1rem",
      fontFamily: "'Orbitron', sans-serif",
      fontSize: "0.8rem",
      fontWeight: 700,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      cursor: "pointer",
      boxShadow: "0 0 14px rgba(255,0,60,0.55)",
    },
    ghost: {
      background: "transparent",
      color: palette.neonYellow,
      border: `1px solid ${palette.neonYellow}`,
      borderRadius: 4,
      padding: "0.65rem 1.1rem",
      fontFamily: "'Orbitron', sans-serif",
      fontSize: "0.8rem",
      fontWeight: 700,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      cursor: "pointer",
    },
    buttonRow: { display: "flex", gap: "0.6rem", marginTop: "1.25rem", flexWrap: "wrap" },
  };

  const events = [
    { id: 1, msg: "uplink synced", status: "ok" },
    { id: 2, msg: "anomaly @ sector 7", status: "alert" },
    { id: 3, msg: "telemetry cached", status: "ok" },
  ];

  return (
    <main id="app" style={c.page}>
      <div style={c.container}>
        <header style={c.header}>
          <span style={c.eyebrow}>vibes.diy ⏵ theme</span>
          <h1 style={c.title}>
            Chrome
            <br />
            Terminal
          </h1>
          <p style={c.subtitle}>Black canvas, neon-red display type, monospaced telemetry. Hard edges, glowing strokes.</p>
        </header>

        <div style={c.grid}>
          <section style={c.card}>
            <h2 style={c.cardTitle}>System Log</h2>
            <ul style={c.list}>
              {events.map((e) => (
                <li key={e.id} style={c.listItem}>
                  <span>{e.msg}</span>
                  <span style={e.status === "alert" ? c.pill : c.pillOk}>{e.status}</span>
                </li>
              ))}
            </ul>
          </section>

          <section style={c.card}>
            <h2 style={c.cardTitle}>Console Input</h2>
            <p style={{ ...c.subtitle, marginTop: 0, fontSize: "0.85rem" }}>Issue a command.</p>
            <div style={c.formRow}>
              <input style={c.input} placeholder="> _" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button style={c.button} type="button">
                Run
              </button>
            </div>
            <div style={c.buttonRow}>
              <button style={c.button} type="button">
                Engage
              </button>
              <button style={c.ghost} type="button">
                Standby
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
