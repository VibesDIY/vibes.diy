import React, { useEffect, useState } from "react";

// Theme: Neobrutalist — bold borders, vivid color blocks, Space Grotesk.
// Layout: stats strip + 3-card grid + chunky CTA.

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
  const p = {
    bg: "#f5f0e0",
    cardBg: "#ffffff",
    text: "#1a1a2e",
    border: "#1a1a2e",
    primary: "#DA291C",
    onPrimary: "#ffffff",
    yellow: "#fedd00",
    blue: "#3b82f6",
    green: "#22c55e",
    muted: "#6b6b80",
  };
  const shadow = `4px 4px 0 ${p.border}`;
  const shadowSm = `3px 3px 0 ${p.border}`;

  const c = {
    page: {
      minHeight: "100vh",
      background: p.bg,
      color: p.text,
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
      background: p.yellow,
      color: p.text,
      border: `2px solid ${p.border}`,
      padding: "0.25rem 0.7rem",
      boxShadow: shadowSm,
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
    titleAccent: { color: p.primary },
    subtitle: {
      marginTop: "1rem",
      fontSize: "1.05rem",
      maxWidth: "30rem",
      color: p.muted,
    },
    statsStrip: {
      marginTop: "2rem",
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      border: `2px solid ${p.border}`,
      boxShadow: shadow,
      background: p.cardBg,
    },
    statBox: {
      padding: "1.1rem 1.25rem",
      borderRight: `2px solid ${p.border}`,
    },
    statBoxLast: { padding: "1.1rem 1.25rem" },
    statLabel: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.65rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: p.muted,
    },
    statValue: {
      fontSize: "2rem",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      marginTop: "0.25rem",
    },
    grid: {
      marginTop: "2rem",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
      gap: "1.25rem",
    },
    card: {
      background: p.cardBg,
      border: `2px solid ${p.border}`,
      boxShadow: shadow,
      padding: "1.25rem",
    },
    cardTitle: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      margin: "0 0 0.85rem",
    },
    list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.45rem" },
    listItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0.55rem 0.7rem",
      border: `2px solid ${p.border}`,
      background: p.bg,
      fontSize: "0.95rem",
    },
    tag: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.65rem",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "0.15rem 0.5rem",
      border: `2px solid ${p.border}`,
    },
    input: {
      width: "100%",
      background: p.cardBg,
      color: p.text,
      border: `2px solid ${p.border}`,
      padding: "0.7rem 0.85rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      outline: "none",
      boxShadow: shadowSm,
    },
    btn: {
      background: p.primary,
      color: p.onPrimary,
      border: `2px solid ${p.border}`,
      padding: "0.75rem 1.4rem",
      fontFamily: "inherit",
      fontSize: "1rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      cursor: "pointer",
      boxShadow: shadow,
      marginTop: "0.85rem",
    },
    btnRow: { display: "flex", gap: "0.75rem", marginTop: "0.85rem", flexWrap: "wrap" },
    btnGhost: {
      background: p.cardBg,
      color: p.text,
      border: `2px solid ${p.border}`,
      padding: "0.7rem 1.2rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      fontWeight: 600,
      cursor: "pointer",
      boxShadow: shadowSm,
    },
    btnYellow: {
      background: p.yellow,
      color: p.text,
      border: `2px solid ${p.border}`,
      padding: "0.7rem 1.2rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: shadowSm,
    },
  };

  return (
    <main id="app" style={c.page}>
      <div style={c.container}>
        <span style={c.eyebrow}>vibes.diy theme · 06</span>
        <h1 style={c.title}>
          Neo<span style={c.titleAccent}>brut</span>
          <br />
          alist
        </h1>
        <p style={c.subtitle}>Hard edges. Chunky borders. Color blocks that yell.</p>

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
  );
}
