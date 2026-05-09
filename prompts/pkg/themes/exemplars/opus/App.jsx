import React, { useEffect, useState } from "react";

// Theme: Opus Cabinet — elegant near-black, gold-leaf serifs (Cinzel).
// Layout: side nav + asymmetric single content card with chapter list.

export default function App() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;800&family=Cinzel+Decorative:wght@700;900&display=optional";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const [chapter, setChapter] = useState(2);
  const [draft, setDraft] = useState("");

  const p = {
    bg: "oklch(0.06 0 0)",
    panel: "oklch(0.12 0 0)",
    border: "oklch(0.20 0 0)",
    text: "oklch(0.90 0 0)",
    muted: "oklch(0.55 0 0)",
    gold: "oklch(0.73 0.10 78)",
    goldHi: "oklch(0.97 0.07 100)",
    crimson: "oklch(0.32 0.10 25)",
  };

  const c = {
    page: {
      minHeight: "100vh",
      background: p.bg,
      color: p.text,
      fontFamily: "'Cinzel', serif",
      display: "grid",
      gridTemplateColumns: "minmax(12rem, 16rem) 1fr",
      gap: "0",
    },
    nav: {
      borderRight: `1px solid ${p.border}`,
      padding: "2.5rem 1.75rem",
      background: p.panel,
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
    },
    navHeader: {
      fontFamily: "'Cinzel Decorative', serif",
      fontSize: "1.1rem",
      letterSpacing: "0.15em",
      color: p.gold,
      textTransform: "uppercase",
      borderBottom: `1px solid ${p.border}`,
      paddingBottom: "0.75rem",
      marginBottom: "0.5rem",
    },
    navItem: (active) => ({
      cursor: "pointer",
      fontSize: "0.95rem",
      letterSpacing: "0.08em",
      color: active ? p.goldHi : p.muted,
      paddingLeft: active ? "0.7rem" : 0,
      borderLeft: active ? `2px solid ${p.gold}` : "2px solid transparent",
      transition: "all 0.15s",
    }),
    body: {
      padding: "3rem 3rem 4rem",
      maxWidth: "60rem",
    },
    eyebrow: {
      fontFamily: "'Cinzel Decorative', serif",
      fontSize: "0.7rem",
      letterSpacing: "0.45em",
      color: p.gold,
      textTransform: "uppercase",
      marginBottom: "1.25rem",
    },
    title: {
      fontFamily: "'Cinzel Decorative', serif",
      fontSize: "clamp(3.5rem, 13vw, 10.5rem)",
      fontWeight: 900,
      lineHeight: 0.95,
      margin: 0,
      letterSpacing: "0.02em",
      background: `linear-gradient(180deg, ${p.goldHi} 0%, ${p.gold} 100%)`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    },
    rule: {
      width: "5rem",
      borderTop: `2px solid ${p.gold}`,
      marginTop: "1.5rem",
    },
    intro: {
      marginTop: "1.5rem",
      fontSize: "1.05rem",
      lineHeight: 1.7,
      color: p.text,
      maxWidth: "32rem",
    },
    section: {
      marginTop: "2.5rem",
      borderTop: `1px solid ${p.border}`,
      paddingTop: "1.5rem",
    },
    sectionTitle: {
      fontFamily: "'Cinzel Decorative', serif",
      fontSize: "0.78rem",
      letterSpacing: "0.3em",
      color: p.gold,
      textTransform: "uppercase",
      marginBottom: "1rem",
    },
    inputRow: { display: "flex", gap: "0.75rem", marginTop: "0.75rem" },
    input: {
      flex: 1,
      background: "transparent",
      color: p.text,
      border: `1px solid ${p.border}`,
      borderRadius: 0,
      padding: "0.7rem 0.85rem",
      fontFamily: "inherit",
      fontSize: "0.95rem",
      letterSpacing: "0.05em",
      outline: "none",
    },
    btnPrimary: {
      background: p.gold,
      color: p.bg,
      border: "none",
      padding: "0.7rem 1.5rem",
      fontFamily: "'Cinzel', serif",
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      cursor: "pointer",
    },
    btnGhost: {
      background: "transparent",
      color: p.gold,
      border: `1px solid ${p.gold}`,
      padding: "0.7rem 1.5rem",
      fontFamily: "'Cinzel', serif",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      cursor: "pointer",
    },
  };

  const chapters = ["Prelude", "First Movement", "Crescendo", "Coda", "Epilogue"];

  return (
    <main id="app" style={c.page}>
      <aside style={c.nav}>
        <div style={c.navHeader}>Cabinet</div>
        {chapters.map((ch, i) => (
          <div key={ch} style={c.navItem(i === chapter)} onClick={() => setChapter(i)}>
            {String(i + 1).padStart(2, "0")} · {ch}
          </div>
        ))}
      </aside>

      <article style={c.body}>
        <div style={c.eyebrow}>vibes.diy · cabinet of themes</div>
        <h1 style={c.title}>Opus</h1>
        <div style={c.rule} />
        <p style={c.intro}>
          A near-black canvas illuminated by gold leaf. Cinzel display, hand-set spacing, every divider engraved with intent.
        </p>

        <section style={c.section}>
          <h2 style={c.sectionTitle}>{chapters[chapter]}</h2>
          <p style={{ ...c.intro, marginTop: 0, fontSize: "0.98rem" }}>
            Annotate the current movement. Notes are bound to this chapter and may be reviewed in the cabinet.
          </p>
          <div style={c.inputRow}>
            <input style={c.input} placeholder="Annotation…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button type="button" style={c.btnPrimary}>
              Inscribe
            </button>
            <button type="button" style={c.btnGhost}>
              Discard
            </button>
          </div>
        </section>
      </article>
    </main>
  );
}
