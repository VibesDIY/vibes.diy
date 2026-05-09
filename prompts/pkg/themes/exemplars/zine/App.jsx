import React, { useEffect, useState } from "react";

// Theme: Zine Cut — auto-generated exemplar with prefers-color-scheme.
// Canonical palette: bg oklch(0.96 0.005 100), accent oklch(0.05 0 0).
// Inverse computed by flipping oklch/hex lightness; tune by hand if needed.

const THEME_CSS = `
  :root {
    --bg: oklch(0.96 0.005 100);
    --accent: oklch(0.05 0 0);
    --text: rgba(20, 20, 20, 0.92);
    --muted: rgba(20, 20, 20, 0.5);
    --border: rgba(20, 20, 20, 0.14);
    --raised: rgba(255, 255, 255, 0.55);
    --card-bg: rgba(255, 255, 255, 0.85);
    --accent-text: #fafafa;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: oklch(0.06 0.005 100);
      --accent: oklch(0.95 0 0);
      --text: rgba(255, 255, 255, 0.92);
      --muted: rgba(255, 255, 255, 0.55);
      --border: rgba(255, 255, 255, 0.18);
      --raised: rgba(255, 255, 255, 0.06);
      --card-bg: rgba(255, 255, 255, 0.04);
      --accent-text: #0a0a0a;
    }
  }
  body { margin: 0; }
`;

export default function App() {
  const [draft, setDraft] = useState("");

  const c = {
    page: {
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      fontFamily: "var(--f-type)",
      padding: "3rem 2rem 4rem",
    },
    container: { maxWidth: "56rem", margin: "0 auto" },
    header: { display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "2rem" },
    eyebrow: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "0.72rem",
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: "var(--muted)",
    },
    title: {
      fontSize: "clamp(3rem, 13vw, 10rem)",
      fontWeight: 800,
      letterSpacing: "-0.04em",
      lineHeight: 0.9,
      color: "var(--accent)",
      margin: 0,
    },
    subtitle: {
      fontSize: "1.05rem",
      color: "var(--muted)",
      maxWidth: "32rem",
      lineHeight: 1.5,
      margin: 0,
    },
    modeNote: {
      marginTop: "0.5rem",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "0.7rem",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "var(--muted)",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
      gap: "1.25rem",
      marginTop: "2.5rem",
    },
    card: {
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "1.5rem",
    },
    cardTitle: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "var(--muted)",
      margin: "0 0 1rem",
    },
    list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.55rem" },
    listItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.75rem",
      padding: "0.7rem 0.85rem",
      borderRadius: 10,
      background: "var(--raised)",
      border: "1px solid var(--border)",
      fontSize: "0.95rem",
    },
    badge: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "0.7rem",
      padding: "0.18rem 0.6rem",
      borderRadius: 999,
      background: "var(--accent)",
      color: "var(--accent-text)",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
    formRow: { display: "flex", gap: "0.5rem", marginTop: "0.5rem" },
    input: {
      flex: 1,
      background: "var(--raised)",
      color: "var(--text)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "0.7rem 0.9rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      outline: "none",
    },
    button: {
      background: "var(--accent)",
      color: "var(--accent-text)",
      border: "none",
      borderRadius: 10,
      padding: "0.7rem 1.1rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      fontWeight: 600,
      cursor: "pointer",
    },
    ghost: {
      background: "transparent",
      color: "var(--text)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "0.7rem 1.1rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      cursor: "pointer",
    },
    buttonRow: { display: "flex", gap: "0.6rem", marginTop: "1.25rem", flexWrap: "wrap" },
  };

  const items = [
    { id: 1, title: "Daily standup notes", tag: "active" },
    { id: 2, title: "Q3 launch checklist", tag: "draft" },
    { id: 3, title: "Reading list", tag: "synced" },
  ];

  return (
    <>
      <style>{THEME_CSS}</style>
      <main id="app" style={c.page}>
        <div style={c.container}>
          <header style={c.header}>
            <span style={c.eyebrow}>vibes.diy theme</span>
            <h1 style={c.title}>Zine Cut</h1>
            <p style={c.subtitle}>An exemplar app on the Zine Cut theme — list, form, buttons rendered with the catalog tokens.</p>
            <div style={c.modeNote}>auto · light + dark via prefers-color-scheme</div>
          </header>

          <div style={c.grid}>
            <section style={c.card}>
              <h2 style={c.cardTitle}>Recent</h2>
              <ul style={c.list}>
                {items.map((it) => (
                  <li key={it.id} style={c.listItem}>
                    <span>{it.title}</span>
                    <span style={c.badge}>{it.tag}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section style={c.card}>
              <h2 style={c.cardTitle}>New entry</h2>
              <p style={{ ...c.subtitle, fontSize: "0.9rem", marginTop: "0.25rem" }}>Capture a quick thought.</p>
              <div style={c.formRow}>
                <input
                  style={c.input}
                  placeholder="What's on your mind?"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button style={c.button} type="button">
                  Save
                </button>
              </div>
              <div style={c.buttonRow}>
                <button style={c.button} type="button">
                  Primary
                </button>
                <button style={c.ghost} type="button">
                  Secondary
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
