import React, { useEffect, useState } from "react";

// Theme: Broadsheet — a daily newspaper. Helvetica, hairline rules, multi-column.

export default function App() {
  const [subscribe, setSubscribe] = useState("");

  const p = {
    bg: "#fff",
    ink: "#111",
    rule: "#111",
    muted: "#666",
    badge: "#000",
    badgeText: "#fff",
  };

  const c = {
    page: {
      minHeight: "100vh",
      background: p.bg,
      color: p.ink,
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      padding: "2rem 2.5rem 4rem",
    },
    container: { maxWidth: "70rem", margin: "0 auto" },
    masthead: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      borderTop: `4px double ${p.rule}`,
      borderBottom: `1px solid ${p.rule}`,
      padding: "0.85rem 0 0.6rem",
      marginBottom: "1.25rem",
      fontSize: "0.75rem",
      letterSpacing: "0.05em",
    },
    edition: { textTransform: "uppercase" },
    nameplate: {
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      fontSize: "clamp(4rem, 16vw, 13rem)",
      fontWeight: 900,
      letterSpacing: "-0.05em",
      lineHeight: 0.85,
      margin: "0.5rem 0 0.25rem",
      textAlign: "center",
      textTransform: "uppercase",
    },
    tagline: {
      textAlign: "center",
      fontStyle: "italic",
      letterSpacing: "0.08em",
      borderTop: `1px solid ${p.rule}`,
      borderBottom: `1px solid ${p.rule}`,
      padding: "0.45rem 0",
      fontSize: "0.85rem",
      color: p.muted,
    },
    columns: {
      marginTop: "2rem",
      display: "grid",
      gridTemplateColumns: "2fr 1fr",
      gap: "2.5rem",
    },
    leadHeadline: {
      fontSize: "2.5rem",
      fontWeight: 800,
      letterSpacing: "-0.02em",
      lineHeight: 1.05,
      margin: 0,
    },
    leadKicker: {
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: p.muted,
      marginBottom: "0.5rem",
    },
    leadBody: {
      columnCount: 2,
      columnGap: "1.5rem",
      marginTop: "1rem",
      fontSize: "0.95rem",
      lineHeight: 1.55,
      textAlign: "justify",
    },
    asideCard: {
      borderTop: `2px solid ${p.rule}`,
      paddingTop: "0.85rem",
    },
    asideTitle: {
      fontSize: "0.65rem",
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      marginBottom: "0.85rem",
    },
    headlineList: { listStyle: "none", margin: 0, padding: 0 },
    headline: {
      borderBottom: `1px solid ${p.rule}`,
      padding: "0.65rem 0",
      fontSize: "0.95rem",
      lineHeight: 1.3,
      cursor: "pointer",
    },
    headlineKicker: {
      fontSize: "0.6rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: p.muted,
      marginBottom: "0.15rem",
    },
    subscribeBox: {
      marginTop: "1.5rem",
      border: `2px solid ${p.rule}`,
      padding: "0.85rem",
    },
    subTitle: {
      fontSize: "0.7rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      marginBottom: "0.5rem",
    },
    subInput: {
      width: "100%",
      padding: "0.55rem 0.7rem",
      border: `1px solid ${p.rule}`,
      fontFamily: "inherit",
      fontSize: "0.85rem",
      outline: "none",
    },
    subBtn: {
      width: "100%",
      marginTop: "0.5rem",
      background: p.badge,
      color: p.badgeText,
      border: "none",
      padding: "0.6rem",
      fontFamily: "inherit",
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      fontSize: "0.7rem",
      cursor: "pointer",
    },
    badge: {
      display: "inline-block",
      background: p.badge,
      color: p.badgeText,
      padding: "0.15rem 0.45rem",
      fontSize: "0.6rem",
      fontWeight: 700,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      marginRight: "0.4rem",
    },
  };

  const headlines = [
    { kicker: "Local", title: "Five themes added to the morning index" },
    { kicker: "Markets", title: "Brutalist makes a quiet comeback in dashboards" },
    { kicker: "Tech", title: "Iframe pooling vs lazy mount, settled" },
    { kicker: "Style", title: "Newspaper layouts return to product UIs" },
  ];

  return (
    <main id="app" style={c.page}>
      <div style={c.container}>
        <div style={c.masthead}>
          <span style={c.edition}>Vol. I · No. 06 · vibes.diy</span>
          <span style={c.edition}>{new Date().toUTCString().slice(0, 16)}</span>
        </div>
        <h1 style={c.nameplate}>The Broadsheet</h1>
        <div style={c.tagline}>"All the themes that fit, in print"</div>

        <div style={c.columns}>
          <article>
            <div style={c.leadKicker}>
              <span style={c.badge}>Feature</span>Today
            </div>
            <h2 style={c.leadHeadline}>A Theme System Returns to its Roots: Print, Paper, Patience</h2>
            <div style={c.leadBody}>
              <p>
                The broadsheet layout, long thought retired in favor of feed-shaped product surfaces, has reasserted itself in the
                latest crop of design systems. Editors found that hairline rules, justified columns, and centered nameplates
                produced an unmistakable air of authority that pill-shaped buttons simply could not.
              </p>
              <p>
                "Readers spent measurably longer on the page," reported one product team, "and they were noticeably calmer about
                it." Few had expected such a result; fewer still had budget to redesign for it.
              </p>
              <p>
                Whether the trend will outlast the present news cycle is a matter of some debate. Subscriptions are nonetheless
                brisk.
              </p>
            </div>
          </article>

          <aside>
            <div style={c.asideCard}>
              <div style={c.asideTitle}>Inside</div>
              <ul style={c.headlineList}>
                {headlines.map((h, i) => (
                  <li key={i} style={c.headline}>
                    <div style={c.headlineKicker}>{h.kicker}</div>
                    {h.title}
                  </li>
                ))}
              </ul>
            </div>
            <div style={c.subscribeBox}>
              <div style={c.subTitle}>Subscribe</div>
              <input
                style={c.subInput}
                placeholder="email@daily.example"
                value={subscribe}
                onChange={(e) => setSubscribe(e.target.value)}
              />
              <button type="button" style={c.subBtn}>
                Deliver Daily
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
