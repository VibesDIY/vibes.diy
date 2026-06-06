import React, { useState, useEffect, useRef, useCallback } from "react";
import { getAudioContext, createReverb, playTone } from "../audio-helpers.js";

const STEPS = 8;
const ROWS = 4;
const NOTE_FREQS = [523.3, 392, 329.6, 261.6];
const BPM = 120;

export default function StepSequencer() {
  const [grid, setGrid] = useState<boolean[][]>(() => Array.from({ length: ROWS }, () => Array(STEPS).fill(false)));
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const reverbRef = useRef<ConvolverNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleCell = useCallback((row: number, col: number) => {
    setGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = !next[row][col];
      if (next[row][col]) {
        const ctx = getAudioContext();
        if (!reverbRef.current) reverbRef.current = createReverb(ctx, 2);
        playTone(ctx, NOTE_FREQS[row], reverbRef.current, 0.3);
      }
      return next;
    });
  }, []);

  const playStep = useCallback((step: number, gridSnapshot: boolean[][]) => {
    const ctx = getAudioContext();
    if (!reverbRef.current) reverbRef.current = createReverb(ctx, 2);
    for (let row = 0; row < ROWS; row++) {
      if (gridSnapshot[row][step]) {
        playTone(ctx, NOTE_FREQS[row], reverbRef.current, 0.3);
      }
    }
  }, []);

  const gridRef = useRef(grid);
  gridRef.current = grid;

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setCurrentStep(-1);
      return;
    }
    let step = 0;
    const stepMs = (60 / BPM / 2) * 1000;
    playStep(step, gridRef.current);
    setCurrentStep(step);
    intervalRef.current = setInterval(() => {
      step = (step + 1) % STEPS;
      playStep(step, gridRef.current);
      setCurrentStep(step);
    }, stepMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playStep]);

  useEffect(() => {
    setIsPlaying(true);
    setGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[3][0] = true;
      next[3][4] = true;
      next[1][2] = true;
      next[1][6] = true;
      next[0][0] = true;
      next[0][2] = true;
      next[0][4] = true;
      next[0][6] = true;
      return next;
    });
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "16px",
        gap: "12px",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${STEPS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          gap: "6px",
          flex: 1,
          maxHeight: "280px",
        }}
      >
        {grid.map((row, ri) =>
          row.map((on, ci) => (
            <button
              key={`${ri}-${ci}`}
              type="button"
              onClick={() => toggleCell(ri, ci)}
              style={{
                border: "2px solid var(--vibes-near-black)",
                borderRadius: "8px",
                backgroundColor: on
                  ? currentStep === ci
                    ? "var(--vibes-variant-yellow, #eab308)"
                    : "var(--vibes-variant-blue, #3b82f6)"
                  : currentStep === ci
                    ? "rgba(0,0,0,0.08)"
                    : "var(--vibes-cream, #FFFEF0)",
                cursor: "pointer",
                transition: "background-color 0.08s",
                minHeight: "40px",
              }}
            />
          ))
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            border: "2px solid var(--vibes-near-black)",
            backgroundColor: "var(--vibes-variant-blue, #3b82f6)",
            color: "var(--vibes-near-black)",
            fontSize: "20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isPlaying ? "■" : "▶"}
        </button>
      </div>
    </div>
  );
}
