import React, { useRef, useState, useCallback } from "react";

// ── Bloom Machine ───────────────────────────────────────────────────────────
// The music starter for the Instant Starter Stack. A 4×4 grid of pads, each tied
// to a musical tone. Hold a pad: it sounds the note (sustained until release)
// and lights up in that note's own contrasting colour. Pure Web Audio — no
// login, no backend, instant.

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
  const [lit, setLit] = useState({}); // "r-c" → true while a pad is held
  const [pressed, setPressed] = useState(false); // play/pause button held-down visual
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const voicesRef = useRef({}); // "r-c" → { osc, env } for currently-held notes

  // Lazily create the AudioContext + a limiter bus on first touch (autoplay policy).
  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      // Soft limiter so holding several pads at once doesn't clip harshly.
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -6;
      master.ratio.value = 12;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // Press a pad: start a sustained note that rings until the pad is released.
  const press = useCallback(
    (key, freq, wave) => {
      if (voicesRef.current[key]) return; // already held
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const peak = Math.min(BASE_GAIN * wave.gain, 1);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.01); // attack, then sustain

      const osc = ctx.createOscillator();
      osc.type = wave.type;
      osc.frequency.value = freq;
      osc.connect(env);
      env.connect(masterRef.current);
      osc.start(t);

      voicesRef.current[key] = { osc, env };
    },
    [ensureCtx]
  );

  // Release a pad: fade the note out, then tear down its graph.
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
    v.osc.stop(t + rel + 0.03);
    v.osc.onended = () => {
      v.osc.disconnect();
      v.env.disconnect();
    };
  }, []);

  const onPadDown = (e, r, c, note) => {
    e.currentTarget.setPointerCapture?.(e.pointerId); // keep events if the finger slides off
    const key = `${r}-${c}`;
    press(key, note.freq, WAVES[c]);
    setLit((p) => ({ ...p, [key]: true }));
  };

  const onPadUp = (r, c) => {
    const key = `${r}-${c}`;
    release(key);
    setLit((p) => ({ ...p, [key]: false }));
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
                  onPointerDown={(e) => onPadDown(e, r, c, note)}
                  onPointerUp={() => onPadUp(r, c)}
                  onPointerCancel={() => onPadUp(r, c)}
                  onLostPointerCapture={() => onPadUp(r, c)}
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
        {/* Play/pause indicator — circular, pad-sized. Shows a pressed/active
            visual on touch-start; the actual play/pause effect will be wired
            from touch-end later. */}
        <div style={styles.controls}>
          <button
            type="button"
            aria-label="play / pause"
            aria-pressed={pressed}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setPressed(true);
            }}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            onLostPointerCapture={() => setPressed(false)}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              ...styles.transport,
              background: pressed ? "#e9e7ff" : "rgba(255,255,255,0.07)",
              color: pressed ? "#1e1b4b" : "#e9e7ff",
              borderColor: pressed ? "#e9e7ff" : "rgba(255,255,255,0.14)",
              boxShadow: pressed ? "0 0 22px 4px rgba(233,231,255,0.45)" : "none",
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{pressed ? "❚❚" : "▶"}</span>
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
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
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
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
};
