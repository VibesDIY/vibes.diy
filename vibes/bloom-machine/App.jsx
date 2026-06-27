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

// One waveform per column, left → right. Sine/triangle carry less harmonic
// energy than saw/square, so they read quieter at equal amplitude — boost the
// left two by 2×. Base peak is 0.22, so 2× = 0.44, still within headroom; if a
// louder base ever pushes the boosted notes past ~1.0, drop the right two
// (gain < 1) rather than letting them clip.
const BASE_GAIN = 0.22;
const WAVES = [
  { type: "sine", gain: 4 },
  { type: "triangle", gain: 4 },
  { type: "sawtooth", gain: 1 },
  { type: "square", gain: 1 },
];
const COLS = WAVES.length;

export default function BloomMachine() {
  const [lit, setLit] = useState({}); // "r-c" → true while blooming
  const [playing, setPlaying] = useState(false); // play/pause toggle (visual only for now)
  const ctxRef = useRef(null);

  // Lazily create the AudioContext on the first tap (autoplay policy).
  const playNote = useCallback((freq, wave) => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    const dur = 0.9;

    const peak = Math.min(BASE_GAIN * wave.gain, 1);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = wave.type;
    osc.frequency.value = freq;
    osc.connect(env);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    // Tear down the graph once the note finishes so repeated taps don't
    // accumulate silent, still-connected nodes on the AudioContext.
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }, []);

  const tap = (r, c, note) => {
    playNote(note.freq, WAVES[c]);
    const key = `${r}-${c}`;
    setLit((p) => ({ ...p, [key]: true }));
    setTimeout(() => setLit((p) => ({ ...p, [key]: false })), 260);
  };

  return (
    <div style={styles.screen}>
      <div style={styles.frame}>
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
            })
          )}
        </div>
        {/* Play/pause indicator — circular, pad-sized. Visual only for now. */}
        <div style={styles.controls}>
          <button
            type="button"
            aria-label={playing ? "pause" : "play"}
            aria-pressed={playing}
            onClick={() => setPlaying((p) => !p)}
            style={{
              ...styles.transport,
              background: playing ? "#e9e7ff" : "rgba(255,255,255,0.07)",
              color: playing ? "#1e1b4b" : "#e9e7ff",
              borderColor: playing ? "#e9e7ff" : "rgba(255,255,255,0.14)",
              boxShadow: playing ? "0 0 22px 4px rgba(233,231,255,0.45)" : "none",
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{playing ? "❚❚" : "▶"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  screen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 45%,#4c1d95 100%)",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: 20,
    boxSizing: "border-box",
  },
  frame: { width: "100%", maxWidth: 360, color: "#e9e7ff" },
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
  controls: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 12 },
  transport: {
    aspectRatio: "1 / 1",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.14)",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 120ms ease, box-shadow 120ms ease, color 120ms ease",
    WebkitTapHighlightColor: "transparent",
  },
};
