import React, { useRef, useState, useCallback } from "react";

// ── Bloom Machine ───────────────────────────────────────────────────────────
// The music starter for the Instant Starter Stack. A 4×4 grid of pads, each tied
// to a musical tone. Tap a pad: it plays the note and lights up in that note's
// own contrasting colour. Pure Web Audio — no login, no backend, instant.

// One row per pitch (top = highest). Each note owns a distinct colour.
const NOTES = [
  { name: "C5", freq: 523.25, color: "#f472b6", glow: "#ec4899" }, // pink
  { name: "A4", freq: 440.0, color: "#fbbf24", glow: "#f59e0b" }, // amber
  { name: "G4", freq: 392.0, color: "#34d399", glow: "#10b981" }, // emerald
  { name: "E4", freq: 329.63, color: "#60a5fa", glow: "#3b82f6" }, // blue
];

const COLS = 4;

export default function BloomMachine() {
  const [lit, setLit] = useState({}); // "r-c" → true while blooming
  const ctxRef = useRef(null);

  // Lazily create the AudioContext on the first tap (autoplay policy).
  const playNote = useCallback((freq) => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    const dur = 0.9;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    osc.connect(env);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }, []);

  const tap = (r, c, note) => {
    playNote(note.freq);
    const key = `${r}-${c}`;
    setLit((p) => ({ ...p, [key]: true }));
    setTimeout(() => setLit((p) => ({ ...p, [key]: false })), 260);
  };

  return (
    <div style={styles.screen}>
      <div style={styles.frame}>
        <header style={styles.header}>
          <h1 style={styles.title}>Bloom Machine</h1>
          <p style={styles.subtitle}>tap the pads · share the beat</p>
        </header>
        <div style={styles.grid}>
          {NOTES.map((note, r) =>
            Array.from({ length: COLS }).map((_, c) => {
              const on = lit[`${r}-${c}`];
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  aria-label={`${note.name} pad`}
                  onClick={() => tap(r, c, note)}
                  style={{
                    ...styles.pad,
                    background: on ? note.color : "rgba(255,255,255,0.07)",
                    borderColor: on ? `${note.color}aa` : "rgba(255,255,255,0.14)",
                    boxShadow: on ? `0 0 22px 4px ${note.glow}, inset 0 0 12px ${note.color}` : "none",
                    transform: on ? "scale(1.08)" : "scale(1)",
                  }}
                />
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  screen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 45%,#4c1d95 100%)",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: 20,
    boxSizing: "border-box",
  },
  frame: { width: "100%", maxWidth: 360, color: "#e9e7ff" },
  header: { marginBottom: 18 },
  title: { fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.5 },
  subtitle: { opacity: 0.7, fontSize: 13, margin: "4px 0 0" },
  grid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
  pad: {
    aspectRatio: "1 / 1",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    cursor: "pointer",
    padding: 0,
    transition: "transform 90ms ease, background 90ms ease, box-shadow 90ms ease",
    WebkitTapHighlightColor: "transparent",
  },
};
