# Web Audio API: Fundamentals, Echo with FX-in-Feedback, Mic Monitoring + Metronome, and Timing Architecture

Authoritative source: Issue #228 research threads — comments 3192681700, 3192696052, 3192806626.

## 1) Fundamentals and Core Nodes

- AudioContext — master interface and clock (`audioCtx.currentTime`). Resume on a user gesture.
- OscillatorNode — synthesis; set `type` and `frequency`.
- AudioBufferSourceNode — decoded-file playback; schedule with `.start(when, offset?, duration?)`.
- GainNode — volume control and envelopes.
- BiquadFilterNode — EQ/tonal shaping (`type`, `frequency`, `Q`, etc.).
- AnalyserNode — FFT/time-domain visualization.

Examples

```js
// 1) Context (user gesture required in many browsers)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Start/resume only in direct response to a user gesture (e.g., a Play button)
document.querySelector('#start-audio')?.addEventListener('click', async () => {
  if (audioCtx.state !== 'running') await audioCtx.resume();
  // now safe to create/start nodes
});

// 2) Simple tone
const osc = audioCtx.createOscillator();
osc.type = 'sine';
osc.frequency.value = 440;
osc.connect(audioCtx.destination);
osc.start();
osc.stop(audioCtx.currentTime + 1);

// 3) Load/decode and play a file
const buf = await fetch('/path/audio.mp3').then(r => r.arrayBuffer()).then(b => audioCtx.decodeAudioData(b));
const src = audioCtx.createBufferSource();
src.buffer = buf;
src.connect(audioCtx.destination);
src.start();

// 4) Gain and Filter in series
const gain = audioCtx.createGain();
gain.gain.value = 0.5;
const filter = audioCtx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 1000;
osc.disconnect();
osc.connect(filter).connect(gain).connect(audioCtx.destination);
```

Practical: clean up disconnected nodes; check browser support; use headphones to avoid feedback when monitoring.

## 2) Echo/Delay with Effects Inside the Feedback Loop

Graph (node names are exact):

- Dry: `source → dryGain:GainNode → destination`
- Wet: `source → delay:DelayNode → wetGain:GainNode → destination`
- Feedback loop with FX: `delay → filter:BiquadFilterNode → distortion:WaveShaperNode → reverb:ConvolverNode → feedbackGain:GainNode → delay`

Parameters to expose

- `delay.delayTime` (s), `feedbackGain.gain` (0–1, keep < 1.0)
- `filter.type`, `filter.frequency`
- `distortion.curve` (Float32Array)
- `convolver.buffer` (IR AudioBuffer)
- `wetGain.gain`, `dryGain.gain`

Notes: Prevent runaway by capping feedback below 1.0; `ConvolverNode` requires a loaded impulse response; zero-delay cycles are disallowed.

```js
const delay = audioCtx.createDelay(5.0);
const feedbackGain = audioCtx.createGain();
const filter = audioCtx.createBiquadFilter();
const distortion = audioCtx.createWaveShaper();
const reverb = audioCtx.createConvolver();
const wetGain = audioCtx.createGain();
const dryGain = audioCtx.createGain();

delay.delayTime.value = 0.35;
feedbackGain.gain.value = 0.5;      // < 1.0
filter.type = 'lowpass';
filter.frequency.value = 8000;
// distortion.curve = yourFloat32Curve;
// reverb.buffer = yourImpulseResponseAudioBuffer;
wetGain.gain.value = 0.4;
dryGain.gain.value = 1.0;

// Dry and wet
source.connect(dryGain).connect(audioCtx.destination);
source.connect(delay);
delay.connect(wetGain).connect(audioCtx.destination);

// Feedback with FX
delay.connect(filter);
filter.connect(distortion);
distortion.connect(reverb);
reverb.connect(feedbackGain);
feedbackGain.connect(delay);
```

Helper (load IR):

```js
async function loadImpulseResponse(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch IR ${url}: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  try {
    return await audioCtx.decodeAudioData(ab);
  } catch (err) {
    console.error('decodeAudioData failed for IR', url, err);
    throw err; // Surface decoding/CORS-related failures clearly
  }
}
```

## 3) Microphone Monitoring + Metronome Overlay

Mic capture: request permission with `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation, noiseSuppression, autoGainControl } })`. Create `MediaStreamAudioSourceNode` and route to a `GainNode` → destination.

Metronome: synthesize a short click (e.g., square/sine burst through a gain envelope). Schedule by audio clock at `AudioContext.currentTime` with lookahead.

Mix graph: `micGain + metronomeGain → master → destination`.

