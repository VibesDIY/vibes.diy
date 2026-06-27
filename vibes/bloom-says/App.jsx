import React, { useRef, useState, useCallback, useEffect } from "react";

// ── Bloom Says ───────────────────────────────────────────────────────────────
// A Simon-says memory game on the Bloom grid (fork of system/bloom-machine).
// The grid plays a sequence — each pad beeps and flashes in its own colour — and
// you copy it. Get it right and the sequence grows by one; miss and it buzzes and
// starts over. Pure Web Audio + local state — no login, no backend, no DB.

// One row per pitch (top = highest); each note owns a distinct colour.
const NOTES = [
  { name: "C5", freq: 523.25, color: "#f472b6", glow: "#ec4899" }, // pink
  { name: "A4", freq: 440.0, color: "#fbbf24", glow: "#f59e0b" }, // amber
  { name: "G4", freq: 392.0, color: "#34d399", glow: "#10b981" }, // emerald
  { name: "E4", freq: 329.63, color: "#60a5fa", glow: "#3b82f6" }, // blue
];

// One waveform per column, left → right; left two boosted to match loudness.
const BASE_GAIN = 0.22;
const WAVES = [
  { type: "sine", gain: 4 },
  { type: "triangle", gain: 4 },
  { type: "sawtooth", gain: 1 },
  { type: "square", gain: 1 },
];
const COLS = WAVES.length;
const PADS = NOTES.length * COLS; // 16

const SHOW_MS = 420; // how long each pad beeps/flashes during playback
const GAP_MS = 200; // silence between steps
const START_DELAY = 550; // pause before a sequence plays
const padOf = (i) => ({ r: Math.floor(i / COLS), c: i % COLS });

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

