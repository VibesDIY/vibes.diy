import React, { useEffect, useState } from "react";

// Theme: Neobrutalist — bold borders, vivid color blocks, Space Grotesk.
// Light canonical, dark auto-flips via @media (prefers-color-scheme: dark).
// Border/shadow color flips with the canvas so the chunky offset stays visible.

const THEME_CSS = `
  :root {
    --bg: #f5f0e0;
    --card-bg: #ffffff;
    --text: #1a1a2e;
    --border: #1a1a2e;
    --muted: #6b6b80;
    --primary: #DA291C;
    --on-primary: #ffffff;
    --secondary: #fedd00;
    --on-secondary: #1a1a2e;
    --success: #22c55e;
    --info: #3b82f6;
    --shadow: 4px 4px 0 var(--border);
    --shadow-sm: 3px 3px 0 var(--border);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: oklch(0.18 0.02 280);
      --card-bg: oklch(0.22 0.02 280);
      --text: oklch(0.96 0.01 80);
      --border: oklch(0.96 0.01 80);
      --muted: oklch(0.60 0.03 280);
      --primary: #DA291C;
      --on-primary: #ffffff;
      --secondary: #fedd00;
      --on-secondary: #1a1a2e;
      --success: #22c55e;
      --info: #3b82f6;
      --shadow: 4px 4px 0 var(--border);
      --shadow-sm: 3px 3px 0 var(--border);
    }
  }
  body { margin: 0; }
`;

export default function App() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=optional";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const [draft, setDraft] = useState("");

  const c = {
    page: {
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      fontFamily: "'Space Grotesk', sans-serif",
      padding: "2.5rem 1.75rem 4rem",
    },
    container: { maxWidth: "62rem", margin: "0 auto" },
    eyebrow: {
      display: "inline-block",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      background: "var(--secondary)",
      color: "var(--on-secondary)",
      border: "2px solid var(--border)",
      padding: "0.25rem 0.7rem",
      boxShadow: "var(--shadow-sm)",
      marginBottom: "1.25rem",
    },
    title: {
      fontSize: "clamp(3.5rem, 14vw, 11rem)",
      fontWeight: 700,
      letterSpacing: "-0.04em",
      lineHeight: 0.85,
      margin: 0,
      textTransform: "uppercase",
    },
    titleAccent: { color: "var(--primary)" },
    subtitle: {
      marginTop: "1rem",
      fontSize: "1.05rem",
      maxWidth: "30rem",
      color: "var(--muted)",
    },
    modeNote: {
      marginTop: "0.75rem",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "var(--muted)",
    },
    statsStrip: {
      marginTop: "2rem",
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      border: "2px solid var(--border)",
      boxShadow: "var(--shadow)",
      background: "var(--card-bg)",
    },
    statBox: { padding: "1.1rem 1.25rem", borderRight: "2px solid var(--border)" },
    statBoxLast: { padding: "1.1rem 1.25rem" },
    statLabel: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.65rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "var(--muted)",
    },
    statValue: {
      fontSize: "2rem",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      marginTop: "0.25rem",
      color: "var(--text)",
    },
    grid: {
      marginTop: "2rem",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
      gap: "1.25rem",
    },
    card: {
      background: "var(--card-bg)",
      border: "2px solid var(--border)",
      boxShadow: "var(--shadow)",
      padding: "1.25rem",
    },
    cardTitle: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      margin: "0 0 0.85rem",
      color: "var(--text)",
    },
    list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.45rem" },
    listItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0.55rem 0.7rem",
      border: "2px solid var(--border)",
      background: "var(--bg)",
      fontSize: "0.95rem",
      color: "var(--text)",
    },
    tag: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.65rem",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "0.15rem 0.5rem",
      border: "2px solid var(--border)",
      color: "var(--text)",
    },
    input: {
      width: "100%",
      background: "var(--card-bg)",
      color: "var(--text)",
      border: "2px solid var(--border)",
      padding: "0.7rem 0.85rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      outline: "none",
      boxShadow: "var(--shadow-sm)",
      boxSizing: "border-box",
    },
    btn: {
      background: "var(--primary)",
      color: "var(--on-primary)",
      border: "2px solid var(--border)",
      padding: "0.75rem 1.4rem",
      fontFamily: "inherit",
      fontSize: "1rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      cursor: "pointer",
      boxShadow: "var(--shadow)",
      marginTop: "0.85rem",
    },
    btnYellow: {
      background: "var(--secondary)",
      color: "var(--on-secondary)",
      border: "2px solid var(--border)",
      padding: "0.7rem 1.2rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "var(--shadow-sm)",
    },
    btnGhost: {
      background: "var(--card-bg)",
      color: "var(--text)",
      border: "2px solid var(--border)",
      padding: "0.7rem 1.2rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      fontWeight: 600,
      cursor: "pointer",
      boxShadow: "var(--shadow-sm)",
    },
    btnRow: { display: "flex", gap: "0.75rem", marginTop: "0.85rem", flexWrap: "wrap" },
  };

  return (
    <>
      <style>{THEME_CSS}</style>
      <main id="app" style={c.page}>
        <div style={c.container}>
          <span style={c.eyebrow}>vibes.diy theme · 06</span>
          <h1 style={c.title}>
            Neo<span style={c.titleAccent}>brut</span>
            <br />
            alist
          </h1>
          <p style={c.subtitle}>Hard edges. Chunky borders. Color blocks that yell — in either mode.</p>
          <div style={c.modeNote}>auto · light + dark via prefers-color-scheme</div>

          <div style={c.statsStrip}>
            <div style={c.statBox}>
              <div style={c.statLabel}>Active</div>
              <div style={c.statValue}>42</div>
            </div>
            <div style={c.statBox}>
              <div style={c.statLabel}>Pending</div>
              <div style={c.statValue}>7</div>
            </div>
            <div style={c.statBoxLast}>
              <div style={c.statLabel}>Synced</div>
              <div style={c.statValue}>198</div>
            </div>
          </div>

          <div style={c.grid}>
            <section style={c.card}>
              <h2 style={c.cardTitle}>Queue</h2>
              <ul style={c.list}>
                <li style={c.listItem}>
                  <span>Ship release notes</span>
                  <span style={c.tag}>Hot</span>
                </li>
                <li style={c.listItem}>
                  <span>Triage inbox</span>
                  <span style={c.tag}>Open</span>
                </li>
                <li style={c.listItem}>
                  <span>Sync with team</span>
                  <span style={c.tag}>Done</span>
                </li>
              </ul>
            </section>

            <section style={c.card}>
              <h2 style={c.cardTitle}>Add Task</h2>
              <input style={c.input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What's the next move?" />
              <button type="button" style={c.btn}>
                Commit
              </button>
            </section>

            <section style={c.card}>
              <h2 style={c.cardTitle}>Actions</h2>
              <div style={c.btnRow}>
                <button type="button" style={c.btnYellow}>
                  Mark
                </button>
                <button type="button" style={c.btnGhost}>
                  Archive
                </button>
                <button type="button" style={c.btnGhost}>
                  Skip
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