```js
const master = audioCtx.createGain();
master.connect(audioCtx.destination);
const micGain = audioCtx.createGain();
const metronomeGain = audioCtx.createGain();
micGain.connect(master);
metronomeGain.connect(master);

async function initMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
  const micSrc = audioCtx.createMediaStreamSource(stream);
  micSrc.connect(micGain);
}

function scheduleClick(atTime, downbeat = false) {
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(downbeat ? 2000 : 1600, atTime);
  env.gain.setValueAtTime(0.0001, atTime);
  env.gain.exponentialRampToValueAtTime(1.0, atTime + 0.001);
  env.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.03);
  osc.connect(env).connect(metronomeGain);
  osc.start(atTime);
  osc.stop(atTime + 0.05);
  // Cleanup to avoid accumulating nodes during long sessions
  osc.onended = () => {
    try { osc.disconnect(); } catch {}
    try { env.disconnect(); } catch {}
  };
}

function startMetronome({ bpm = 120, beatsPerBar = 4 } = {}) {
  const spb = 60 / bpm; // seconds per beat
  let next = audioCtx.currentTime + 0.1;
  let beat = 0;
  const lookaheadMs = 25, ahead = 0.2;
  const id = setInterval(() => {
    while (next < audioCtx.currentTime + ahead) {
      scheduleClick(next, beat % beatsPerBar === 0);
      next += spb; beat = (beat + 1) % beatsPerBar;
    }
  }, lookaheadMs);
  return () => clearInterval(id);
}
```

Latency and safety: start/resume on user gesture; clean up per-tick nodes after `ended` to prevent buildup in long-running metronomes; use headphones while monitoring; mobile devices have higher base latency.

## 4) Time Synchronization and Scheduling Model

Clocks/time domains

- Master: `AudioContext.currentTime` — sample-accurate; schedule everything on this timeline.
- UI/high-res: `performance.now()` — for UI timers and Web MIDI timestamps.
- Mapping: capture `(tPerf0 = performance.now(), tAudio0 = audioCtx.currentTime)`, convert MIDI/perf timestamps with `tAudio = tAudio0 + (timeStamp - tPerf0)/1000`.
- Hints: `audioCtx.baseLatency`, `audioCtx.getOutputTimestamp?.()` — estimate DAC/output delay if aligning to “heard” time.

Scheduling primitives

- `AudioBufferSourceNode.start(when, offset?, duration?)` for one-shots/loops.
- `AudioParam` automation (`setValueAtTime`, `linearRampToValueAtTime`, `setTargetAtTime`, `setValueCurveAtTime`).
- Avoid `requestAnimationFrame`/`setTimeout` for timing; use an AudioWorklet for custom DSP/tight jitter when needed.

Tempo transport and lookahead

- Tempo mapping: `secondsPerBeat = 60 / bpm`; compute bars:beats:ticks → seconds on the audio clock (choose PPQ, e.g., 480/960).
- Lookahead window: maintain ~50–200 ms rolling schedule; enqueue with absolute `when` times in audio seconds.

Multi‑channel drum machine

- Pre‑decode all samples; never decode on hit.
- Per hit: create a fresh `AudioBufferSourceNode` and call `.start(when)`.
- For phase‑aligned layers (kick+clap, etc.), schedule all sources with the same `when` to guarantee sample‑accurate overlap.
- Routing: per‑track `GainNode`/optional FX → master bus; allow overlapping retriggers; compute flams as small `when` offsets.
- Pattern changes: compute the next bar boundary on the audio clock and enqueue new pattern hits relative to that time.

MIDI synth playback

- Live input: map `MIDIMessageEvent.timeStamp` (perf.now domain) → audio clock as above; buffer a short lookahead (5–20 ms) to reduce jitter.
- SMF playback: convert PPQ ticks using the tempo map; schedule noteOn/noteOff separately; sustain (CC64) defers noteOff until pedal release.
- Voice management: one voice per active note; allow overlapping envelopes; define voice‑steal policy if a polyphony cap is hit.

External sync and drift

- For MIDI Clock/MTC, derive BPM/phase from incoming ticks, convert to audio time, and drive the transport. Correct small phase error between beats with bounded micro‑nudges—avoid discontinuities.

## 5) Practical Notes

- User gesture required to start/resume `AudioContext` and to access the mic.
- Convolver IRs: host with CORS if cross‑origin; decode before use.
- Latency budget: device `baseLatency` + your lookahead + any Worklet buffering.
- Headphones recommended for monitoring to avoid acoustic feedback.

— End —
