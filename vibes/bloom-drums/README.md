# bloom-drums

The **pattern sequencer as a drum machine** — a **downstream evolution of**
[`system/bloom-machine`](https://vibes.diy/vibe/system/bloom-machine) (reached via its
"make it a drum machine" chip), not a sibling of it. It keeps the whole sequencer
(16-step playhead, hold-to-record with quantize + duration, colour-pie dots, BPM
stepper, saturation + one-beat delay FX, save/load to Fireproof) and only swaps the
pitched tones for **real drum voices**.

Each **row is a drum** (hi-hat / clap / snare / kick) — a short, percussive voice
with its own amp/pitch envelope — and each **column is a brighter/duller variant**
of that drum. Hold a pad to sound it; the hit records into the active pattern.

Lineage on the music chip's curated tree (#1896, Agent-in-Vibe UX epic
[#2675](https://github.com/VibesDIY/vibes.diy/issues/2675)):

```
bloom-root  (play the grid)
  ├─ Add a pattern sequencer → bloom-machine
  │     └─ Make it a drum machine → bloom-drums   (this app)
  └─ Make it a memory game → bloom-says
```

Live at [https://vibes.diy/vibe/system/bloom-drums](https://vibes.diy/vibe/system/bloom-drums).

## Deploy

Always pass `--vibe system/bloom-drums` so you don't publish under your default handle:

```sh
cd vibes/bloom-drums
npx vibes-diy push --vibe system/bloom-drums    # deploy
npx vibes-diy pull system/bloom-drums --dir .   # pull current live source
```

## Notes

- **iOS Safari audio unlock** runs synchronously inside the first gesture —
  see `prompts/pkg/llms/web-audio.md`.
- Keep source flat — `push` only ships top-level files.
