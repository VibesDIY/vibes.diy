# Starter Stack Onramp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/start` route — a curated onramp where users pick a category, land in a running app instantly, and transform it with 2 curated chiclets + Other.

**Architecture:** Local state machine in `StartPage` switches between a category picker view and app+tray view. A flat `starterTree` map defines all nodes and their chiclet links. Each starter app is a self-contained React component using WebAudio. The "Other" button hands off to the homepage prompt flow via `sessionStorage` + `prompt64` query param.

**Tech Stack:** React, React Router, WebAudio API, inline styles (CSSProperties), existing VibesButton and VibeGalleryCard components.

**Spec:** `docs/superpowers/specs/2026-06-05-starter-stack-onramp-design.md`

---

## File Map

### New files

- `vibes.diy/pkg/app/routes/start.tsx` — route entry, thin wrapper
- `vibes.diy/pkg/app/components/StartPage/StartPage.tsx` — main page component, state machine
- `vibes.diy/pkg/app/components/StartPage/StartPage.styles.ts` — style functions
- `vibes.diy/pkg/app/components/StartPage/CategoryPicker.tsx` — the 4-tile grid
- `vibes.diy/pkg/app/components/StartPage/StarterAppView.tsx` — running app + tray
- `vibes.diy/pkg/app/components/StartPage/StarterTray.tsx` — 2 chiclets + Other
- `vibes.diy/pkg/app/components/StartPage/starter-tree.ts` — node definitions and tree data
- `vibes.diy/pkg/app/components/StartPage/audio-helpers.ts` — shared WebAudio utilities (chime, reverb factory)
- `vibes.diy/pkg/app/components/StartPage/apps/AmbientDot.tsx` — Music root app
- `vibes.diy/pkg/app/components/StartPage/apps/StepSequencer.tsx` — 8-step grid
- `vibes.diy/pkg/app/components/StartPage/apps/ChordExplorer.tsx` — chord button player
- `vibes.diy/pkg/app/components/StartPage/apps/PlaceholderApp.tsx` — generic placeholder for Creative/Productive/Games

### Modified files

- `vibes.diy/pkg/app/routes.ts` — add `route("start", ...)`

---

## Task 1: Route and Page Shell

**Files:**

- Modify: `vibes.diy/pkg/app/routes.ts`
- Create: `vibes.diy/pkg/app/routes/start.tsx`
- Create: `vibes.diy/pkg/app/components/StartPage/StartPage.tsx`
- Create: `vibes.diy/pkg/app/components/StartPage/StartPage.styles.ts`

- [ ] **Step 1: Add the route**

In `vibes.diy/pkg/app/routes.ts`, add the `/start` route as a public route (outside the auth layout), before the about route:

```ts
route("start", "./routes/start.tsx", { id: "start" }),
```

- [ ] **Step 2: Create the route file**

Create `vibes.diy/pkg/app/routes/start.tsx`:

```tsx
import React from "react";
import StartPage from "../components/StartPage/StartPage.js";

export default function Start() {
  return <StartPage />;
}
```

- [ ] **Step 3: Create the styles file**

Create `vibes.diy/pkg/app/components/StartPage/StartPage.styles.ts`:

```ts
import { CSSProperties } from "react";

export const getPageStyle = (): CSSProperties => ({
  minHeight: "100dvh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
});

export const getCategoryGridStyle = (isMobile: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: isMobile ? "16px" : "24px",
  padding: isMobile ? "24px" : "48px",
  maxWidth: "400px",
  margin: "0 auto",
  flex: 1,
  alignContent: "center",
});

export const getAppContainerStyle = (): CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
});

export const getAppBodyStyle = (): CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  position: "relative",
});

export const getTrayStyle = (isMobile: boolean): CSSProperties => ({
  flexShrink: 0,
  padding: isMobile ? "12px 16px 24px" : "16px 24px 32px",
  borderTop: "2px solid var(--vibes-near-black)",
  backgroundColor: "var(--vibes-cream, #FFFEF0)",
  display: "flex",
  flexDirection: "column",
  gap: isMobile ? "10px" : "12px",
});

export const getTrayLabelStyle = (): CSSProperties => ({
  fontSize: "14px",
  fontWeight: 800,
  letterSpacing: "0.02em",
  color: "var(--vibes-near-black)",
});

export const getTrayButtonsStyle = (): CSSProperties => ({
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
});

export const getBackButtonStyle = (): CSSProperties => ({
  position: "absolute",
  top: "12px",
  left: "12px",
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  border: "2px solid var(--vibes-near-black)",
  backgroundColor: "var(--vibes-cream, #FFFEF0)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
  fontWeight: 800,
  color: "var(--vibes-near-black)",
  zIndex: 10,
});

export const getAppTitleStyle = (): CSSProperties => ({
  padding: "14px 16px 4px 56px",
  fontSize: "20px",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: "var(--vibes-near-black)",
});
```

