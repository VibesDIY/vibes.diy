import React, { useEffect, useRef, useState } from "react";

// Theme: Matrix Status — green-on-black terminal, VT323 monospace.
// Layout: full-bleed terminal session with prompt at bottom and a tail.

export default function App() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=VT323&display=optional";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const [cmd, setCmd] = useState("");
  const [tick, setTick] = useState(0);
  const tailRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const p = {
    bg: "#000",
    fg: "oklch(0.79 0.21 152)",
    fgDim: "oklch(0.55 0.15 152)",
    fgBright: "oklch(0.93 0.21 152)",
    cursorBg: "oklch(0.79 0.21 152)",
  };

  const c = {
    page: {
      position: "fixed",
      inset: 0,
      background: p.bg,
      color: p.fg,
      fontFamily: "'VT323', monospace",
      display: "flex",
      flexDirection: "column",
      padding: "2rem 2.5rem",
      gap: "1rem",
      overflow: "hidden",
    },
    bar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${p.fgDim}`,
      paddingBottom: "0.5rem",
      fontSize: "1.1rem",
    },
    title: {
      fontSize: "clamp(3.5rem, 14vw, 11rem)",
      lineHeight: 1,
      margin: "1.5rem 0 0.25rem",
      color: p.fgBright,
      textShadow: "0 0 18px rgba(121, 232, 137, 0.55)",
      letterSpacing: "0.05em",
    },
    sub: { fontSize: "1.2rem", color: p.fgDim, marginBottom: "1rem" },
    log: {
      flex: 1,
      overflow: "auto",
      fontSize: "1.15rem",
      lineHeight: 1.35,
      borderTop: `1px solid ${p.fgDim}`,
      borderBottom: `1px solid ${p.fgDim}`,
      padding: "0.85rem 0",
    },
    promptRow: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      fontSize: "1.2rem",
    },
    input: {
      flex: 1,
      background: "transparent",
      color: p.fgBright,
      border: "none",
      outline: "none",
      fontFamily: "inherit",
      fontSize: "1.2rem",
      caretColor: p.fgBright,
    },
    btn: {
      background: "transparent",
      color: p.fg,
      border: `1px solid ${p.fg}`,
      padding: "0.25rem 0.85rem",
      fontFamily: "inherit",
      fontSize: "1rem",
      cursor: "pointer",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
    },
    cursor: {
      display: "inline-block",
      width: "0.55em",
      height: "1em",
      verticalAlign: "text-bottom",
      background: p.cursorBg,
      animation: "matrix-blink 1s steps(2,end) infinite",
      marginLeft: "2px",
    },
  };

  const lines = [
    "[ok] uplink established",
    "[..] decrypting cluster",
    "[ok] payload-3.2 verified",
    "[!!] anomaly @ sector 7",
    "[ok] telemetry cached",
    "[ok] mesh sync 18ms",
    `[heartbeat] tick=${tick.toString().padStart(4, "0")}`,
  ];

  return (
    <main id="app" style={c.page}>
      <style>{`@keyframes matrix-blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }`}</style>
      <div style={c.bar}>
        <span>vibes.diy ⏵ theme</span>
        <span>OK · {new Date().toUTCString().slice(17, 22)} UTC</span>
      </div>
      <h1 style={c.title}>MATRIX</h1>
      <div style={c.sub}>tail -f /var/log/cluster — ctrl-c to exit</div>

      <div ref={tailRef} style={c.log}>
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>

      <form
        style={c.promptRow}
        onSubmit={(e) => {
          e.preventDefault();
          setCmd("");
        }}
      >
        <span>root@cluster $</span>
        <input style={c.input} value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="" autoFocus />
        <span style={c.cursor} aria-hidden />
        <button type="button" style={c.btn}>
          Run
        </button>
        <button type="button" style={c.btn}>
          Halt
        </button>
      </form>
    </main>
  );
}
