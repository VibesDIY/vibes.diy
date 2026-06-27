import React, { useRef, useState, useCallback } from "react";

// ── Bloom ────────────────────────────────────────────────────────────────────
// The root music starter: just a 4×4 grid of tones you can play. Each row is a
// pitch, each column a waveform; hold a pad to sound its note (sustained until
// release) and light it up in that note's colour. Pure Web Audio + local state —
// no login, no backend, no DB. This is the evolutionary root the curated tree
// grows from: "Add a pattern sequencer" → bloom-machine, "Make it a memory game"
// → bloom-says.

// One row per pitch (top = highest); each note owns a distinct colour.
const NOTES = [
  { name: "C5", freq: 523.25, color: "#f472b6", glow: "#ec4899" }, // pink
  { name: "A4", freq: 440.0, color: "#fbbf24", glow: "#f59e0b" }, // amber
  { name: "G4", freq: 392.0, color: "#34d399", glow: "#10b981" }, // emerald
  { name: "E4", freq: 329.63, color: "#60a5fa", glow: "#3b82f6" }, // blue
];

// One waveform per column, left → right; the left two are boosted so the four
// columns sit at a similar loudness despite their harmonic content.
const BASE_GAIN = 0.22;
const WAVES = [
  { type: "sine", gain: 4 },
  { type: "triangle", gain: 4 },
  { type: "sawtooth", gain: 1 },
  { type: "square", gain: 1 },
];
const COLS = WAVES.length;

// Build an oscillator voice feeding a shared envelope gain. The pure sine reads
// quiet, so it gets an octave-up sine partial at 2/3 amplitude for presence.
function buildVoice(ctx, wave, freq) {
  const env = ctx.createGain();
  const oscs = [];
  const gains = [];
  const main = ctx.createOscillator();
  main.type = wave.type;
  main.frequency.value = freq;
  main.connect(env);
  oscs.push(main);
  if (wave.type === "sine") {
    const partial = ctx.createGain();
    partial.gain.value = 2 / 3;
    partial.connect(env);
    gains.push(partial);
    const oct = ctx.createOscillator();
    oct.type = "sine";
    oct.frequency.value = freq * 2;
    oct.connect(partial);
    oscs.push(oct);
  }
  return { env, oscs, gains };
}

export default function Bloom() {
  const [lit, setLit] = useState({}); // "r-c" → true while a pad is held
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const voicesRef = useRef({}); // "r-c" → held voice

  // Lazily create the AudioContext + a limiter bus (so held chords don't clip).
  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -6;
      master.ratio.value = 12;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    if (ctxRef.current.state !== "running") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // iOS Safari: unlock synchronously inside the gesture — resume AND start one
  // real (silent) sound here; re-check state every gesture (suspends on lock).
  const unlockAudio = useCallback(() => {
    const ctx = ensureCtx();
    if (ctx.state !== "running") {
      ctx.resume();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    }
    return ctx;
  }, [ensureCtx]);

  const press = useCallback(
    (key, freq, wave) => {
      if (voicesRef.current[key]) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const peak = Math.min(BASE_GAIN * wave.gain, 1);
      const { env, oscs, gains } = buildVoice(ctx, wave, freq);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.01); // attack, then sustain
      env.connect(masterRef.current);
      oscs.forEach((o) => o.start(t));
      voicesRef.current[key] = { env, oscs, gains };
    },
    [ensureCtx]
  );

  const release = useCallback((key) => {
    const v = voicesRef.current[key];
    if (!v) return;
    delete voicesRef.current[key];
    const ctx = ctxRef.current;
    const t = ctx.currentTime;
    const rel = 0.18;
    v.env.gain.cancelScheduledValues(t);
    v.env.gain.setValueAtTime(v.env.gain.value, t);
    v.env.gain.linearRampToValueAtTime(0.0001, t + rel);
    v.oscs.forEach((o) => o.stop(t + rel + 0.03));
    v.oscs[0].onended = () => {
      v.oscs.forEach((o) => o.disconnect());
      v.gains.forEach((g) => g.disconnect());
      v.env.disconnect();
    };
  }, []);

  const onPadDown = (e, key, note, wave) => {
    unlockAudio(); // synchronous, inside pointerdown
    e.currentTarget.setPointerCapture?.(e.pointerId); // keep events if the finger slides off
    press(key, note.freq, wave);
    setLit((p) => ({ ...p, [key]: true }));
  };

  const onPadUp = (key) => {
    release(key);
    setLit((p) => ({ ...p, [key]: false }));
  };

  return (
    <div style={styles.screen}>
      <div style={styles.frame}>
        <header style={styles.header}>
          <h1 style={styles.title}>Bloom</h1>
          <p style={styles.subtitle}>hold the pads to play</p>
        </header>
        <div style={styles.grid}>
          {NOTES.map((note, r) =>
            Array.from({ length: COLS }).map((_, c) => {
              const key = `${r}-${c}`;
              const on = lit[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${note.name} pad`}
                  onPointerDown={(e) => onPadDown(e, key, note, WAVES[c])}
                  onPointerUp={() => onPadUp(key)}
                  onPointerCancel={() => onPadUp(key)}
                  onLostPointerCapture={() => onPadUp(key)}
                  onContextMenu={(e) => e.preventDefault()}
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
    userSelect: "none",
    WebkitUserSelect: "none",
    MozUserSelect: "none",
    msUserSelect: "none",
    WebkitTouchCallout: "none",
  },
  frame: { width: "100%", maxWidth: 360, color: "#e9e7ff" },
  header: { marginBottom: 16 },
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
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
};
