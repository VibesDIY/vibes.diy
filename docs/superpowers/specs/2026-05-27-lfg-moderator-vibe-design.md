# LFG Moderator Vibe — Design Spec

**Date:** 2026-05-27  
**Status:** Approved — moving to generation

## What We're Building

A meeting moderator vibe for the LFG Weekly call. Shows visual on-screen timers for each agenda section, driven by a live transcript feed. Replaces the prior script-based section timer.

## Core User Flow

1. **First run / onboarding** — brief tutorial explaining how to paste the agenda, what the Fireproof database name is for, and how to connect the transcript source app
2. **Setup** — paste meeting notes (e.g. the LFG Weekly doc); AI parses sections + time allotments; enter the shared Fireproof database name
3. **Live meeting** — two-panel view:
   - **Left:** runway cards (done / now / next / upcoming) with per-section timer counting up, progress bar filling to allotted time
   - **Right:** full agenda doc with sub-bullets; active section highlighted in both panels simultaneously
4. **AI nudge** — yellow bar above Next Section when current section is over time; never auto-advances
5. **Manual advance** — "Next Section →" button always available; Pause available

## Data Model

Shared Fireproof database named `lfg-meeting-YYYYMMDD`:

```
{ type: "transcript", text: "...", speaker: "Chris", ts: <epoch> }
{ type: "meeting", sections: [{name, allotMinutes, startedAt, endedAt, bullets:[]}], currentIdx: 2, startedAt }
```

The transcript-source app appends `type: "transcript"` docs. This vibe owns the `type: "meeting"` doc.

## Architecture

- `useLiveQuery("type", { key: "transcript" })` — live transcript stream
- `useDocument(...)` — meeting state (sections, currentIdx, timers)
- `callAI` every 30s — last 90s of transcript + section name + elapsed/allotted → `{status: "on-track" | "nudge", message}`
- No auto-advance; AI output is advisory only

## Timer Behavior

- Counts **up** (not down) — less pressure, more honest
- Progress bar fills to allotted time → amber at 100% → red at 120%
- Done sections show actual time spent

## Edge Cases

- No transcript docs after 60s → "Waiting for transcript feed…" with database name shown
- Fireproof offline → works locally, syncs on reconnect
- Sections can be reordered or added during setup before starting

## Visual Design

- Runway cards (B style from mockup): light background, green active card, dashed next, ghosted upcoming
- Right panel: black header bar, agenda sections with state-matched highlighting
- Controls: ghost Pause left, bold green Next Section right

## Development Approach

Novel generative flow: craft 6 long product-focused prompts in 2 batches of 3, generate via vibes.diy, evaluate with Chrome MCP, compose best features into one final vibe.
