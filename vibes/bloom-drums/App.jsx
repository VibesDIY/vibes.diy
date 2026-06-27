import React, { useRef, useState, useCallback, useEffect } from "react";
import { useFireproof } from "use-vibes";

// ── Bloom Drums ──────────────────────────────────────────────────────────────
// An evolution of the pattern sequencer (system/bloom-machine) — reached via its
// "make it a drum machine" chip — with the pitched tones swapped for real drum
// voices. A 4×4 grid of pads: each row is a drum (hi-hat / clap / snare / kick),
// each column a brighter/duller variant. Hold a pad to sound it; the hit records
// — quantized to the nearest step — into the active pattern. Patterns are a list
// of rows (play · 16-step playhead · save/delete); one plays at a time.
// Everything else matches bloom-machine. Web Audio + local state — no backend.

// One drum per row (top → bottom): a short, percussive voice (its own amp/pitch
// envelope so it sounds like a real hit, not a sustained noise wash). Each owns a
// colour and a level trim so the kit sits balanced.
const DRUMS = [
  { name: "hat", kind: "hat", color: "#f472b6", glow: "#ec4899", gain: 0.5, cutoff: 9000, decay: 0.05 }, // pink
  { name: "clap", kind: "clap", color: "#fbbf24", glow: "#f59e0b", gain: 1.0, cutoff: 1600, decay: 0.14 }, // amber
  { name: "snare", kind: "snare", color: "#34d399", glow: "#10b981", gain: 1.0, cutoff: 1900, decay: 0.18, body: 190 }, // emerald
  { name: "kick", kind: "kick", color: "#60a5fa", glow: "#3b82f6", gain: 1.6, decay: 0.34, pitch: 150, drop: 48 }, // blue
];

// One variant per column, left → right: shifts brightness (cutoff / kick pitch)
// and trims level, so a row gives four flavours of the same drum. (Same grit
// arrangement as before — only the underlying voices changed.)
const BASE_GAIN = 0.22;
const VARIANTS = [
  { cutoffMul: 0.6, gain: 1.0 },
  { cutoffMul: 0.85, gain: 1.0 },
  { cutoffMul: 1.15, gain: 0.9 },
  { cutoffMul: 1.5, gain: 0.85 },
];
const COLS = VARIANTS.length;

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

// A recorded hit only needs (row, col, dur) persisted — drum/variant/colour
// derive from the row/column. Keeps the stored doc small and reconstructable.
const makeRec = (r, c, dur) => ({ r, c, dur, color: DRUMS[r].color });
const serializeSteps = (steps) => steps.map((s) => s.map((rec) => ({ r: rec.r, c: rec.c, dur: rec.dur })));
const hydrateSteps = (steps) =>
  Array.isArray(steps) && steps.length === STEPS
    ? steps.map((s) => (Array.isArray(s) ? s.map((t) => makeRec(t.r, t.c, t.dur ?? 0.3)) : []))
    : Array.from({ length: STEPS }, () => []);

// Distinct colours in a step's recorded hits, first-seen order (a colour
// repeated by multiple hits counts once).
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

// One control (0..1) drives the whole FX bus: saturation drive, the level sent
// into a one-beat delay, and the delay's feedback all rise together.
function applyFx(nodes, ctx, fx, bpm) {
  if (!nodes) return;
  const t = ctx.currentTime;
  nodes.shaper.curve = makeSatCurve(fx);
  nodes.delay.delayTime.setValueAtTime(60 / bpm, t); // one beat
  nodes.delaySend.gain.setValueAtTime(fx * 0.9, t); // signal piped into the delay
  nodes.delayFb.gain.setValueAtTime(Math.min(0.9, fx * 0.85), t); // feedback (< 1)
}