- [ ] **Step 4: Create the page component shell**

Create `vibes.diy/pkg/app/components/StartPage/StartPage.tsx`:

```tsx
import React, { useState, useCallback, useEffect } from "react";
import { gridBackground, cx } from "@vibes.diy/base";
import { isMobileViewport } from "../../utils/ViewState.js";
import { getPageStyle } from "./StartPage.styles.js";

type View = { kind: "categories" } | { kind: "app"; nodeId: string };

export default function StartPage() {
  const [view, setView] = useState<View>({ kind: "categories" });
  const [history, setHistory] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(isMobileViewport());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const navigateToApp = useCallback(
    (nodeId: string) => {
      if (view.kind === "app") {
        setHistory((prev) => [...prev, view.nodeId]);
      }
      setView({ kind: "app", nodeId });
    },
    [view]
  );

  const navigateBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setView({ kind: "app", nodeId: prev });
    } else {
      setView({ kind: "categories" });
    }
  }, [history]);

  if (isMobile === null) {
    return <div className={cx(gridBackground, "page-grid-background")} style={getPageStyle()} />;
  }

  return (
    <div className={cx(gridBackground, "page-grid-background")} style={getPageStyle()}>
      {view.kind === "categories" ? <div>Category picker placeholder</div> : <div>App view placeholder for {view.nodeId}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Verify it builds**

Run: `cd vibes.diy && pnpm build`
Expected: Build succeeds, `/start` route is registered.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/routes.ts vibes.diy/pkg/app/routes/start.tsx vibes.diy/pkg/app/components/StartPage/
git commit -m "feat(start): add /start route and page shell"
```

---

## Task 2: Starter Tree Data

**Files:**

- Create: `vibes.diy/pkg/app/components/StartPage/starter-tree.ts`

- [ ] **Step 1: Create the tree data file**

Create `vibes.diy/pkg/app/components/StartPage/starter-tree.ts`:

```ts
import type { ComponentType } from "react";

type ButtonVariant = "blue" | "red" | "yellow";

export interface Chiclet {
  label: string;
  targetId: string;
  variant: ButtonVariant;
}

export interface StarterNode {
  id: string;
  category: "music" | "creative" | "productive" | "games";
  title: string;
  component: ComponentType;
  chiclets: [Chiclet, Chiclet];
}

export const CATEGORY_ROOTS: Record<string, string> = {
  Music: "music-ambient",
  Creative: "creative-canvas",
  Productive: "productive-notes",
  Games: "games-reflex",
};

// Lazy-initialized map — components are set by registerStarterApps()
const tree = new Map<string, StarterNode>();

export function registerStarterApp(node: StarterNode) {
  tree.set(node.id, node);
}

export function getStarterNode(id: string): StarterNode | undefined {
  return tree.get(id);
}

export function getCategoryRootId(category: string): string | undefined {
  return CATEGORY_ROOTS[category];
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/starter-tree.ts
git commit -m "feat(start): add starter tree data model"
```

---

## Task 3: Audio Helpers

**Files:**

- Create: `vibes.diy/pkg/app/components/StartPage/audio-helpers.ts`

- [ ] **Step 1: Create WebAudio utility file**

Create `vibes.diy/pkg/app/components/StartPage/audio-helpers.ts`:

```ts
let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function createReverb(ctx: AudioContext, decay: number = 2): ConvolverNode {
  const convolver = ctx.createConvolver();
  const rate = ctx.sampleRate;
  const length = rate * decay;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  convolver.buffer = impulse;
  return convolver;
}

export function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.6);
}

export function playTone(ctx: AudioContext, frequency: number, reverb: ConvolverNode, duration: number = 2) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  const dry = ctx.createGain();
  dry.gain.value = 0.6;
  const wet = ctx.createGain();
  wet.gain.value = 0.4;

  osc.connect(gain);
  gain.connect(dry).connect(ctx.destination);
  gain.connect(wet).connect(reverb).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/audio-helpers.ts
git commit -m "feat(start): add WebAudio helpers (chime, reverb, tone)"
```

