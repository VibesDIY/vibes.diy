import React, { useRef, useCallback } from "react";
import { getAudioContext, createReverb, playTone } from "../audio-helpers.js";

interface Chord {
  name: string;
  notes: number[];
  color: string;
}

const CHORDS: Chord[] = [
  { name: "C", notes: [261.6, 329.6, 392], color: "var(--vibes-variant-blue, #3b82f6)" },
  { name: "Am", notes: [220, 261.6, 329.6], color: "var(--vibes-variant-red, #ef4444)" },
  { name: "F", notes: [174.6, 220, 261.6], color: "var(--vibes-variant-yellow, #eab308)" },
  { name: "G", notes: [196, 246.9, 293.7], color: "var(--vibes-variant-blue, #3b82f6)" },
  { name: "Dm", notes: [293.7, 349.2, 440], color: "var(--vibes-variant-red, #ef4444)" },
  { name: "Em", notes: [329.6, 392, 493.9], color: "var(--vibes-variant-yellow, #eab308)" },
];

export default function ChordExplorer() {
  const reverbRef = useRef<ConvolverNode | null>(null);

  const playChord = useCallback((chord: Chord) => {
    const ctx = getAudioContext();
    if (!reverbRef.current) reverbRef.current = createReverb(ctx, 2.5);
    chord.notes.forEach((freq, i) => {
      setTimeout(() => {
        playTone(ctx, freq, reverbRef.current!, 1.5);
      }, i * 60);
    });
  }, []);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", justifyContent: "center" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10px",
          maxWidth: "360px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {CHORDS.map((chord) => (
          <button
            key={chord.name}
            type="button"
            onClick={() => playChord(chord)}
            style={{
              aspectRatio: "1",
              border: "2.5px solid var(--vibes-near-black)",
              borderRadius: "14px",
              backgroundColor: chord.color,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 800,
              color: "var(--vibes-near-black)",
              boxShadow: "3px 3px 0 var(--vibes-near-black)",
              transition: "transform 0.08s, box-shadow 0.08s",
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px, 2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "1px 1px 0 var(--vibes-near-black)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
          >
            {chord.name}
          </button>
        ))}
      </div>
    </div>
  );
}