// Two seconds of white noise, looped — the source for every drum voice.
function makeNoise(ctx) {
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Build a drum voice. Returns the same { env, oscs, gains } shape as before so
// press/release/playRecorded/teardown are unchanged — but inside, each voice has
// its own percussive amp envelope (`shape`) and, for the kick, a pitch drop, so
// it reads as a real drum hit rather than a sustained noise wash. The outer `env`
// (driven by press/playRecorded) just scales the level.
function buildVoice(ctx, noise, drum, variant) {
  const t = ctx.currentTime;
  const env = ctx.createGain();
  const shape = ctx.createGain(); // percussive amp envelope, multiplies into env
  shape.connect(env);
  const oscs = [];
  const gains = [shape];

  // fast attack → exponential decay to ~silence over the drum's decay time
  shape.gain.setValueAtTime(0.0001, t);
  shape.gain.exponentialRampToValueAtTime(1, t + 0.003);
  shape.gain.exponentialRampToValueAtTime(0.0008, t + drum.decay);

  const noiseSrc = (filterType, freq, q) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    src.connect(f).connect(shape);
    oscs.push(src);
    gains.push(f);
  };

  if (drum.kind === "kick") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(drum.pitch * (0.85 + variant.cutoffMul * 0.25), t);
    osc.frequency.exponentialRampToValueAtTime(drum.drop, t + drum.decay * 0.6);
    osc.connect(shape);
    oscs.push(osc);
    // a short noise click for attack
    const click = ctx.createBufferSource();
    click.buffer = noise;
    click.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3000;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.6, t);
    clickGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.02);
    click.connect(hp).connect(clickGain).connect(shape);
    oscs.push(click);
    gains.push(hp, clickGain);
  } else if (drum.kind === "snare") {
    noiseSrc("highpass", drum.cutoff * variant.cutoffMul); // the noise crack
    const body = ctx.createOscillator(); // a bit of tonal body
    body.type = "triangle";
    body.frequency.value = drum.body;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.5;
    body.connect(bodyGain).connect(shape);
    oscs.push(body);
    gains.push(bodyGain);
  } else {
    // hat (highpass) / clap (bandpass) — filtered noise burst
    noiseSrc(
      drum.kind === "hat" ? "highpass" : "bandpass",
      drum.cutoff * variant.cutoffMul,
      drum.kind === "clap" ? 1.2 : undefined
    );
  }

  return { env, oscs, gains };
}

export default function BloomDrums() {
  const [lit, setLit] = useState({}); // "r-c" → true while a pad is held
  const [flash, setFlash] = useState({}); // "r-c" → true while a recorded hit replays
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [fx, setFx] = useState(0.25); // saturation + one-beat delay, 0..1
  const [patterns, setPatterns] = useState(() => [emptyPattern()]);
  const [activeId, setActiveId] = useState(null); // pattern currently playing, or null
  const [step, setStep] = useState(-1); // playhead position for the active row

  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const noiseRef = useRef(null);
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
  const { database, useLiveQuery } = useFireproof("bloom-drums");
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
      const delay = ctx.createDelay(2.0);
      const delaySend = ctx.createGain();
      const delayFb = ctx.createGain();

      bus.connect(shaper);
      shaper.connect(limiter);
      limiter.connect(ctx.destination);
      shaper.connect(delaySend);
      delaySend.connect(delay);
      delay.connect(delayFb);
      delayFb.connect(delay); // feedback
      delay.connect(limiter); // wet into the limiter → out

      ctxRef.current = ctx;
      masterRef.current = bus; // voices connect to the bus
      noiseRef.current = makeNoise(ctx);
      fxNodesRef.current = { shaper, delay, delaySend, delayFb };
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

  // Live, sustained hit — rings until the pad is released.
  const press = useCallback(
    (key, r, c) => {
      if (voicesRef.current[key]) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const peak = Math.min(BASE_GAIN * DRUMS[r].gain * VARIANTS[c].gain, 1);
      const { env, oscs, gains } = buildVoice(ctx, noiseRef.current, DRUMS[r], VARIANTS[c]);
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

  // Replay a recorded hit for its captured duration (attack → sustain → release).
  const playRecorded = useCallback(
    (rec) => {
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const peak = Math.min(BASE_GAIN * DRUMS[rec.r].gain * VARIANTS[rec.c].gain, 1);
      const dur = rec.dur;
      const { env, oscs, gains } = buildVoice(ctx, noiseRef.current, DRUMS[rec.r], VARIANTS[rec.c]);
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

  // Sound every recorded hit at step i of pattern `id`, lighting each pad.
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
      // start a fresh empty row on top, ready for the next pattern.
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

  const onPadDown = (e, r, c, drum) => {
    unlockAudio(); // synchronous, inside pointerdown — before any state/async work
    e.currentTarget.setPointerCapture?.(e.pointerId); // keep events if the finger slides off
    const key = `${r}-${c}`;
    press(key, r, c);
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

    const rec = { r, c, color: drum.color, dur: 0.5 };
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

        {/* Drum pads. */}
        <div style={styles.grid}>
          {DRUMS.map((drum, r) =>
            Array.from({ length: COLS }).map((_, c) => {
              const key = `${r}-${c}`;
              const on = lit[key] || flash[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${drum.name} pad`}
                  onPointerDown={(e) => onPadDown(e, r, c, drum)}
                  onPointerUp={() => onPadUp(r, c)}
                  onPointerCancel={() => onPadUp(r, c)}
                  onLostPointerCapture={() => onPadUp(r, c)}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    ...styles.pad,
                    background: on ? drum.color : "rgba(255,255,255,0.07)",
                    borderColor: on ? `${drum.color}aa` : "rgba(255,255,255,0.14)",
                    boxShadow: on ? `0 0 22px 4px ${drum.glow}, inset 0 0 12px ${drum.color}` : "none",
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