---

## Task 4: AmbientDot App (Music Root)

**Files:**

- Create: `vibes.diy/pkg/app/components/StartPage/apps/AmbientDot.tsx`

- [ ] **Step 1: Create the AmbientDot component**

Create `vibes.diy/pkg/app/components/StartPage/apps/AmbientDot.tsx`:

```tsx
import React, { useRef, useEffect, useCallback } from "react";
import { getAudioContext, createReverb, playTone } from "../audio-helpers.js";

const MIN_FREQ = 220;
const MAX_FREQ = 880;

export default function AmbientDot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);
  const dotPos = useRef({ x: 0.5, y: 0.5 });
  const isDragging = useRef(false);
  const animFrame = useRef<number>(0);

  const getFrequencyFromPosition = useCallback((y: number) => {
    return MAX_FREQ - y * (MAX_FREQ - MIN_FREQ);
  }, []);

  const drawDot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const x = dotPos.current.x * w;
    const y = dotPos.current.y * h;
    const radius = isDragging.current ? 28 : 22;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
    glow.addColorStop(0, "rgba(59, 130, 246, 0.3)");
    glow.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "var(--vibes-near-black, #1a1a1a)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      drawDot();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [drawDot]);

  const animate = useCallback(() => {
    drawDot();
    animFrame.current = requestAnimationFrame(animate);
  }, [drawDot]);

  useEffect(() => {
    animFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame.current);
  }, [animate]);

  const getPosition = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0.5, y: 0.5 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handleStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const pos = getPosition(e);
      dotPos.current = pos;
      const ctx = getAudioContext();
      if (!reverbRef.current) {
        reverbRef.current = createReverb(ctx, 3);
      }
      playTone(ctx, getFrequencyFromPosition(pos.y), reverbRef.current, 3);
    },
    [getPosition, getFrequencyFromPosition]
  );

  const handleMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      dotPos.current = getPosition(e);
    },
    [getPosition]
  );

  const handleEnd = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const pos =
        "changedTouches" in e
          ? {
              x: Math.max(
                0,
                Math.min(
                  1,
                  (e.changedTouches[0].clientX - canvasRef.current!.getBoundingClientRect().left) /
                    canvasRef.current!.getBoundingClientRect().width
                )
              ),
              y: Math.max(
                0,
                Math.min(
                  1,
                  (e.changedTouches[0].clientY - canvasRef.current!.getBoundingClientRect().top) /
                    canvasRef.current!.getBoundingClientRect().height
                )
              ),
            }
          : dotPos.current;
      dotPos.current = pos;
      const ctx = getAudioContext();
      if (!reverbRef.current) {
        reverbRef.current = createReverb(ctx, 3);
      }
      playTone(ctx, getFrequencyFromPosition(pos.y), reverbRef.current, 4);
    },
    [getFrequencyFromPosition]
  );

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", touchAction: "none", cursor: "pointer" }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    />
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/apps/AmbientDot.tsx
git commit -m "feat(start): add AmbientDot music app (tap/drag ambient instrument)"
```

---

## Task 5: StepSequencer App

**Files:**

- Create: `vibes.diy/pkg/app/components/StartPage/apps/StepSequencer.tsx`

- [ ] **Step 1: Create the StepSequencer component**

Create `vibes.diy/pkg/app/components/StartPage/apps/StepSequencer.tsx`:

```tsx
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
      style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", justifyContent: "center" }}
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
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/apps/StepSequencer.tsx
git commit -m "feat(start): add StepSequencer app (8-step grid with auto-play)"
```

---

## Task 6: ChordExplorer App

**Files:**

- Create: `vibes.diy/pkg/app/components/StartPage/apps/ChordExplorer.tsx`

- [ ] **Step 1: Create the ChordExplorer component**

Create `vibes.diy/pkg/app/components/StartPage/apps/ChordExplorer.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/apps/ChordExplorer.tsx
git commit -m "feat(start): add ChordExplorer app (tap chord buttons for arpeggiated playback)"
```

---

## Task 7: Placeholder App

**Files:**

- Create: `vibes.diy/pkg/app/components/StartPage/apps/PlaceholderApp.tsx`

- [ ] **Step 1: Create the PlaceholderApp component**

Create `vibes.diy/pkg/app/components/StartPage/apps/PlaceholderApp.tsx`:

