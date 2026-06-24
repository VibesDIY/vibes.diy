# Input Styles

Three input styles are available, configured via `config.display.inputStyle`. The default is `block`.

| Style | Look | Raw mode? | Needs `detectBg()`? |
|-------|------|-----------|---------------------|
| `block` | Full-width background box with `›` prompt | Yes | Yes |
| `bordered` | `─` horizontal lines above and below input | Yes | No |
| `plain` | Simple `> ` caret | No (readline) | No |

---

## `block` Style

Full-width background-colored input area with top/bottom padding — the same look as Codex CLI. Requires `src/terminal-bg.ts` for adaptive background detection (see [tui.md](../references/tui.md)).

### styledReadLine()

```typescript
const WHITE = '\x1b[97m';
const RESET = '\x1b[0m';

function styledReadLine(bg: string): Promise<string> {
  return new Promise((resolve) => {
    let line = '';
    let first = true;

    function draw() {
      if (first) {
        process.stdout.write(`\n${bg}\x1b[K${RESET}\n`);
        process.stdout.write(`${bg}\x1b[K ${WHITE}›${RESET}${bg}${WHITE} ${line}${RESET}\n`);
        process.stdout.write(`${bg}\x1b[K${RESET}\x1b[1A\r\x1b[4G`);
        first = false;
      } else {
        process.stdout.write(`\r\x1b[2K`);
        process.stdout.write(`${bg}\x1b[K ${WHITE}›${RESET}${bg}${WHITE} ${line}${RESET}`);
      }
    }

    draw();

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onData = (data: Buffer) => {
      const str = data.toString('utf-8');
      if (str.startsWith('\x1b')) return;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code === 13 || code === 10) {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write(`${RESET}\n`);
          resolve(line);
          return;
        } else if (code === 127 || code === 8) {
          line = line.slice(0, -1);
          draw();
        } else if (code === 3) {
          process.stdout.write(`${RESET}\n`);
          process.exit(0);
        } else if (code >= 32) {
          line += str[i];
          draw();
        }
      }
    };

    process.stdin.on('data', onData);
  });
}
```

### How it works

1. **First draw**: writes top BG pad (`\n${bg}\x1b[K\n`) then prompt line with bottom BG pad, cursor moves back to prompt line
2. **Subsequent draws**: erases prompt line in-place (`\r\x1b[2K`), redraws with updated text — no vertical movement, can't grow or shift
3. **On Enter**: `${RESET}\n` moves to next line. Main loop writes cwd status line
4. **On Ctrl-C**: exits cleanly
5. **On Backspace**: removes last character and redraws in-place

### On submit (in cli.ts)

After `styledReadLine()` resolves, write a bottom BG pad and status line:

```typescript
if (config.display.inputStyle === 'block') {
  const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
  process.stdout.write(`\x1b[K  ${DIM}${cwd}${RESET}\n`);
}
```

Scrollback layout: top pad | `› text` | bottom pad | `~/path` status.

---

## `bordered` Style

Horizontal `─` lines above and below the input — the same look as Pi's coding agent. No background fill, works on any terminal theme without `detectBg()`.

### Visual layout

```
──────────────────────────────────   (gray, full terminal width)
› your text here                     (default foreground, no BG)
──────────────────────────────────   (gray, full terminal width)
```

### borderedReadLine()

```typescript
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';

function borderedReadLine(borderColor = GRAY): Promise<string> {
  return new Promise((resolve) => {
    let line = '';
    let first = true;
    const width = process.stdout.columns || 80;
    const border = `${borderColor}${'─'.repeat(width)}${RESET}`;

    function draw() {
      if (first) {
        process.stdout.write(`\n${border}\n`);
        process.stdout.write(`› ${line}\n`);
        process.stdout.write(`${border}\x1b[1A\r\x1b[${3 + line.length}G`);
        first = false;
      } else {
        process.stdout.write(`\r\x1b[2K`);
        process.stdout.write(`› ${line}`);
      }
    }

    draw();

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onData = (data: Buffer) => {
      const str = data.toString('utf-8');
      if (str.startsWith('\x1b')) return;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code === 13 || code === 10) {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          if (!line) {
            process.stdout.write(`\x1b[1A\x1b[2K\x1b[1A\x1b[2K\r`);
          } else {
            process.stdout.write(`\x1b[1B\x1b[2K\r`);
          }
          resolve(line);
          return;
        } else if (code === 127 || code === 8) {
          line = line.slice(0, -1);
          draw();
        } else if (code === 3) {
          process.stdout.write(`${RESET}\n`);
          process.exit(0);
        } else if (code >= 32) {
          line += str[i];
          draw();
        }
      }
    };

    process.stdin.on('data', onData);
  });
}
```

### How it works

1. **First draw**: writes top border → prompt line → bottom border, then cursor moves up 1 to prompt line
2. **Subsequent draws**: erases prompt line in-place, redraws — same technique as block style, never moves vertically after setup
3. **On Enter**: moves cursor down 1 to the bottom border line, erases it (`\x1b[1B\x1b[2K\r`), then resolves. The border disappears on submit, leaving clean scrollback
4. **Border width**: uses `process.stdout.columns` for full terminal width
5. **Border color**: gray by default, configurable via `borderColor` parameter

### On submit (in cli.ts)

After `borderedReadLine()` resolves, write cwd status line:

```typescript
if (config.display.inputStyle === 'bordered') {
  const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
  process.stdout.write(`  ${DIM}${cwd}${RESET}\n`);
}
```

Scrollback layout: top border | `› text` | `~/path` status (bottom border erased).

---

## `plain` Style

Standard readline prompt — no raw mode, no escape sequences beyond basic colors.

```typescript
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${GREEN}>${RESET} `,
});

function plainReadLine(): Promise<string> {
  return new Promise((resolve) => {
    rl.prompt();
    rl.once('line', resolve);
  });
}
```

No on-submit handling needed — readline handles the display.

---

## Wire into cli.ts

Use a `getInput()` dispatcher that switches on the configured style:

```typescript
import { detectBg } from './terminal-bg.js';

async function main() {
  const config = loadConfig();
  const BG_INPUT = config.display.inputStyle === 'block' ? await detectBg() : '';

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${GREEN}>${RESET} `,
  });

  async function getInput(): Promise<string> {
    switch (config.display.inputStyle) {
      case 'block': return styledReadLine(BG_INPUT);
      case 'bordered': return borderedReadLine();
      case 'plain':
      default:
        return new Promise((r) => { rl.prompt(); rl.once('line', r); });
    }
  }

  while (true) {
    const input = await getInput();
    const trimmed = input.trim();
    if (!trimmed) continue;

    if (config.display.inputStyle !== 'plain') {
      const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
      process.stdout.write(`\x1b[K  ${DIM}${cwd}${RESET}\n`);
    }

    // ... handle input, run agent, etc.
  }
}
```

Only `block` style calls `detectBg()` at startup. The `bordered` and `plain` styles skip it entirely.
