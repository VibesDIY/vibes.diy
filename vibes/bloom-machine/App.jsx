import React, { useRef, useState, useCallback, useEffect } from "react";
import { useFireproof } from "use-vibes";

// ── Bloom Machine ───────────────────────────────────────────────────────────
// The music starter for the Instant Starter Stack. A 4×4 grid of pads, each tied
// to a musical tone. Hold a pad to sound its note (sustained until release); the
// note records — quantized to the nearest step, with the held duration — into the
// active pattern. Patterns are a list of rows (play · 16-step playhead · save/
// delete); one plays at a time. Pure Web Audio + local state — no DB, no backend.

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

// 16-step loop, two steps per beat (eighth notes). BPM is global and live.
const STEPS = 16;
const DOT_COLS = 8; // dots laid out as 2 rows of 8
const DEFAULT_BPM = 100;
const MIN_BPM = 40;
const MAX_BPM = 240;
const stepMsFor = (bpm) => 60_000 / bpm / 2;

let nextId = 1;
const emptyPattern = () => ({
  id: nextId++,
  steps: Array.from({ length: STEPS }, () => []),
  saved: false,
  dirty: false,
});
const isEmpty = (p) => p.steps.every((s) => s.length === 0);

// A recorded tone only needs (row, col, dur) persisted — freq/wave/colour derive
// from the row/column. Keeps the stored doc small and reconstructable.
const makeRec = (r, c, dur) => ({
  r,
  c,
  dur,
  freq: NOTES[r].freq,
  wave: WAVES[c],
  color: NOTES[r].color,
});
const serializeSteps = (steps) => steps.map((s) => s.map((rec) => ({ r: rec.r, c: rec.c, dur: rec.dur })));
const hydrateSteps = (steps) =>
  Array.isArray(steps) && steps.length === STEPS
    ? steps.map((s) => (Array.isArray(s) ? s.map((t) => makeRec(t.r, t.c, t.dur ?? 0.3)) : []))
    : Array.from({ length: STEPS }, () => []);

// Distinct colours in a step's recorded tones, first-seen order (a colour
// repeated by multiple tones counts once).
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

