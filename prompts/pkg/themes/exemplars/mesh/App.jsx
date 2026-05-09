import React, { useEffect, useState } from "react";

// Theme: Mesh Void — neon-green-on-white modern dashboard.
// Layout: pill nav + KPI tiles + activity table.

export default function App() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=optional";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const [tab, setTab] = useState("Overview");
  const [draft, setDraft] = useState("");

  const p = {
    bg: "#fff",
    panel: "#fafafa",
    text: "#0a0a0a",
    muted: "#6b6b80",
    border: "#e5e5ea",
    accent: "oklch(0.87 0.28 145)",
    accentBg: "oklch(0.95 0.10 145)",
    accentText: "oklch(0.20 0.20 145)",
    danger: "#ef4444",
    dangerBg: "#fee2e2",
  };

  const c = {
    page: {
      minHeight: "100vh",
      background: p.bg,
      color: p.text,
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: "2rem 1.75rem 4rem",
    },
    container: { maxWidth: "64rem", margin: "0 auto" },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "2rem",
    },
    brand: {
      fontSize: "0.75rem",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: p.muted,
    },
    pillNav: {
      display: "inline-flex",
      gap: "0.25rem",
      padding: "0.25rem",
      background: p.panel,
      border: `1px solid ${p.border}`,
      borderRadius: 999,
    },
    pill: (active) => ({
      padding: "0.45rem 0.95rem",
      borderRadius: 999,
      fontSize: "0.85rem",
      fontWeight: 500,
      cursor: "pointer",
      background: active ? p.accent : "transparent",
      color: active ? p.accentText : p.muted,
      border: "none",
      transition: "all 0.15s",
    }),
    title: {
      fontSize: "clamp(3.5rem, 13vw, 10rem)",
      fontWeight: 800,
      letterSpacing: "-0.05em",
      lineHeight: 0.9,
      margin: 0,
    },
    titleAccent: {
      background: `linear-gradient(120deg, ${p.accent} 0%, oklch(0.78 0.22 145) 100%)`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    },
    subtitle: {
      marginTop: "1rem",
      fontSize: "1.05rem",
      color: p.muted,
      maxWidth: "32rem",
      lineHeight: 1.5,
    },
    kpiRow: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
      gap: "0.85rem",
      marginTop: "2rem",
    },
    kpi: {
      background: p.panel,
      border: `1px solid ${p.border}`,
      borderRadius: 14,
      padding: "1rem 1.1rem",
    },
    kpiLabel: {
      fontSize: "0.7rem",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: p.muted,
    },
    kpiValue: {
      fontSize: "1.85rem",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      marginTop: "0.25rem",
    },
    kpiDelta: (positive) => ({
      display: "inline-block",
      marginTop: "0.35rem",
      fontSize: "0.75rem",
      fontWeight: 600,
      padding: "0.1rem 0.45rem",
      borderRadius: 999,
      background: positive ? p.accentBg : p.dangerBg,
      color: positive ? p.accentText : p.danger,
    }),
    section: {
      marginTop: "2rem",
      background: p.panel,
      border: `1px solid ${p.border}`,
      borderRadius: 16,
      overflow: "hidden",
    },
    sectionHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "1rem 1.25rem",
      borderBottom: `1px solid ${p.border}`,
    },
    sectionTitle: { fontSize: "0.95rem", fontWeight: 600 },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left",
      padding: "0.6rem 1.25rem",
      fontSize: "0.7rem",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: p.muted,
      borderBottom: `1px solid ${p.border}`,
      fontWeight: 600,
    },
    td: {
      padding: "0.75rem 1.25rem",
      fontSize: "0.9rem",
      borderBottom: `1px solid ${p.border}`,
    },
    statusOk: {
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: 999,
      background: p.accent,
      marginRight: "0.4rem",
    },
    statusErr: {
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: 999,
      background: p.danger,
      marginRight: "0.4rem",
    },
    composer: {
      padding: "1rem 1.25rem",
      display: "flex",
      gap: "0.5rem",
      alignItems: "center",
      borderTop: `1px solid ${p.border}`,
      background: "#fff",
    },
    input: {
      flex: 1,
      background: "#fff",
      color: p.text,
      border: `1px solid ${p.border}`,
      borderRadius: 999,
      padding: "0.55rem 1rem",
      fontFamily: "inherit",
      fontSize: "0.9rem",
      outline: "none",
    },
    btn: {
      background: p.accent,
      color: p.accentText,
      border: "none",
      borderRadius: 999,
      padding: "0.55rem 1.2rem",
      fontFamily: "inherit",
      fontSize: "0.85rem",
      fontWeight: 600,
      cursor: "pointer",
    },
  };

  const tabs = ["Overview", "Activity", "Mesh", "Settings"];
  const rows = [
    { name: "alpha-node", status: "ok", load: "32%" },
    { name: "beta-node", status: "ok", load: "11%" },
    { name: "gamma-node", status: "err", load: "92%" },
    { name: "delta-node", status: "ok", load: "47%" },
  ];

  return (
    <main id="app" style={c.page}>
      <div style={c.container}>
        <div style={c.topBar}>
          <span style={c.brand}>vibes.diy · theme</span>
          <nav style={c.pillNav}>
            {tabs.map((t) => (
              <button key={t} style={c.pill(t === tab)} onClick={() => setTab(t)} type="button">
                {t}
              </button>
            ))}
          </nav>
        </div>

        <h1 style={c.title}>
          <span style={c.titleAccent}>Mesh</span> Void
        </h1>
        <p style={c.subtitle}>Neon edges over a quiet white canvas. Crisp pills, soft surfaces, sharp data.</p>

        <div style={c.kpiRow}>
          <div style={c.kpi}>
            <div style={c.kpiLabel}>Throughput</div>
            <div style={c.kpiValue}>1.42M/s</div>
            <span style={c.kpiDelta(true)}>+12.4%</span>
          </div>
          <div style={c.kpi}>
            <div style={c.kpiLabel}>Latency p95</div>
            <div style={c.kpiValue}>18ms</div>
            <span style={c.kpiDelta(true)}>-3ms</span>
          </div>
          <div style={c.kpi}>
            <div style={c.kpiLabel}>Errors</div>
            <div style={c.kpiValue}>0.04%</div>
            <span style={c.kpiDelta(false)}>+0.01%</span>
          </div>
          <div style={c.kpi}>
            <div style={c.kpiLabel}>Active nodes</div>
            <div style={c.kpiValue}>128</div>
            <span style={c.kpiDelta(true)}>+4</span>
          </div>
        </div>

        <section style={c.section}>
          <div style={c.sectionHeader}>
            <span style={c.sectionTitle}>Mesh nodes</span>
            <span style={{ ...c.kpiLabel }}>{rows.length} active</span>
          </div>
          <table style={c.table}>
            <thead>
              <tr>
                <th style={c.th}>Node</th>
                <th style={c.th}>Status</th>
                <th style={c.th}>Load</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td style={c.td}>{r.name}</td>
                  <td style={c.td}>
                    <span style={r.status === "ok" ? c.statusOk : c.statusErr} />
                    {r.status === "ok" ? "Healthy" : "Degraded"}
                  </td>
                  <td style={c.td}>{r.load}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={c.composer}>
            <input style={c.input} placeholder="Add a node…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button type="button" style={c.btn}>
              Provision
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