```tsx
import React from "react";

interface PlaceholderAppProps {
  category: string;
}

export default function PlaceholderApp({ category }: PlaceholderAppProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "16px",
        padding: "24px",
        color: "var(--vibes-near-black)",
      }}
    >
      <div style={{ fontSize: "48px" }}>{category === "Creative" ? "🎨" : category === "Productive" ? "📋" : "🎮"}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, textAlign: "center" }}>{category} starter coming soon</div>
      <div style={{ fontSize: "14px", opacity: 0.6, textAlign: "center" }}>Try &ldquo;Other&rdquo; below to build your own</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/apps/PlaceholderApp.tsx
git commit -m "feat(start): add PlaceholderApp for Creative/Productive/Games stubs"
```

---

## Task 8: Register Apps in Starter Tree

**Files:**

- Modify: `vibes.diy/pkg/app/components/StartPage/starter-tree.ts`

- [ ] **Step 1: Add app registrations**

Add the following to the bottom of `starter-tree.ts`:

```ts
import AmbientDot from "./apps/AmbientDot.js";
import StepSequencer from "./apps/StepSequencer.js";
import ChordExplorer from "./apps/ChordExplorer.js";
import PlaceholderApp from "./apps/PlaceholderApp.js";

// --- Music tree ---
registerStarterApp({
  id: "music-ambient",
  category: "music",
  title: "Ambient Dot",
  component: AmbientDot,
  chiclets: [
    { label: "Drum machine", targetId: "music-sequencer", variant: "blue" },
    { label: "Chord explorer", targetId: "music-chords", variant: "red" },
  ],
});

registerStarterApp({
  id: "music-sequencer",
  category: "music",
  title: "Step Sequencer",
  component: StepSequencer,
  chiclets: [
    { label: "Chord explorer", targetId: "music-chords", variant: "blue" },
    { label: "Ambient dot", targetId: "music-ambient", variant: "yellow" },
  ],
});

registerStarterApp({
  id: "music-chords",
  category: "music",
  title: "Chord Explorer",
  component: ChordExplorer,
  chiclets: [
    { label: "Drum machine", targetId: "music-sequencer", variant: "yellow" },
    { label: "Ambient dot", targetId: "music-ambient", variant: "blue" },
  ],
});

// --- Placeholder trees (one root node each) ---
function makePlaceholder(id: string, category: "creative" | "productive" | "games", title: string): StarterNode {
  return {
    id,
    category,
    title,
    component: () => PlaceholderApp({ category: title }),
    chiclets: [
      { label: "Coming soon", targetId: id, variant: "blue" },
      { label: "Coming soon", targetId: id, variant: "red" },
    ],
  };
}

registerStarterApp(makePlaceholder("creative-canvas", "creative", "Creative"));
registerStarterApp(makePlaceholder("productive-notes", "productive", "Productive"));
registerStarterApp(makePlaceholder("games-reflex", "games", "Games"));
```

Note: the imports must be at the top of the file. Move the existing type definitions and `CATEGORY_ROOTS` above, then add the imports and registrations.

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/starter-tree.ts
git commit -m "feat(start): register all starter apps in tree (music + placeholders)"
```

---

## Task 9: CategoryPicker Component

**Files:**

- Create: `vibes.diy/pkg/app/components/StartPage/CategoryPicker.tsx`

- [ ] **Step 1: Create CategoryPicker**

Create `vibes.diy/pkg/app/components/StartPage/CategoryPicker.tsx`:

```tsx
import React, { useCallback } from "react";
import { FaceIcon1, FaceIcon2, FaceIcon3, FaceIcon4, TexturedPattern } from "@vibes.diy/base";
import { playChime, getAudioContext } from "./audio-helpers.js";
import { getCategoryRootId } from "./starter-tree.js";
import {
  getVibeCardWrapperStyle,
  getVibeCardIconContainerStyle,
  getVibeCardTexturedShadowStyle,
  getVibeCardMainIconContainerStyle,
  getVibeCardNameStyle,
} from "../NewSessionContent/NewSessionContent.styles.js";
import { getCategoryGridStyle } from "./StartPage.styles.js";
import { useState } from "react";

const CATEGORIES = [
  { label: "Creative", Icon: FaceIcon1 },
  { label: "Productive", Icon: FaceIcon2 },
  { label: "Music", Icon: FaceIcon3 },
  { label: "Games", Icon: FaceIcon4 },
];

