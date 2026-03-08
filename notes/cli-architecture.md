# CLI Architecture

## Design decisions

**cmd-ts** for subcommand routing. Initially planned to use a manual `process.argv` router, but Meno's PR review (see [cli-mvp-code-review.md](cli-mvp-code-review.md)) pushed toward cmd-ts — it handles unknown commands, option parsing, `--help`/`-h`, and type-safe args. The friend-of-Meno escape hatch: if features are missing, ask.

**Build-free**: `cli.js` spawns `node --import tsx cli.ts` — no compile step. Edit `.ts`, run it.

**No `fs.*Sync`**: `fs/promises` everywhere, including config and credential loading.

**cement Result pattern**: All commands return `Result<void>` from `@adviser/cement`. Errors propagate as values, not exceptions. `emitResult()` in `cli.ts` maps `Result.Err` to stderr + exitCode 1.

**Injectable `CliOutput`**: Commands accept a `CliOutput` parameter (`stdout`/`stderr` functions) with a process-based default. Tests capture output without spawning processes. Enables future browser execution.

**`loadAsset` for text files**: Help text lives in `help.txt`, loaded at runtime via cement `loadAsset` with `import.meta.url` as basePath. Same pattern as `prompts/pkg/llms/*.txt`.

---

## Entry point: two-file bootstrap

```
cli.js   ← npm bin entry (plain JS, Node builtins only)
  └─ spawns: node --import tsx cli.ts
cli.ts   ← cmd-ts subcommands, Result pattern, all logic
```

**Why two files:** npm bin linking runs files with `node <path>`, which can't execute `.ts` without a loader. `cli.js` resolves tsx from the package's own node_modules via `createRequire`, then spawns `cli.ts` with the tsx loader registered. One extra process spawn at startup is the cost of staying build-free while working everywhere npm does.

`cli.js` uses only Node builtins (`node:child_process`, `node:path`, `node:module`). zx and cement are deferred for this file until deno is the primary runtime (at which point cli.js goes away entirely).

---

## Command structure

```
use-vibes/pkg/
├── cli.js              # JS bootstrap — resolves tsx, spawns cli.ts
├── cli.ts              # cmd-ts subcommands, emitResult, no-args→help
├── commands/
│   ├── cli-output.ts   # CliOutput interface + defaultCliOutput
│   ├── help.ts         # loads help.txt via loadAsset
│   ├── help.txt        # extracted help text
│   ├── whoami.ts       # returns Result.Err (auth not yet implemented)
│   ├── skills.ts       # lists RAG skill catalog via @vibes.diy/prompts
│   ├── system.ts       # assembles system prompt for selected skills
│   └── not-implemented.ts  # factory for stub commands
└── index.ts            # library exports (existing)
```

---

## Patterns

### cmd-ts usage

- `subcommands` for top-level routing (rejects unknown commands natively)
- `command` + `option` for each subcommand
- `restPositionals` on stub commands so they accept positional args (e.g., `generate foo bar` → "not yet implemented" instead of parse error)
- `defaultValue: () => ""` for optional `--skills` flag; empty string = "not provided"
- No-args and `-h`/`--help` detected before `run(app, ...)` to show help

### Fireproof CLI patterns worth adopting

1. **zx for shell commands** — already in the monorepo, cleaner than `child_process` (used in cli.ts commands, not cli.js bootstrap)
2. **Streaming output** — `edit` command should stream diffs
3. **`fs/promises` everywhere** — no sync I/O
4. **Stdout as API** — `system` and `skills` write to stdout for piping

---

## Testing

**Unit tests** (14): Direct import of command functions with `captureOutput()` — no process spawning, no pnpm store scanning, no `fs.*Sync`.

**Smoke tests** (8): Spawn `cli.js` to verify the full bootstrap pipeline (cli.js → tsx → cli.ts → cmd-ts → command → stdout/stderr).

Both run via `pnpm exec vitest run --project use-vibes-cli`.

---

## Key dependencies

- `cmd-ts` — subcommand routing, option parsing, help generation
- `@adviser/cement` — `Result`, `exception2Result`, `loadAsset`
- `@vibes.diy/prompts` — skill catalog, system prompt assembly
- `tsx` — TypeScript execution without build step
