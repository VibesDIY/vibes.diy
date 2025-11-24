import React, { useRef, useEffect } from "react";
import { useFireproof } from "use-fireproof";
import { callAI } from "call-ai";

const App = () => {
  const { useDocument, useLiveQuery } = useFireproof("guitar-solos");
  const { doc, merge, submit } = useDocument({ notes: [], title: "" });
  const audioCtx = useRef(
    new (window.AudioContext || window.webkitAudioContext)(),
  );
  const modulator = useRef(null);
  const modulationGain = useRef(null);
  const carrier = useRef(null);
  const gainNode = useRef(null);
  const filter = useRef(null);
  const distortion = useRef(null);
  const lfo = useRef(null);

  useEffect(() => {
    setupAudioGraph();
    playGuitarSolo();
  }, []);

  const setupAudioGraph = () => {
    modulator.current = audioCtx.current.createOscillator();
    modulationGain = audioCtx.current.createGain();
    carrier.current = audioCtx.current.createOscillator();
    gainNode.current = audioCtx.current.createGain();
    filter.current = audioCtx.current.createBiquadFilter();
    distortion.current = audioCtx.current.createWaveShaper();
    lfo.current = audioCtx.current.createOscillator();

    modulator.current.type = "sawtooth";
    carrier.current.type = "sawtooth";
    lfo.current.type = "sine";

    distortion.current.oversample = "4x";
    distortion.current.curve = makeDistortionCurve(500);

    modulator.current.connect(modulationGain).connect(carrier.current.detune);
    lfo.current.connect(gainNode.current.gain);
    carrier.current
      .connect(filter.current)
      .connect(distortion.current)
      .connect(gainNode.current)
      .connect(audioCtx.current.destination);

    modulator.current.start();
    carrier.current.start();
    lfo.current.start();
    gainNode.current.gain.setValueAtTime(0.0, audioCtx.current.currentTime);
  };

  const makeDistortionCurve = (amount) => {
    const n = 44100,
      curve = new Float32Array(n);
    const amp = amount * 0.1;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  };

  const playGuitarSolo = () => {
    const notes = [
      659.25, 783.99, 659.25, 783.99, 659.25, 783.99, 659.25, 870.62, 783.99,
      659.25, 740.0, 783.99, 870.62, 783.99, 659.25, 870.62, 987.77, 870.62,
      783.99, 870.62, 987.77, 1046.5, 987.77, 870.62, 740.0, 659.25, 740.0,
      783.99, 870.62, 783.99, 659.25, 740.0, 783.99, 870.62, 783.99, 659.25,
      783.99, 659.25, 783.99, 659.25, 870.62, 783.99, 659.25, 740.0, 783.99,
      870.62, 783.99, 659.25, 870.62, 987.77, 870.62, 783.99, 870.62, 987.77,
      1046.5, 987.77, 870.62, 740.0, 659.25, 740.0, 783.99, 870.62, 783.99,
      659.25, 740.0, 783.99, 870.62, 783.99, 659.25, 783.99, 659.25,
    ];

    const phraseDurations = [0.25, 0.5, 0.75, 1, 1.25];
    let time = audioCtx.current.currentTime;

    notes.forEach((note, index) => {
      const duration =
        phraseDurations[Math.floor(Math.random() * phraseDurations.length)];
      const modulationDepth = 50 + 20 * Math.random();
      const wahSweep = 100 + 300 * Math.random();

      modulator.current.frequency.setValueAtTime(modulationDepth, time);
      lfo.current.frequency.setValueAtTime(6 + 6 * Math.random(), time);
      gainNode.current.gain.setValueAtTime(0.5, time);
      gainNode.current.gain.exponentialRampToValueAtTime(0.1, time + duration);
      carrier.current.frequency.setValueAtTime(note, time);
      carrier.current.frequency.exponentialRampToValueAtTime(
        note * 1.05,
        time + duration / 2,
      );
      carrier.current.frequency.exponentialRampToValueAtTime(
        note,
        time + duration,
      );
      filter.current.frequency.setValueAtTime(wahSweep, time);
      filter.current.frequency.exponentialRampToValueAtTime(
        1000 + wahSweep,
        time + duration / 2,
      );
      filter.current.frequency.exponentialRampToValueAtTime(
        wahSweep,
        time + duration,
      );

      time += duration;
    });
  };

  const handleInputChange = (e) => {
    merge({ title: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const renderSolos = () => {
    if (!doc.notes) return;
    return doc.notes.map((note, index) => (
      <div key={index} className="mb-2 rounded bg-gray-100 p-2">
        <span className="font-bold">Note {index + 1}: </span>
        <span>{note}</span>
      </div>
    ));
  };

  return (
    <div className="mx-auto max-w-screen-xl rounded-lg bg-white p-6 shadow-lg">
      <h1 className="mb-4 text-center text-4xl font-bold">
        Hendrix-Like Guitar Solos Generator
      </h1>
      <p className="mb-4 text-lg italic">
        This app generates Hendrix-like guitar solos using the Web Audio API. It
        creates expressive bends, wah-wah effects, feedback, and scheduled
        phrases with human-like timing variations to mimic iconic 1960s rock
        guitar solos.
      </p>
      <form onSubmit={handleSubmit} className="mb-4">
        <label htmlFor="title" className="mb-2 block font-semibold">
          Title of Solo
        </label>
        <input
          className="mb-2 w-full rounded border border-gray-300 px-2 py-1"
          id="title"
          type="text"
          onChange={handleInputChange}
          value={doc.title}
        />
        <button
          type="submit"
          className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          Save Solo Title
        </button>
      </form>
      <button
        onClick={playGuitarSolo}
        className="mb-4 rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
      >
        Play Guitar Solo
      </button>
      <h2 className="mb-2 text-2xl font-semibold">Saved Solos:</h2>
      {renderSolos()}
    </div>
  );
};

export default App;
