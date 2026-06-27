import React, { useRef, useState, useCallback, useEffect } from "react";

// ── Bloom Machine ───────────────────────────────────────────────────────────
// The music starter for the Instant Starter Stack. A 4×4 grid of pads, each tied
// to a musical tone. Hold a pad: it sounds the note (sustained until release) and
// lights up in that note's own colour. The first touch starts an 8-step loop and
// records the tone — quantized to the nearest beat, with the held duration — so
// it replays (sounding the note and lighting its pad) each time the playhead
// comes back around. Pure Web Audio + local state — no login, no backend, no DB.

// One row per pitch (top = highest). Each note owns a distinct colour.
const NOTES = [
  { name: "C5", freq: 523.25, color: "#f472b6", glow: "#ec4899" }, // pink
  { name: "A4", freq: 440.0, color: "#fbbf24", glow: "#f59e0b" }, // amber
  { name: "G4", freq: 392.0, color: "#34d399", glow: "#10b981" }, // emerald
  { name: "E4", freq: 329.63, color: "#60a5fa", glow: "#3b82f6" }, // blue
];

// One waveform per column, left → right. Sine/triangle carry less harmonic
// energy than saw/square, so they read quieter at equal amplitude — boost the
// left two by 4×. Peak is clamped to 1.0 (the limiter bus catches the rest).
const BASE_GAIN = 0.22;
const WAVES = [
  { type: "sine", gain: 4 },
  { type: "triangle", gain: 4 },
  { type: "sawtooth", gain: 1 },
  { type: "square", gain: 1 },
];
const COLS = WAVES.length;

// 8-step loop, one dot (step) per beat at 100 BPM.
const STEPS = 8;
const BPM = 100;
const STEP_MS = 60_000 / BPM;

// Distinct colours in a step's recorded tones, in first-seen order (a colour
// repeated by multiple tones is counted once).
function distinctColors(tones) {
  const seen = new Set();
  const out = [];
  for (const t of tones) {
    if (!seen.has(t.color)) {
      seen.add(t.color);
      out.push(t.color);
    }
  }
  return out;
}

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