// Soft-clip saturation curve. amount 0 → linear (clean); higher → more drive.
function makeSatCurve(amount) {
  const k = amount * 100;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

// One control (0..1) drives the whole FX bus: saturation drive plus two layered
// delays — a slow two-beat one always on, and a fast one-beat one that fades in
// only once the slider passes 1/3 of the way up.
function applyFx(nodes, ctx, fx, bpm) {
  if (!nodes) return;
  const t = ctx.currentTime;
  // Cap the top of the slider at the old 75% mark so cranking it all the way
  // isn't so extreme — the whole range scales down proportionally.
  const a = fx * 0.75;
  nodes.shaper.curve = makeSatCurve(a);

  // slow delay — two beats, always engaged
  nodes.delay.delayTime.setValueAtTime(120 / bpm, t);
  nodes.delaySend.gain.setValueAtTime(a * 0.9, t); // signal piped into the delay
  nodes.delayFb.gain.setValueAtTime(Math.min(0.9, a * 0.85), t); // feedback (< 1)

  // fast delay — one beat (original pace), fades in from 1/3 → full at the top
  const fade = Math.max(0, Math.min(1, (fx - 1 / 3) / (2 / 3)));
  nodes.delay2.delayTime.setValueAtTime(60 / bpm, t);
  nodes.delaySend2.gain.setValueAtTime(a * 0.9 * fade, t);
  nodes.delayFb2.gain.setValueAtTime(Math.min(0.9, a * 0.85) * fade, t);
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
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [fx, setFx] = useState(0.25); // saturation + one-beat delay, 0..1
  const [patterns, setPatterns] = useState(() => [emptyPattern()]);
  const [activeId, setActiveId] = useState(null); // pattern currently playing, or null
  const [step, setStep] = useState(-1); // playhead position for the active row

  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const voicesRef = useRef({}); // "r-c" → held live voice (+ its open record)
  const timerRef = useRef(null);
  const stepRef = useRef(-1);
  const stepStartRef = useRef(0); // wall-clock time the current step began (for quantize)

  // Refs mirror state so the timer/pointer callbacks always read fresh values.
  const patternsRef = useRef(patterns);
  patternsRef.current = patterns;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const stepMsRef = useRef(stepMsFor(bpm));
  stepMsRef.current = stepMsFor(bpm);
  const fxRef = useRef(fx);
  fxRef.current = fx;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const fxNodesRef = useRef(null);

  // Persistence. Auto _id is roughly temporal, so descending = newest first —
  // saved patterns load back in insertion order with no extra sort field.
  const { database, useLiveQuery } = useFireproof("bloom-machine");
  const { docs: savedDocs } = useLiveQuery("_id", { descending: true });

  // Lazily create the AudioContext + a limiter bus on first touch (autoplay policy).
  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();

      // Voices feed `bus`; the FX bus is bus → saturation → limiter → out, with
      // a one-beat delay send tapped off the saturated signal (feedback loop).
      const bus = ctx.createGain();
      const shaper = ctx.createWaveShaper();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.ratio.value = 12;
      // Two layered delays tapped off the saturated signal: a slow one (two
      // beats) always on, and a fast one (one beat) that fades in only past 1/3.
      const delay = ctx.createDelay(4.0); // slow — up to 2 beats even at slowest BPM
      const delaySend = ctx.createGain();
      const delayFb = ctx.createGain();
      const delay2 = ctx.createDelay(2.0); // fast — one beat
      const delaySend2 = ctx.createGain();
      const delayFb2 = ctx.createGain();

      bus.connect(shaper);
      shaper.connect(limiter);
      limiter.connect(ctx.destination);
      // slow delay
      shaper.connect(delaySend);
      delaySend.connect(delay);
      delay.connect(delayFb);
      delayFb.connect(delay); // feedback
      delay.connect(limiter); // wet into the limiter → out
      // fast delay (second layer)
      shaper.connect(delaySend2);
      delaySend2.connect(delay2);
      delay2.connect(delayFb2);
      delayFb2.connect(delay2); // feedback
      delay2.connect(limiter);

      ctxRef.current = ctx;
      masterRef.current = bus; // voices connect to the bus
      fxNodesRef.current = { shaper, delay, delaySend, delayFb, delay2, delaySend2, delayFb2 };
      applyFx(fxNodesRef.current, ctx, fxRef.current, bpmRef.current);
    }
    if (ctxRef.current.state !== "running") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // iOS Safari unlock: must run synchronously inside a trusted gesture
  // (pointerdown/click), resume the context, AND start one real sound right
  // here — a downstream timer/promise/effect does NOT count. Re-checks state on
  // every gesture so audio recovers after the tab is backgrounded/locked.
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
    // Stamp the held duration onto the open record (same object lives in state).
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

  // Sound every recorded tone at step i of pattern `id`, lighting each pad.
  const playStep = useCallback(
    (id, i) => {
      const pat = patternsRef.current.find((p) => p.id === id);
      if (!pat) return;
      pat.steps[i].forEach((rec) => {
        playRecorded(rec);
        const key = `${rec.r}-${rec.c}`;
        setFlash((p) => ({ ...p, [key]: true }));
        setTimeout(() => setFlash((p) => ({ ...p, [key]: false })), Math.max(120, rec.dur * 1000));
      });
    },
    [playRecorded]
  );

  // Advance the playhead; reschedules itself, reading bpm live via stepMsRef.
  const tickRef = useRef(() => {});
  tickRef.current = () => {
    stepRef.current = (stepRef.current + 1) % STEPS;
    stepStartRef.current = performance.now();
    setStep(stepRef.current);
    playStep(activeIdRef.current, stepRef.current);
    timerRef.current = setTimeout(() => tickRef.current(), stepMsRef.current);
  };

  const startLoopOn = useCallback(
    (id) => {
      ensureCtx();
      if (timerRef.current) clearTimeout(timerRef.current);
      activeIdRef.current = id;
      setActiveId(id);
      stepRef.current = 0;
      stepStartRef.current = performance.now();
      setStep(0);
      playStep(id, 0);
      timerRef.current = setTimeout(() => tickRef.current(), stepMsRef.current);
    },
    [ensureCtx, playStep]
  );

  // Pause/stop: clear the playhead. Recorded patterns are kept.
  const stopLoop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    activeIdRef.current = null;
    setActiveId(null);
    stepRef.current = -1;
    setStep(-1);
  }, []);

  // Play on a row stops whatever's playing and starts it from zero (toggle off
  // if it's already the active row).
  const togglePlay = useCallback(
    (id) => {
      unlockAudio(); // synchronous, inside the click — before any branching
      if (activeIdRef.current === id) stopLoop();
      else startLoopOn(id);
    },
    [unlockAudio, startLoopOn, stopLoop]
  );

  const savePattern = async (id) => {
    const pat = patternsRef.current.find((p) => p.id === id);
    if (!pat) return;
    const doc = { type: "pattern", steps: serializeSteps(pat.steps) };
    if (pat.docId) doc._id = pat.docId;
    try {
      const res = await database.put(doc);
      // Saving also does what the old "+" did: if the top row holds something,
      // start a fresh empty row on top and pause, ready for the next pattern.
      const addFresh = !isEmpty(patternsRef.current[0]);
      setPatterns((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, saved: true, dirty: false, docId: p.docId || res.id } : p));
        return addFresh ? [emptyPattern(), ...next] : next;
      });
      // Note: deliberately do NOT stop the transport — whatever's playing keeps
      // playing; the fresh empty row just waits on top.
    } catch (err) {
      // Leave the row in "save" mode so the unsaved edit isn't lost.
      console.error("save failed (sign in to save?)", err);
    }
  };

  const deletePattern = async (id) => {
    const pat = patternsRef.current.find((p) => p.id === id);
    if (id === activeIdRef.current) stopLoop();
    if (pat?.docId) {
      try {
        await database.del(pat.docId);
      } catch (err) {
        console.error("delete failed", err);
      }
    }
    setPatterns((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next.length ? next : [emptyPattern()];
    });
  };

  const bumpBpm = (d) => setBpm((b) => Math.min(MAX_BPM, Math.max(MIN_BPM, b + d)));

  // Tap a dot to clear that step on its row (marks the row dirty).
  const clearStep = (id, i) =>
    setPatterns((prev) =>
      prev.map((p) => (p.id === id ? { ...p, dirty: true, steps: p.steps.map((s, idx) => (idx === i ? [] : s)) } : p))
    );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // Live FX: re-apply when the slider or tempo (one-beat delay time) changes.
  useEffect(() => {
    if (ctxRef.current && fxNodesRef.current) {
      applyFx(fxNodesRef.current, ctxRef.current, fx, bpm);
    }
  }, [fx, bpm]);

  // Hydrate saved patterns from the database as they arrive. Dedupe by docId so a
  // row we just saved isn't re-added; saved rows append below the working rows
  // (savedDocs is newest-first by _id, i.e. insertion order).
  useEffect(() => {
    if (!savedDocs || savedDocs.length === 0) return;
    setPatterns((prev) => {
      const have = new Set(prev.map((p) => p.docId).filter(Boolean));
      const incoming = savedDocs
        .filter((d) => d.type === "pattern" && !have.has(d._id))
        .map((d) => ({ id: nextId++, docId: d._id, steps: hydrateSteps(d.steps), saved: true, dirty: false }));
      return incoming.length ? [...prev, ...incoming] : prev;
    });
  }, [savedDocs]);

  const onPadDown = (e, r, c, note) => {
    unlockAudio(); // synchronous, inside pointerdown — before any state/async work
    e.currentTarget.setPointerCapture?.(e.pointerId); // keep events if the finger slides off
    const key = `${r}-${c}`;
    const wave = WAVES[c];
    press(key, note.freq, wave);
    setLit((p) => ({ ...p, [key]: true }));

    // First touch starts the loop on the top row at step 0; otherwise record onto
    // the active row, quantized to the nearest step.
    let targetId;
    let at;
    if (!timerRef.current) {
      targetId = patternsRef.current[0].id;
      startLoopOn(targetId);
      at = 0;
    } else {
      targetId = activeIdRef.current;
      const elapsed = performance.now() - stepStartRef.current;
      at = elapsed > stepMsRef.current / 2 ? (stepRef.current + 1) % STEPS : stepRef.current;
    }

    const rec = { freq: note.freq, wave, r, c, color: note.color, dur: 0.5 };
    setPatterns((prev) =>
      prev.map((p) =>
        p.id === targetId ? { ...p, dirty: true, steps: p.steps.map((s, idx) => (idx === at ? [...s, rec] : s)) } : p
      )
    );
    const v = voicesRef.current[key];
    if (v) v.rec = rec; // release() fills in dur on the same object
  };

  const onPadUp = (r, c) => {
    const key = `${r}-${c}`;
    release(key);
    setLit((p) => ({ ...p, [key]: false }));
  };

  return (
    <div style={styles.screen}>
      {/* Native number spinners are inconsistent/hidden across browsers; hide
          them and use our own ▲/▼ so the stepper arrows always show. */}
      <style>{`
        .bm-bpm::-webkit-outer-spin-button,
        .bm-bpm::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .bm-bpm { -moz-appearance: textfield; appearance: textfield; }
      `}</style>
      <div style={styles.frame}>
        {/* Global controls — BPM stepper (saving spawns the next empty row). */}
        <div style={styles.topbar}>
          <div style={styles.bpm}>
            <span style={styles.bpmLabel}>BPM</span>
            <input
              type="number"
              className="bm-bpm"
              min={MIN_BPM}
              max={MAX_BPM}
              step={1}
              value={bpm}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v))));
              }}
              style={styles.bpmInput}
            />
            <div style={styles.spin}>
              <button type="button" aria-label="increase bpm" onClick={() => bumpBpm(1)} style={styles.spinBtn}>
                ▲
              </button>
              <button type="button" aria-label="decrease bpm" onClick={() => bumpBpm(-1)} style={styles.spinBtn}>
                ▼
              </button>
            </div>
          </div>
          {/* FX — one slider drives saturation + a one-beat delay (drive, send,
              and feedback all rise together). */}
          <label style={styles.fx}>
            <span style={styles.bpmLabel}>FX</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={fx}
              onChange={(e) => setFx(Number(e.target.value))}
              style={styles.fxSlider}
            />
          </label>
        </div>

        {/* Tone pads. */}
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

        {/* Pattern list — newest/working row on top. */}
        <div style={styles.list}>
          {patterns.map((p) => {
            const isActive = activeId === p.id;
            const saveMode = !p.saved || p.dirty;
            return (
              <div key={p.id} style={styles.row}>
                <button
                  type="button"
                  aria-label={isActive ? "stop" : "play"}
                  onClick={() => togglePlay(p.id)}
                  style={{
                    ...styles.round,
                    background: isActive ? "#e9e7ff" : "rgba(255,255,255,0.07)",
                    color: isActive ? "#1e1b4b" : "#e9e7ff",
                    borderColor: isActive ? "#e9e7ff" : "rgba(255,255,255,0.14)",
                    boxShadow: isActive ? "0 0 16px 3px rgba(233,231,255,0.45)" : "none",
                  }}
                >
                  <span style={{ fontSize: 15, lineHeight: 1 }}>{isActive ? "❚❚" : "▶"}</span>
                </button>

                <div style={styles.dotsWrap}>
                  <div style={styles.dots}>
                    {p.steps.map((tones, i) => {
                      const cols = distinctColors(tones);
                      const active = isActive && step === i;
                      let background = "rgba(255,255,255,0.18)";
                      if (cols.length === 1) {
                        background = cols[0];
                      } else if (cols.length > 1) {
                        const slice = 360 / cols.length;
                        background = `conic-gradient(${cols.map((col, k) => `${col} ${k * slice}deg ${(k + 1) * slice}deg`).join(", ")})`;
                      }
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-label={`clear step ${i + 1}`}
                          onClick={() => clearStep(p.id, i)}
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
                </div>

                <button
                  type="button"
                  aria-label={saveMode ? "save pattern" : "delete pattern"}
                  onClick={() => (saveMode ? savePattern(p.id) : deletePattern(p.id))}
                  style={{
                    ...styles.round,
                    background: saveMode ? "rgba(52,211,153,0.18)" : "rgba(244,114,182,0.14)",
                    color: "#e9e7ff",
                    borderColor: saveMode ? "rgba(52,211,153,0.6)" : "rgba(244,114,182,0.5)",
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{saveMode ? "💾" : "🗑"}</span>
                </button>
              </div>
            );
          })}
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
    // Text selection is never useful here and only gets in the way of tapping
    // and holding pads — disable it for the whole app.
    userSelect: "none",
    WebkitUserSelect: "none",
    MozUserSelect: "none",
    msUserSelect: "none",
    WebkitTouchCallout: "none",
  },
  frame: { width: "100%", maxWidth: 360, color: "#e9e7ff" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  bpm: { display: "flex", alignItems: "center", gap: 8 },
  bpmLabel: { fontSize: 12, opacity: 0.7, letterSpacing: 0.5 },
  bpmInput: {
    width: 48,
    padding: "6px 8px",
    fontSize: 15,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    color: "#e9e7ff",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 10,
  },
  fx: { display: "flex", alignItems: "center", gap: 8 },
  fxSlider: { width: 104, accentColor: "#f472b6", cursor: "pointer" },
  spin: { display: "flex", flexDirection: "column", gap: 2 },
  spinBtn: {
    width: 24,
    height: 17,
    padding: 0,
    fontSize: 9,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#e9e7ff",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 6,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
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
  list: { display: "flex", flexDirection: "column", gap: 14, marginTop: 18 },
  row: { display: "flex", alignItems: "center", gap: 10 },
  dotsWrap: { flex: 1, display: "flex", justifyContent: "center" },
  dots: {
    display: "grid",
    gridTemplateColumns: `repeat(${DOT_COLS}, 17px)`,
    gap: "13px 16px",
    alignContent: "center",
    justifyContent: "center",
  },
  dot: {
    width: 17,
    height: 17,
    borderRadius: "50%",
    border: "none",
    padding: 0,
    cursor: "pointer",
    background: "rgba(255,255,255,0.18)",
    transition: "box-shadow 80ms ease, transform 80ms ease",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  round: {
    width: 45, // 75% of the previous 60px play button
    height: 45,
    flexShrink: 0,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.07)",
    color: "#e9e7ff",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 120ms ease, box-shadow 120ms ease, color 120ms ease, transform 90ms ease",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
};
