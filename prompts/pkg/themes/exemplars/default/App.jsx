import React, { useEffect, useState } from "react";

// Theme: Default — Inter, golden accent, respects prefers-color-scheme.
// Light is the canonical default; dark auto-applies via @media query.
// All colors flow through CSS variables so the same component code reads
// correctly in both modes.

const THEME_CSS = `
  :root {
    --bg: oklch(0.97 0.01 80);
    --card-bg: oklch(1.00 0 0);
    --text: oklch(0.20 0.02 60);
    --accent: oklch(0.62 0.18 65);
    --accent-text: oklch(1.00 0 0);
    --muted: oklch(0.50 0.02 60);
    --border: oklch(0.88 0.01 70);
    --raised: oklch(0.99 0.01 80);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: oklch(0.18 0.04 60);
      --card-bg: oklch(0.22 0.04 60);
      --text: oklch(0.95 0.01 80);
      --accent: oklch(0.72 0.18 70);
      --accent-text: oklch(0.12 0.04 60);
      --muted: oklch(0.55 0.03 60);
      --border: oklch(0.35 0.04 60);
      --raised: oklch(0.20 0.04 60);
    }
  }
  body { margin: 0; }
`;

export default function App() {
  useEffect(() => {
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=optional";
    document.head.appendChild(fontLink);
    return () => fontLink.remove();
  }, []);

  const [draft, setDraft] = useState("");

  const c = {
    page: {
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      fontFamily: "'Inter', sans-serif",
      padding: "3rem 2rem 4rem",
    },
    container: { maxWidth: "56rem", margin: "0 auto" },
    header: { display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" },
    eyebrow: {
      fontSize: "0.75rem",
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: "var(--muted)",
    },
    title: {
      fontSize: "clamp(3rem, 12vw, 9rem)",
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
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "var(--muted)",
      margin: "0 0 1rem",
    },
    list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" },
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
      fontSize: "0.7rem",
      padding: "0.18rem 0.55rem",
      borderRadius: 999,
      background: "var(--accent)",
      color: "var(--accent-text)",
      fontWeight: 600,
      letterSpacing: "0.05em",
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
    modeNote: {
      marginTop: "0.75rem",
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "var(--muted)",
    },
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
            <h1 style={c.title}>Default</h1>
            <p style={c.subtitle}>
              Calm warm canvas, golden accent, Inter throughout. Respects your system color scheme — light by day, dark by night.
            </p>
            <div style={c.modeNote}>Auto · light + dark via prefers-color-scheme</div>
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
              <p style={{ ...c.subtitle, marginTop: 0, fontSize: "0.9rem" }}>Capture a quick thought.</p>
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