export default function BloomMachine() {
  const [lit, setLit] = useState({}); // "r-c" → true while a pad is held
  const [flash, setFlash] = useState({}); // "r-c" → true while a recorded note replays
  const [pressed, setPressed] = useState(false); // play button touch feedback
  const [running, setRunning] = useState(false); // loop transport state
  const [step, setStep] = useState(-1); // playhead position for the dots
  const [stepColors, setStepColors] = useState(() => Array.from({ length: STEPS }, () => []));

  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const voicesRef = useRef({}); // "r-c" → held live voice (+ its open record)
  const patternRef = useRef(Array.from({ length: STEPS }, () => [])); // recorded tones per step
  const stepRef = useRef(-1);
  const stepStartRef = useRef(0); // wall-clock time the current step began (for quantize)
  const runningRef = useRef(false);
  const timerRef = useRef(null);

  // Lazily create the AudioContext + a limiter bus on first touch (autoplay policy).
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
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // Live, sustained note — rings until the pad is released.
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
      voicesRef.current[key] = { env, oscs, gains, rec: null, pressStart: performance.now() };
    },
    [ensureCtx]
  );

  const release = useCallback((key) => {
    const v = voicesRef.current[key];
    if (!v) return;
    delete voicesRef.current[key];
    // Record the held duration onto the open record (same object lives in the pattern).
    if (v.rec) v.rec.dur = Math.max(0.08, (performance.now() - v.pressStart) / 1000);
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

  // Replay a recorded tone for its captured duration (attack → sustain → release).
  const playRecorded = useCallback(
    (rec) => {
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const peak = Math.min(BASE_GAIN * rec.wave.gain, 1);
      const dur = rec.dur;
      const { env, oscs, gains } = buildVoice(ctx, rec.wave, rec.freq);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.01);
      env.gain.setValueAtTime(peak, t + Math.max(0.02, dur - 0.08));
      env.gain.linearRampToValueAtTime(0.0001, t + dur);
      env.connect(masterRef.current);
      oscs.forEach((o) => {
        o.start(t);
        o.stop(t + dur + 0.03);
      });
      oscs[0].onended = () => {
        oscs.forEach((o) => o.disconnect());
        gains.forEach((g) => g.disconnect());
        env.disconnect();
      };
    },
    [ensureCtx]
  );

  // Sound every recorded tone at step i and light its pad for the note's duration.
  const playStep = useCallback(
    (i) => {
      patternRef.current[i].forEach((rec) => {
        playRecorded(rec);
        const key = `${rec.r}-${rec.c}`;
        setFlash((p) => ({ ...p, [key]: true }));
        setTimeout(() => setFlash((p) => ({ ...p, [key]: false })), Math.max(120, rec.dur * 1000));
      });
    },
    [playRecorded]
  );

  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    ensureCtx();
    runningRef.current = true;
    setRunning(true);
    stepRef.current = 0;
    stepStartRef.current = performance.now();
    setStep(0);
    playStep(0);
    timerRef.current = setInterval(() => {
      stepRef.current = (stepRef.current + 1) % STEPS;
      stepStartRef.current = performance.now();
      setStep(stepRef.current);
      playStep(stepRef.current);
    }, STEP_MS);
  }, [ensureCtx, playStep]);

  // Pause is really stop: clear the playhead so the next play restarts at zero.
  // The recorded pattern is kept, so those tones still play on the next run.
  const stopLoop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stepRef.current = -1;
    setStep(-1);
  }, []);

  const toggleTransport = useCallback(() => {
    if (runningRef.current) stopLoop();
    else startLoop();
  }, [startLoop, stopLoop]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  const onPadDown = (e, r, c, note) => {
    e.currentTarget.setPointerCapture?.(e.pointerId); // keep events if the finger slides off
    const key = `${r}-${c}`;
    const wave = WAVES[c];
    press(key, note.freq, wave);
    setLit((p) => ({ ...p, [key]: true }));

    // First touch starts the loop at step 0; otherwise quantize the record
    // position to the nearest beat (round up past the half-step boundary).
    let at;
    if (!runningRef.current) {
      startLoop();
      at = 0;
    } else {
      const elapsed = performance.now() - stepStartRef.current;
      at = elapsed > STEP_MS / 2 ? (stepRef.current + 1) % STEPS : stepRef.current;
    }

    const rec = { freq: note.freq, wave, r, c, color: note.color, dur: 0.5 };
    patternRef.current[at].push(rec);
    const v = voicesRef.current[key];
    if (v) v.rec = rec; // release() fills in dur
    setStepColors((prev) => {
      const next = prev.slice();
      next[at] = distinctColors(patternRef.current[at]);
      return next;
    });
  };

  const onPadUp = (r, c) => {
    const key = `${r}-${c}`;
    release(key);
    setLit((p) => ({ ...p, [key]: false }));
  };

  const playActive = running || pressed;

  return (
    <div style={styles.screen}>
      <div style={styles.frame}>
        <div style={styles.grid}>
          {NOTES.map((note, r) =>
            Array.from({ length: COLS }).map((_, c) => {
              const key = `${r}-${c}`;
              const on = lit[key] || flash[key];
              return (
                <button
                  key={key}
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

        {/* Playhead — 8 dots. Each glows the distinct colour(s) recorded on it,
            sliced like a pie when there's more than one; the active step pulses. */}
        <div style={styles.dots}>
          {Array.from({ length: STEPS }).map((_, i) => {
            const cols = stepColors[i] || [];
            const active = step === i;
            let background = "rgba(255,255,255,0.18)";
            if (cols.length === 1) {
              background = cols[0];
            } else if (cols.length > 1) {
              const slice = 360 / cols.length;
              background = `conic-gradient(${cols.map((col, k) => `${col} ${k * slice}deg ${(k + 1) * slice}deg`).join(", ")})`;
            }
            return (
              <span
                key={i}
                style={{
                  ...styles.dot,
                  background,
                  boxShadow: active ? "0 0 10px 2px rgba(233,231,255,0.85)" : "none",
                  transform: active ? "scale(1.4)" : "scale(1)",
                }}
              />
            );
          })}
        </div>

        {/* Play / stop — circular, pad-sized. Pressed visual on touch-start;
            the transport toggles on touch-end. */}
        <div style={styles.controls}>
          <button
            type="button"
            aria-label={running ? "stop" : "play"}
            aria-pressed={running}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setPressed(true);
            }}
            onPointerUp={() => {
              setPressed(false);
              toggleTransport();
            }}
            onPointerCancel={() => setPressed(false)}
            onLostPointerCapture={() => setPressed(false)}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              ...styles.transport,
              background: playActive ? "#e9e7ff" : "rgba(255,255,255,0.07)",
              color: playActive ? "#1e1b4b" : "#e9e7ff",
              borderColor: playActive ? "#e9e7ff" : "rgba(255,255,255,0.14)",
              boxShadow: running ? "0 0 22px 4px rgba(233,231,255,0.45)" : "none",
              transform: pressed ? "scale(0.94)" : "scale(1)",
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{running ? "❚❚" : "▶"}</span>
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
  dots: { display: "flex", justifyContent: "center", gap: 12, margin: "18px 0" },
  dot: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.18)",
    transition: "box-shadow 80ms ease, transform 80ms ease",
  },
  controls: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
  transport: {
    aspectRatio: "1 / 1",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.14)",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 120ms ease, box-shadow 120ms ease, color 120ms ease, transform 90ms ease",
    WebkitTapHighlightColor: "transparent",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
};