export default function BloomSays() {
  const [lit, setLit] = useState({}); // index → true while a pad flashes
  const [sequence, setSequence] = useState([]); // pad indices to repeat
  const [phase, setPhase] = useState("idle"); // idle | watch | repeat | fail
  const [failFlash, setFailFlash] = useState(false);

  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const seqRef = useRef([]);
  const inputRef = useRef(0); // how many correct taps so far this turn
  const phaseRef = useRef("idle");
  const genRef = useRef(0); // bumps to cancel in-flight playback
  const timersRef = useRef([]);

  const setPhaseBoth = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const sleep = (ms) =>
    new Promise((res) => {
      timersRef.current.push(setTimeout(res, ms));
    });

  // Lazily create the AudioContext + master gain.
  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.3;
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

  const playTone = useCallback(
    (freq, wave, dur) => {
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const peak = Math.min(BASE_GAIN * wave.gain, 1);
      const { env, oscs, gains } = buildVoice(ctx, wave, freq);
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

  // A low dissonant buzz for a wrong answer.
  const playBuzz = useCallback(() => {
    const ctx = ensureCtx();
    const t = ctx.currentTime;
    const dur = 0.6;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.3, t + 0.01);
    env.gain.setValueAtTime(0.3, t + dur - 0.1);
    env.gain.linearRampToValueAtTime(0.0001, t + dur);
    env.connect(masterRef.current);
    const oscs = [110, 116.5].map((freq) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.connect(env);
      o.start(t);
      o.stop(t + dur + 0.03);
      return o;
    });
    oscs[0].onended = () => {
      oscs.forEach((o) => o.disconnect());
      env.disconnect();
    };
  }, [ensureCtx]);

  const flashBeep = useCallback(
    async (idx, dur) => {
      const { r, c } = padOf(idx);
      playTone(NOTES[r].freq, WAVES[c], dur / 1000);
      setLit((p) => ({ ...p, [idx]: true }));
      await sleep(dur);
      setLit((p) => ({ ...p, [idx]: false }));
    },
    [playTone]
  );

  // Play the whole sequence, then hand control to the player.
  const playSequence = useCallback(
    async (seq) => {
      const myGen = genRef.current;
      setPhaseBoth("watch");
      await sleep(START_DELAY);
      for (const idx of seq) {
        if (genRef.current !== myGen) return; // cancelled (restart/unmount)
        await flashBeep(idx, SHOW_MS);
        await sleep(GAP_MS);
      }
      if (genRef.current !== myGen) return;
      inputRef.current = 0;
      setPhaseBoth("repeat");
    },
    [flashBeep]
  );

  const beginGame = useCallback(() => {
    genRef.current += 1;
    const seq = [Math.floor(Math.random() * PADS)];
    seqRef.current = seq;
    setSequence(seq);
    inputRef.current = 0;
    playSequence(seq);
  }, [playSequence]);

  const extend = useCallback(() => {
    genRef.current += 1;
    const seq = [...seqRef.current, Math.floor(Math.random() * PADS)];
    seqRef.current = seq;
    setSequence(seq);
    playSequence(seq);
  }, [playSequence]);

  const fail = useCallback(() => {
    genRef.current += 1; // cancel any in-flight playback
    setPhaseBoth("fail");
    setFailFlash(true);
    playBuzz();
    timersRef.current.push(setTimeout(() => setFailFlash(false), 500));
    timersRef.current.push(setTimeout(() => beginGame(), 1200));
  }, [playBuzz, beginGame]);

  const startGame = () => {
    unlockAudio();
    beginGame();
  };

  const onPadDown = (idx) => {
    unlockAudio();
    if (phaseRef.current !== "repeat") return;
    const expected = seqRef.current[inputRef.current];
    if (idx !== expected) {
      fail();
      return;
    }
    flashBeep(idx, 300);
    inputRef.current += 1;
    if (inputRef.current === seqRef.current.length) {
      setPhaseBoth("watch"); // lock input while we extend + replay
      timersRef.current.push(setTimeout(() => extend(), 700));
    }
  };

  useEffect(
    () => () => {
      genRef.current += 1;
      timersRef.current.forEach(clearTimeout);
    },
    []
  );

  const status =
    phase === "idle"
      ? "Tap a pad — watch, then repeat"
      : phase === "watch"
        ? "Watch…"
        : phase === "repeat"
          ? "Your turn"
          : "Miss! Starting over…";

  return (
    <div style={styles.screen}>
      <div style={styles.frame}>
        <header style={styles.header}>
          <h1 style={styles.title}>Bloom Says</h1>
          <p style={styles.status}>{status}</p>
        </header>

        <div style={{ ...styles.grid, opacity: phase === "watch" || phase === "fail" ? 0.9 : 1 }}>
          {Array.from({ length: PADS }).map((_, idx) => {
            const { r } = padOf(idx);
            const note = NOTES[r];
            const on = lit[idx];
            return (
              <button
                key={idx}
                type="button"
                aria-label={`pad ${idx + 1}`}
                onPointerDown={() => onPadDown(idx)}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  ...styles.pad,
                  background: on ? note.color : failFlash ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)",
                  borderColor: on ? `${note.color}aa` : failFlash ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.14)",
                  boxShadow: on ? `0 0 22px 4px ${note.glow}, inset 0 0 12px ${note.color}` : "none",
                  transform: on ? "scale(1.08)" : "scale(1)",
                }}
              />
            );
          })}
        </div>

        <div style={styles.footer}>
          {phase === "idle" ? (
            <button type="button" onClick={startGame} style={styles.startBtn}>
              ▶ Start
            </button>
          ) : (
            <span style={styles.level}>Level {sequence.length}</span>
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
  status: { opacity: 0.7, fontSize: 13, margin: "4px 0 0", minHeight: 16 },
  grid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, transition: "opacity 150ms ease" },
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
  footer: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 48, marginTop: 18 },
  startBtn: {
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 700,
    color: "#1e1b4b",
    background: "#e9e7ff",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  level: { fontSize: 14, fontWeight: 600, opacity: 0.85, fontVariantNumeric: "tabular-nums" },
};