interface CategoryPickerProps {
  isMobile: boolean;
  onSelect: (nodeId: string) => void;
}

export default function CategoryPicker({ isMobile, onSelect }: CategoryPickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleTouch = useCallback(
    (category: string) => {
      const rootId = getCategoryRootId(category);
      if (!rootId) return;
      const ctx = getAudioContext();
      playChime(ctx);
      onSelect(rootId);
    },
    [onSelect]
  );

  const iconSize = isMobile ? 64 : 100;
  const iconInnerSize = isMobile ? 40 : 68;
  const borderRadius = isMobile ? 16 : 24;

  return (
    <div style={getCategoryGridStyle(isMobile)}>
      {CATEGORIES.map((cat, index) => (
        <button
          key={cat.label}
          type="button"
          style={{
            ...getVibeCardWrapperStyle(),
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleTouch(cat.label);
          }}
          onClick={() => handleTouch(cat.label)}
          aria-label={`Start with ${cat.label}`}
        >
          <div
            style={getVibeCardIconContainerStyle(isMobile)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div style={getVibeCardTexturedShadowStyle(hoveredIndex === index, isMobile)}>
              <TexturedPattern width={iconSize} height={iconSize} borderRadius={borderRadius} />
            </div>
            <div style={getVibeCardMainIconContainerStyle(hoveredIndex === index, isMobile)}>
              <cat.Icon width={iconInnerSize} height={iconInnerSize} fill="var(--vibes-near-black)" />
            </div>
          </div>
          <div style={getVibeCardNameStyle()}>{cat.label}</div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/CategoryPicker.tsx
git commit -m "feat(start): add CategoryPicker with chime on touch"
```

---

## Task 10: StarterTray Component

**Files:**

- Create: `vibes.diy/pkg/app/components/StartPage/StarterTray.tsx`

- [ ] **Step 1: Create StarterTray**

Create `vibes.diy/pkg/app/components/StartPage/StarterTray.tsx`:

```tsx
import React, { useCallback } from "react";
import { useNavigate } from "react-router";
import { BuildURI } from "@adviser/cement";
import { VibesButton } from "@vibes.diy/base";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import type { StarterNode } from "./starter-tree.js";
import { getTrayStyle, getTrayLabelStyle, getTrayButtonsStyle } from "./StartPage.styles.js";

interface StarterTrayProps {
  node: StarterNode;
  isMobile: boolean;
  onSelectChiclet: (targetId: string) => void;
}

export default function StarterTray({ node, isMobile, onSelectChiclet }: StarterTrayProps) {
  const navigate = useNavigate();
  const { sthis } = useVibesDiy();

  const handleOther = useCallback(() => {
    const categoryPrompt = `Make me a ${node.category} app`;
    sessionStorage.setItem("vibes.pendingPrompt", categoryPrompt);
    navigate(
      BuildURI.from(window.location.href).pathname("/chat/prompt").setParam("prompt64", sthis.txt.base64.encode(categoryPrompt))
        .withoutHostAndSchema
    );
  }, [node.category, navigate, sthis]);

  return (
    <div style={getTrayStyle(isMobile)}>
      <div style={getTrayLabelStyle()}>✦ Make it yours</div>
      <div style={getTrayButtonsStyle()}>
        {node.chiclets.map((chiclet) => (
          <VibesButton
            key={chiclet.targetId}
            variant={chiclet.variant}
            onClick={() => onSelectChiclet(chiclet.targetId)}
            style={{ flex: 1, minWidth: 0 }}
          >
            {chiclet.label}
          </VibesButton>
        ))}
        <VibesButton variant="gray" onClick={handleOther} style={{ flex: 1, minWidth: 0 }}>
          Other…
        </VibesButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/StarterTray.tsx
git commit -m "feat(start): add StarterTray with 2 chiclets + Other"
```

---

## Task 11: StarterAppView Component

**Files:**

- Create: `vibes.diy/pkg/app/components/StartPage/StarterAppView.tsx`

- [ ] **Step 1: Create StarterAppView**

Create `vibes.diy/pkg/app/components/StartPage/StarterAppView.tsx`:

```tsx
import React from "react";
import type { StarterNode } from "./starter-tree.js";
import StarterTray from "./StarterTray.js";
import { getAppContainerStyle, getAppBodyStyle, getBackButtonStyle, getAppTitleStyle } from "./StartPage.styles.js";

interface StarterAppViewProps {
  node: StarterNode;
  isMobile: boolean;
  onSelectChiclet: (targetId: string) => void;
  onBack: () => void;
}

export default function StarterAppView({ node, isMobile, onSelectChiclet, onBack }: StarterAppViewProps) {
  const AppComponent = node.component;

  return (
    <div style={getAppContainerStyle()}>
      <div style={getAppBodyStyle()}>
        <button type="button" style={getBackButtonStyle()} onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div style={getAppTitleStyle()}>{node.title}</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AppComponent />
        </div>
      </div>
      <StarterTray node={node} isMobile={isMobile} onSelectChiclet={onSelectChiclet} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/StarterAppView.tsx
git commit -m "feat(start): add StarterAppView (running app + tray + back button)"
```

---

## Task 12: Wire Everything into StartPage

**Files:**

- Modify: `vibes.diy/pkg/app/components/StartPage/StartPage.tsx`

- [ ] **Step 1: Replace the placeholder StartPage with the real implementation**

Replace the entire contents of `StartPage.tsx` with:

```tsx
import React, { useState, useCallback, useEffect } from "react";
import { gridBackground, cx } from "@vibes.diy/base";
import { isMobileViewport } from "../../utils/ViewState.js";
import { getPageStyle } from "./StartPage.styles.js";
import CategoryPicker from "./CategoryPicker.js";
import StarterAppView from "./StarterAppView.js";
import { getStarterNode } from "./starter-tree.js";

// Side-effect import: registers all apps in the tree
import "./starter-tree.js";

type View = { kind: "categories" } | { kind: "app"; nodeId: string };

export default function StartPage() {
  const [view, setView] = useState<View>({ kind: "categories" });
  const [history, setHistory] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(isMobileViewport());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const navigateToApp = useCallback(
    (nodeId: string) => {
      if (view.kind === "app") {
        setHistory((prev) => [...prev, view.nodeId]);
      }
      setView({ kind: "app", nodeId });
    },
    [view]
  );

  const navigateBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setView({ kind: "app", nodeId: prev });
    } else {
      setView({ kind: "categories" });
    }
  }, [history]);

  if (isMobile === null) {
    return <div className={cx(gridBackground, "page-grid-background")} style={getPageStyle()} />;
  }

  const mobile = isMobile as boolean;

  if (view.kind === "categories") {
    return (
      <div className={cx(gridBackground, "page-grid-background")} style={getPageStyle()}>
        <CategoryPicker isMobile={mobile} onSelect={navigateToApp} />
      </div>
    );
  }

  const node = getStarterNode(view.nodeId);
  if (!node) {
    setView({ kind: "categories" });
    return null;
  }

  return (
    <div className={cx(gridBackground, "page-grid-background")} style={getPageStyle()}>
      <StarterAppView node={node} isMobile={mobile} onSelectChiclet={navigateToApp} onBack={navigateBack} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd vibes.diy && pnpm build`

- [ ] **Step 3: Manual test**

Run: `cd vibes.diy && pnpm dev`

Open `http://localhost:5173/start` in a browser. Verify:

1. Four category tiles appear (Creative, Productive, Music, Games)
2. Tapping Music plays a chime and shows AmbientDot
3. Tapping the dot plays tones with reverb
4. "Drum machine" chiclet swaps to StepSequencer (auto-plays)
5. "Chord explorer" chiclet swaps to ChordExplorer
6. Back button navigates history correctly
7. "Other…" navigates to `/chat/prompt` with category context
8. Creative/Productive/Games show placeholder apps

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/pkg/app/components/StartPage/StartPage.tsx
git commit -m "feat(start): wire all components into StartPage"
```

---

## Task 13: Run Checks and Final Cleanup

**Files:**

- All files in `vibes.diy/pkg/app/components/StartPage/`
- `vibes.diy/pkg/app/routes.ts`
- `vibes.diy/pkg/app/routes/start.tsx`

- [ ] **Step 1: Format all files**

Run: `npx prettier --write vibes.diy/pkg/app/components/StartPage/ vibes.diy/pkg/app/routes/start.tsx`

- [ ] **Step 2: Run pnpm fast-check**

Run: `cd vibes.diy && pnpm fast-check`

Fix any lint or type errors that appear.

- [ ] **Step 3: Commit any formatting fixes**

```bash
git add -A
git commit -m "chore: format starter stack files"
```

- [ ] **Step 4: Push and update PR**

```bash
git push
```
