import React, { useEffect, useState } from "react";

// Theme: Chrome Terminal — black-canvas neon-red display.
// Dark canonical, light auto-flips via @media (prefers-color-scheme: light).
// Glow text-shadow drops to a faint drop in light mode.

const THEME_CSS = `
  :root {
    --bg: #000000;
    --bg-surface: #171717;
    --bg-panel: #1a050c;
    --bg-card: #0e0508;
    --neon-red: #ff003c;
    --neon-yellow: #fcee0a;
    --neon-cyan: #00f0ff;
    --border: rgba(255, 0, 60, 0.45);
    --border-dim: #3d1326;
    --text: #ffffff;
    --text-dim: #d1d1d1;
    --text-muted: #a3a3a3;
    --glow: 0 0 28px rgba(255,0,60,0.55), 0 0 6px rgba(255,0,60,0.9);
    --bg-grad: radial-gradient(ellipse at top, #2a0a18 0%, #000 65%);
    --shadow-btn: 0 0 14px rgba(255,0,60,0.55);
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: oklch(0.97 0.005 0);
      --bg-surface: #ffffff;
      --bg-panel: oklch(0.95 0.02 25);
      --bg-card: oklch(0.93 0.04 25);
      --neon-red: oklch(0.55 0.24 28);
      --neon-yellow: oklch(0.78 0.16 90);
      --neon-cyan: oklch(0.50 0.15 220);
      --border: oklch(0.55 0.24 28 / 0.55);
      --border-dim: oklch(0.85 0.03 25);
      --text: oklch(0.18 0.04 25);
      --text-dim: oklch(0.32 0.04 25);
      --text-muted: oklch(0.45 0.04 25);
      --glow: 0 1px 0 oklch(0.55 0.24 28 / 0.25);
      --bg-grad: radial-gradient(ellipse at top, oklch(0.95 0.04 25) 0%, oklch(0.97 0.005 0) 70%);
      --shadow-btn: 0 0 0 1px oklch(0.55 0.24 28 / 0.35);
    }
  }
  body { margin: 0; }
`;

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

  const c = {
    page: {
      minHeight: "100vh",
      background: "var(--bg-grad)",
      color: "var(--text)",
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
      color: "var(--neon-yellow)",
    },
    title: {
      fontFamily: "'Orbitron', sans-serif",
      fontSize: "clamp(2.6rem, 11vw, 8.5rem)",
      fontWeight: 900,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--neon-red)",
      textShadow: "var(--glow)",
      margin: 0,
      lineHeight: 0.9,
    },
    subtitle: {
      fontSize: "0.95rem",
      color: "var(--text-dim)",
      maxWidth: "32rem",
      lineHeight: 1.5,
    },
    modeNote: {
      marginTop: "0.5rem",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.72rem",
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: "var(--neon-cyan)",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
      gap: "1.25rem",
      marginTop: "2.5rem",
    },
    card: {
      background: "var(--bg-panel)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      padding: "1.4rem",
      boxShadow: "inset 0 0 0 1px rgba(255,0,60,0.08)",
    },
    cardTitle: {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.7rem",
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: "var(--neon-cyan)",
      margin: "0 0 1rem",
    },
    list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" },
    listItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.75rem",
      padding: "0.6rem 0.75rem",
      border: "1px solid var(--border-dim)",
      background: "var(--bg-card)",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.85rem",
      color: "var(--text)",
    },
    pillAlert: {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.65rem",
      padding: "0.15rem 0.5rem",
      border: "1px solid var(--neon-red)",
      color: "var(--neon-red)",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
    },
    pillOk: {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.65rem",
      padding: "0.15rem 0.5rem",
      border: "1px solid var(--neon-cyan)",
      color: "var(--neon-cyan)",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
    },
    formRow: { display: "flex", gap: "0.5rem", marginTop: "0.4rem" },
    input: {
      flex: 1,
      background: "var(--bg)",
      color: "var(--text)",
      border: "1px solid var(--border-dim)",
      borderRadius: 4,
      padding: "0.65rem 0.85rem",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "0.85rem",
      outline: "none",
    },
    button: {
      background: "var(--neon-red)",
      color: "#fff",
      border: "1px solid var(--neon-red)",
      borderRadius: 4,
      padding: "0.65rem 1.1rem",
      fontFamily: "'Orbitron', sans-serif",
      fontSize: "0.8rem",
      fontWeight: 700,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      cursor: "pointer",
      boxShadow: "var(--shadow-btn)",
    },
    ghost: {
      background: "transparent",
      color: "var(--neon-yellow)",
      border: "1px solid var(--neon-yellow)",
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
    <>
      <style>{THEME_CSS}</style>
      <main id="app" style={c.page}>
        <div style={c.container}>
          <header style={c.header}>
            <span style={c.eyebrow}>vibes.diy ⏵ theme</span>
            <h1 style={c.title}>
              Chrome
              <br />
              Terminal
            </h1>
            <p style={c.subtitle}>Neon-red display, monospaced telemetry, hard edges. Adapts to your system color scheme.</p>
            <div style={c.modeNote}>auto · dark + light via prefers-color-scheme</div>
          </header>

          <div style={c.grid}>
            <section style={c.card}>
              <h2 style={c.cardTitle}>System Log</h2>
              <ul style={c.list}>
                {events.map((e) => (
                  <li key={e.id} style={c.listItem}>
                    <span>{e.msg}</span>
                    <span style={e.status === "alert" ? c.pillAlert : c.pillOk}>{e.status}</span>
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
    </>
  );
}
