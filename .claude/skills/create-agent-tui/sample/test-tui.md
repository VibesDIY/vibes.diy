# Screenshot & TUI Test Guide

This guide documents how to regenerate screenshots and verify the TUI renders correctly. It's intended for both human developers and AI agents maintaining this project.

## Prerequisites

```bash
cd skills/create-agent-tui/sample
npm install
npx playwright install chromium
brew install ttyd  # macOS — required for screenshot pipeline
```

## How screenshots work

The pipeline uses **ttyd + Playwright**:

1. `ttyd` spawns a demo script in a real PTY and serves it over HTTP as a web-based xterm.js terminal
2. Playwright (headless Chromium) navigates to the ttyd URL
3. After the demo script renders, Playwright injects dark background styling and takes a screenshot

This produces pixel-perfect terminal screenshots because the ANSI output flows through a real PTY with correct Unicode character widths.

```
screenshot-demos.ts
  │
  ├── for each tool display style (emoji, grouped, minimal):
  │     ttyd → npx tsx demo-tools.ts <style>
  │     Playwright → http://localhost:<port> → screenshot
  │
  └── for each input style (block, bordered, plain):
        ttyd → npx tsx demo-input.ts <style>
        Playwright → http://localhost:<port> → screenshot
```

## Running screenshots

```bash
npm run screenshots
```

This generates 6 PNGs in `screenshots/`:
- `tool-display-emoji.png`, `tool-display-grouped.png`, `tool-display-minimal.png`
- `input-style-block.png`, `input-style-bordered.png`, `input-style-plain.png`

## Demo scripts

### demo-tools.ts

Simulates a realistic agent conversation by emitting scripted `AgentEvent` objects through `TuiRenderer`. Accepts one argument: the tool display style (`emoji`, `grouped`, or `minimal`).

The script does NOT call the real agent or make API calls — it's a deterministic playback of fake events. It stays alive for 10 seconds so ttyd/Playwright has time to capture the screenshot.

### demo-input.ts

Renders the idle input prompt for each input style (`block`, `bordered`, or `plain`). Uses a hardcoded dark background tint for the block style since `detectBg()` requires terminal interaction.

## Adding new screenshots

Follow this pattern:

1. Create a new demo script in `src/` that writes ANSI output to stdout and holds for 10s
2. Add a loop in `screenshot-demos.ts` that spawns ttyd with your script and captures the screenshot
3. Run `npm run screenshots` to verify
4. Add the screenshot to the README

## TUI test cases

### Tool display (T1-T3)

After running `npm run screenshots`, verify each tool display PNG:

| Test | Screenshot | What to check |
|------|-----------|---------------|
| T1 | `tool-display-emoji.png` | Each tool call shows `⚡` marker with name and args, followed by `✓` with timing |
| T2 | `tool-display-grouped.png` | Bold action labels (`Ran`, `Listed`, `Read`, `Searched`) with `└` tree-branch output lines |
| T3 | `tool-display-minimal.png` | Single aggregated summary line (`ran 1 shell command, listed 2 directories...`) |

### Input styles (T4-T6)

| Test | Screenshot | What to check |
|------|-----------|---------------|
| T4 | `input-style-block.png` | Three-line background box with `›` prompt, tinted background extends full width |
| T5 | `input-style-bordered.png` | Horizontal `─` lines above and below the `›` prompt |
| T6 | `input-style-plain.png` | Simple `>` prompt, no borders or background |

### Interactive tests (manual)

These require running the actual CLI:

```bash
OPENROUTER_API_KEY=your-key npm start
```

| Test | Action | Expected |
|------|--------|----------|
| T7 | Type text in block input | Characters appear after `›`, box stays 3 lines, no shifting |
| T8 | Press Backspace | Characters removed, no visual artifacts |
| T9 | Press Enter to submit | Box appears in scrollback with status line below, response streams |
| T10 | Second prompt after response | New input box renders cleanly, no artifacts from prior block |
| T11 | Ctrl+C | Process exits cleanly, terminal restored |

## Troubleshooting

- **ttyd not found**: Install with `brew install ttyd` (macOS) or your system package manager
- **Playwright browser not installed**: Run `npx playwright install chromium`
- **Screenshots blank or wrong size**: Check ttyd is not already running on the same ports (7690-7700)
- **Unicode rendering issues**: ttyd uses a real PTY so character widths are handled natively — if something wraps unexpectedly, the demo content is too wide for the terminal
