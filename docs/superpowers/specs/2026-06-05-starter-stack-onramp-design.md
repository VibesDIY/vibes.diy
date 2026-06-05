# Starter Stack Onramp (`/start`)

**Issue:** [#1896](https://github.com/VibesDIY/vibes.diy/issues/1896)

## Overview

A new `/start` route that teaches the core Vibes DIY loop — "the app is alive and obedient" — before a user ever writes a freeform prompt. Users pick a category, land in a running app, and transform it with curated one-tap chiclets. The first real wait happens only when they choose "Other" and type their own prompt.

## Flow

```
/start
  └─ 4 square category tiles (Creative, Productive, Music, Games)
       └─ tap "Music" → chime on touchEnd → AmbientDot app running
            ├─ "Drum machine"  (curated, instant swap)
            ├─ "Chord explorer" (curated, instant swap)
            └─ "Other"          (prompt, first real wait)
                 └─ each child also has 2 curated + Other...
```

### View 1: Category Picker

The landing view. Four square tiles in the same style as the homepage gallery (`VibeGalleryCard` + `FaceIcon1-4`). No prompt field, no "Other", no tray — just the 4 tiles on the branded background. Touching a tile plays a chime on `touchEnd` and immediately transitions to View 2 with that category's root app.

### View 2: Running App + Tray

Top: a live, interactive starter app (fills available space above the tray).

Bottom: a "Make it yours" tray with:

- 2 curated `VibesButton` chiclets (cycling blue/red/yellow by index)
- 1 "Other" button — navigates to `/` with the category pre-filled as prompt context

This is the first time the user sees the 2+Other pattern. Every app in the tree has its own 2+Other. The curated chiclets swap the app instantly. "Other" is the first time anything waits.

### Why 2+Other (not 3+Other)

2 curated options per node is a depth budget: narrower tree means we can guarantee instant cached content at least 2 levels deep across the board. The coverage target:

- **Level 0 (category → root app):** all 4 categories have a cached root app (instant)
- **Level 1 (root app → first transform):** each root app has at least 1 cached curated option (instant on second tap)
- **Level 2+:** best effort — "Other" is always there

Two instant taps before any wait. Breadth can grow later; depth-first.

This also creates a natural A/B surface: serve one chiclet from cache (instant) and let the other build, then measure which path users prefer — cached-instant vs. generated-with-wait.

## Starter Apps

Each starter app is a self-contained React component bundled in the app (not dynamically generated). All audio uses the WebAudio API with no external assets.

### Music Tree (ship first)

**AmbientDot** — category root. One dot on a canvas. Tap/drag to play a tone, release to hear it ring out with long decay. Minimal — one interaction, one sound.

- **StepSequencer** — the ambient dot constrained to a classic 8-step grid, mobile-first layout. Same reverb character as AmbientDot. Starts playing on mount.
- **ChordExplorer** — tap chord buttons for arpeggiated playback with the same reverb tail.

Each of these also has 2+Other, linking to sibling apps in the tree.

### Other Categories (placeholder)

Creative, Productive, Games each get a simple but functional placeholder app with 2+Other chiclets. These demonstrate the pattern and can be fleshed out in follow-up work.

## Data Model

A static tree in `starter-tree.ts`:

```ts
type StarterNode = {
  id: string;
  category: "music" | "creative" | "productive" | "games";
  title: string;
  component: React.ComponentType;
  chiclets: [
    { label: string; targetId: string; variant: "blue" | "red" | "yellow" },
    { label: string; targetId: string; variant: "blue" | "red" | "yellow" },
  ];
};
```

Flat map of `id → StarterNode`. Each node's chiclets point to other node IDs. "Other" is not in the tree — it's always rendered as a third button that routes to `/` with context.

Category roots are a separate constant mapping category name → root node ID.

## Route & Components

### Route

New public route (outside auth layout):

```ts
route("start", "./routes/start.tsx"),
```

### Component Structure

```
StartPage
├── CategoryPicker        (View 1: 4 square tiles)
└── StarterAppView        (View 2: app + tray)
    ├── {app.component}   (the running starter app)
    └── StarterTray       (2 chiclets + Other)
```

State is local to `StartPage`: which view is active, which node ID is current, and a history stack for back navigation.

### Back Navigation

Back button in the top bar navigates the history stack: app → previous app → category picker. Uses the existing `VibesPillHeader` if it fits, or a minimal back button.

## Audio

### Chime on Category Touch

A small WebAudio helper plays a chime on `touchEnd` of a category tile. Single oscillator, short attack, moderate decay. Fires from the event handler — no waiting for component mount.

### App Audio

Each app creates its own `AudioContext` in a `useEffect` on mount and starts producing sound immediately. Target: audio playing within 500ms of the chiclet tap. The old app unmounts and its AudioContext is closed.

Sound continuity across the Music tree is a design-time choice: similar reverb decay, similar frequency range, but no shared runtime state. Each app is a clean swap.

## Reused Components

- `VibesButton` (blue/red/yellow variants) — for the 2 curated chiclets + Other
- `VibeGalleryCard` + `FaceIcon1-4` — for the category picker tiles
- Theme tokens (`--vibes-variant-*`) — for consistent color treatment

## Scope

### In scope

- `/start` route with category picker and app view
- Music category with AmbientDot, StepSequencer, ChordExplorer (3 apps)
- Placeholder apps for Creative, Productive, Games (1 each, simple)
- Chime on category touch
- 2+Other tray pattern
- Back navigation through the tree
- Mobile-first layout

### Out of scope

- Login/auth gating on "Other"
- Deep linking to specific starter apps
- Analytics/tracking
- Persisting user choices
- Full app trees for non-Music categories
