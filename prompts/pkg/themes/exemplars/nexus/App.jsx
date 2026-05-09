import React, { useEffect, useState } from "react";

// Theme: Nexus Grid — auto-generated exemplar.
// Tokens lifted from the catalog: bg #000000, accent #D4FF00.

export default function App() {
  const [draft, setDraft] = useState("");

  const c = {
    page: {
      minHeight: "100vh",
      background: "#000000",
      color: "rgba(255, 255, 255, 0.92)",
      fontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
      padding: "3rem 2rem 4rem",
    },
    container: { maxWidth: "56rem", margin: "0 auto" },
    header: { display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "2rem" },
    eyebrow: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "0.72rem",
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: "rgba(255, 255, 255, 0.55)",
    },
    title: {
      fontSize: "clamp(3rem, 13vw, 10rem)",
      fontWeight: 800,
      letterSpacing: "-0.04em",
      lineHeight: 0.9,
      color: "#D4FF00",
      margin: 0,
    },
    subtitle: {
      fontSize: "1.05rem",
      color: "rgba(255, 255, 255, 0.55)",
      maxWidth: "32rem",
      lineHeight: 1.5,
      margin: 0,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
      gap: "1.25rem",
      marginTop: "2.5rem",
    },
    card: {
      background: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      borderRadius: 14,
      padding: "1.5rem",
    },
    cardTitle: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "rgba(255, 255, 255, 0.55)",
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
      background: "rgba(255, 255, 255, 0.06)",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      fontSize: "0.95rem",
    },
    badge: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "0.7rem",
      padding: "0.18rem 0.6rem",
      borderRadius: 999,
      background: "#D4FF00",
      color: "#0a0a0a",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
    formRow: { display: "flex", gap: "0.5rem", marginTop: "0.5rem" },
    input: {
      flex: 1,
      background: "rgba(255, 255, 255, 0.06)",
      color: "rgba(255, 255, 255, 0.92)",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      borderRadius: 10,
      padding: "0.7rem 0.9rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      outline: "none",
    },
    button: {
      background: "#D4FF00",
      color: "#0a0a0a",
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
      color: "rgba(255, 255, 255, 0.92)",
      border: "1px solid rgba(255, 255, 255, 0.18)",
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
    <main id="app" style={c.page}>
      <div style={c.container}>
        <header style={c.header}>
          <span style={c.eyebrow}>vibes.diy theme</span>
          <h1 style={c.title}>Nexus Grid</h1>
          <p style={c.subtitle}>
            An exemplar app built on the Nexus Grid theme — list, form, and buttons rendered with the catalog tokens.
          </p>
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
              <input style={c.input} placeholder="What's on your mind?" value={draft} onChange={(e) => setDraft(e.target.value)} />
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
  );
}
